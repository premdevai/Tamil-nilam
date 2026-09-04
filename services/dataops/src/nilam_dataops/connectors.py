from __future__ import annotations

import csv
import json
from abc import ABC, abstractmethod
from collections.abc import Iterable, Mapping
from datetime import date
from html.parser import HTMLParser
from io import StringIO
from pathlib import Path
from typing import Any, Protocol
from urllib.parse import urljoin, urlparse

import httpx

from nilam_dataops.extraction import PdfExtractor
from nilam_dataops.models import FetchResult, NormalizedRecord


class Transport(Protocol):
    def get(self, url: str) -> FetchResult: ...


class HttpTransport:
    def __init__(
        self,
        allowed_hosts: frozenset[str],
        *,
        timeout_seconds: float = 30,
        user_agent: str = "NILAM-data-verification/0.1 (+human-reviewed)",
    ) -> None:
        self._allowed_hosts = allowed_hosts
        self._timeout_seconds = timeout_seconds
        self._user_agent = user_agent

    def _require_allowed(self, url: str) -> None:
        parsed = urlparse(url)
        if parsed.scheme != "https" or parsed.hostname not in self._allowed_hosts:
            raise ValueError(f"source URL is not an allowlisted HTTPS government host: {url}")

    def get(self, url: str) -> FetchResult:
        self._require_allowed(url)
        with httpx.Client(
            follow_redirects=True,
            timeout=self._timeout_seconds,
            headers={"User-Agent": self._user_agent, "Accept": "*/*"},
        ) as client:
            response = client.get(url)
            response.raise_for_status()
        self._require_allowed(str(response.url))
        return FetchResult(
            source_url=str(response.url),
            body=response.content,
            mime_type=response.headers.get("content-type", "application/octet-stream")
            .split(";", 1)[0]
            .strip(),
            status_code=response.status_code,
            headers=dict(response.headers),
        )


class FixtureTransport:
    """Deterministic transport for portal outages and parser regression tests."""

    def __init__(self, fixtures: Mapping[str, tuple[bytes, str]]) -> None:
        self._fixtures = fixtures

    def get(self, url: str) -> FetchResult:
        try:
            body, mime_type = self._fixtures[url]
        except KeyError as error:
            raise FileNotFoundError(f"no fixture registered for {url}") from error
        return FetchResult(source_url=url, body=body, mime_type=mime_type)

    @classmethod
    def from_directory(
        cls, fixture_directory: Path, manifest: Mapping[str, Any]
    ) -> FixtureTransport:
        fixtures: dict[str, tuple[bytes, str]] = {}
        for url, entry in manifest.items():
            if not isinstance(entry, Mapping):
                raise ValueError(f"invalid fixture manifest entry for {url}")
            filename = entry.get("file")
            mime_type = entry.get("mime_type")
            if not isinstance(filename, str) or not isinstance(mime_type, str):
                raise ValueError(f"fixture entry requires file and mime_type for {url}")
            fixtures[url] = ((fixture_directory / filename).read_bytes(), mime_type)
        return cls(fixtures)


class Connector(ABC):
    name: str
    allowed_hosts: frozenset[str]

    def __init__(self, transport: Transport) -> None:
        self.transport = transport

    def fetch(self, source_url: str) -> FetchResult:
        return self.transport.get(source_url)

    @abstractmethod
    def normalize(
        self,
        fetched: FetchResult,
        *,
        verified_on: date | None = None,
    ) -> Iterable[NormalizedRecord]:
        """Parse only facts present in a fetched official artifact."""


def _entity_key(row: Mapping[str, Any], candidates: tuple[str, ...]) -> str:
    for candidate in candidates:
        value = row.get(candidate)
        if value is not None and str(value).strip():
            return str(value).strip()
    raise ValueError(f"record has no stable key; expected one of {candidates}")


def _json_rows(body: bytes) -> list[dict[str, Any]]:
    decoded = json.loads(body)
    if isinstance(decoded, list):
        rows = decoded
    elif isinstance(decoded, Mapping):
        candidates = [decoded.get(key) for key in ("features", "records", "results", "data")]
        rows = next(
            (candidate for candidate in candidates if isinstance(candidate, list)),
            [decoded],
        )
    else:
        raise ValueError("JSON source must contain an object or array")
    normalized: list[dict[str, Any]] = []
    for value in rows:
        if not isinstance(value, Mapping):
            raise ValueError("source array contains a non-object record")
        if value.get("type") == "Feature" and isinstance(value.get("properties"), Mapping):
            properties = dict(value["properties"])
            properties["geometry"] = value.get("geometry")
            normalized.append(properties)
        else:
            normalized.append(dict(value))
    return normalized


def _csv_rows(body: bytes) -> list[dict[str, Any]]:
    text = body.decode("utf-8-sig")
    return [dict(row) for row in csv.DictReader(StringIO(text))]


def _explicit_iso_date(row: Mapping[str, Any], keys: tuple[str, ...]) -> date | None:
    for key in keys:
        value = row.get(key)
        if isinstance(value, str):
            try:
                return date.fromisoformat(value)
            except ValueError:
                continue
    return None


class StructuredRecordsConnector(Connector):
    entity_type = "source_record"
    key_candidates = ("id", "slug", "code", "name", "title")

    def normalize(
        self,
        fetched: FetchResult,
        *,
        verified_on: date | None = None,
    ) -> Iterable[NormalizedRecord]:
        if fetched.mime_type in ("application/json", "application/geo+json"):
            rows = _json_rows(fetched.body)
        elif fetched.mime_type in ("text/csv", "application/csv"):
            rows = _csv_rows(fetched.body)
        elif fetched.mime_type in ("text/html", "application/xhtml+xml"):
            yield from _document_records(
                fetched,
                allowed_hosts=self.allowed_hosts,
                entity_type=self.entity_type,
                verified_on=verified_on,
            )
            return
        else:
            raise ValueError(f"{self.name} does not support {fetched.mime_type}")
        for row in rows:
            data = dict(row)
            deadline_on = _explicit_iso_date(
                row, ("deadline_on", "deadline", "last_date", "closing_date")
            )
            if deadline_on is not None:
                data["deadline_on"] = deadline_on.isoformat()
            data["source_url"] = fetched.source_url
            if verified_on is not None:
                data["verified_on"] = verified_on.isoformat()
            yield NormalizedRecord(
                entity_type=self.entity_type,
                entity_key=_entity_key(row, self.key_candidates),
                data=data,
                source_url=fetched.source_url,
                verified_on=verified_on,
                deadline_on=deadline_on,
            )


class TansidcoConnector(StructuredRecordsConnector):
    name = "tansidco"
    allowed_hosts = frozenset({"tansidco.tn.gov.in", "www.tansidco.tn.gov.in"})
    entity_type = "industrial_estate_or_plot"
    key_candidates = ("plot_id", "plot_number", "estate_code", "estate_name", "id", "name")


class SipcotConnector(StructuredRecordsConnector):
    name = "sipcot"
    allowed_hosts = frozenset({"sipcot.tn.gov.in", "www.sipcot.tn.gov.in"})
    entity_type = "sipcot_notice_or_land_record"
    key_candidates = ("notice_id", "plot_id", "title", "id", "name")


class TnMsmeTnswpConnector(StructuredRecordsConnector):
    name = "tn_msme_tnswp"
    allowed_hosts = frozenset(
        {
            "msmeonline.tn.gov.in",
            "www.msmeonline.tn.gov.in",
            "tnswp.com",
            "www.tnswp.com",
        }
    )
    entity_type = "state_scheme_or_notice"
    key_candidates = ("scheme_id", "service_id", "title", "id", "name")


class MofpiPibConnector(StructuredRecordsConnector):
    name = "mofpi_pib"
    allowed_hosts = frozenset(
        {"mofpi.gov.in", "www.mofpi.gov.in", "pib.gov.in", "www.pib.gov.in"}
    )
    entity_type = "central_scheme_or_release"
    key_candidates = ("release_id", "scheme_id", "title", "id", "name")


class _LinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.links: list[tuple[str, str]] = []
        self._href: str | None = None
        self._text: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() == "a":
            self._href = dict(attrs).get("href")
            self._text = []

    def handle_data(self, data: str) -> None:
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "a" and self._href:
            title = " ".join("".join(self._text).split())
            self.links.append((self._href, title))
            self._href = None
            self._text = []


def _document_records(
    fetched: FetchResult,
    *,
    allowed_hosts: frozenset[str],
    entity_type: str,
    verified_on: date | None,
) -> Iterable[NormalizedRecord]:
    parser = _LinkParser()
    parser.feed(fetched.body.decode("utf-8", errors="replace"))
    seen: set[str] = set()
    for href, title in parser.links:
        url = urljoin(fetched.source_url, href)
        hostname = urlparse(url).hostname
        if hostname not in allowed_hosts or url in seen:
            continue
        if not title and not url.lower().endswith(".pdf"):
            continue
        seen.add(url)
        data: dict[str, Any] = {
            "title": title or Path(urlparse(url).path).name,
            "url": url,
            "source_url": fetched.source_url,
        }
        if verified_on is not None:
            data["verified_on"] = verified_on.isoformat()
        yield NormalizedRecord(
            entity_type=entity_type,
            entity_key=url,
            data=data,
            source_url=fetched.source_url,
            verified_on=verified_on,
        )


class OfficialDocumentIndexConnector(Connector):
    entity_type = "source_document"

    def normalize(
        self,
        fetched: FetchResult,
        *,
        verified_on: date | None = None,
    ) -> Iterable[NormalizedRecord]:
        yield from _document_records(
            fetched,
            allowed_hosts=self.allowed_hosts,
            entity_type=self.entity_type,
            verified_on=verified_on,
        )


class GovernmentOrderConnector(Connector):
    name = "tn_go_pdf"
    allowed_hosts = frozenset(
        {
            "tn.gov.in",
            "www.tn.gov.in",
            "cms.tn.gov.in",
            "www.cms.tn.gov.in",
            "stationeryprinting.tn.gov.in",
            "www.stationeryprinting.tn.gov.in",
        }
    )

    def __init__(self, transport: Transport, extractor: PdfExtractor) -> None:
        super().__init__(transport)
        self._extractor = extractor

    def normalize(
        self,
        fetched: FetchResult,
        *,
        verified_on: date | None = None,
    ) -> Iterable[NormalizedRecord]:
        if fetched.mime_type != "application/pdf" and not fetched.body.startswith(b"%PDF"):
            raise ValueError("government-order connector requires a PDF")
        extraction = self._extractor.extract(fetched.body)
        data: dict[str, Any] = {
            "source_url": fetched.source_url,
            "extracted_text": extraction.text,
            "extraction_method": extraction.method,
            "page_count": extraction.page_count,
            "extraction_warnings": list(extraction.warnings),
        }
        if verified_on is not None:
            data["verified_on"] = verified_on.isoformat()
        yield NormalizedRecord(
            entity_type="government_order_document",
            entity_key=fetched.source_url,
            data=data,
            source_url=fetched.source_url,
            verified_on=verified_on,
        )


CONNECTOR_TYPES: dict[str, type[Connector]] = {
    "tansidco": TansidcoConnector,
    "sipcot": SipcotConnector,
    "tn-msme-tnswp": TnMsmeTnswpConnector,
    "mofpi-pib": MofpiPibConnector,
}
