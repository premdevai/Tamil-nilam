from __future__ import annotations

from dataclasses import replace
from datetime import date
from hashlib import sha256
from typing import Any
from urllib.parse import urlparse
from uuid import uuid4

from nilam_dataops.connectors import Connector
from nilam_dataops.diffing import field_diff
from nilam_dataops.invariants import freshness_flags, validate_record
from nilam_dataops.models import PublicationVersion, RawSnapshot, ReviewItem, ReviewStatus
from nilam_dataops.repository import (
    ReviewRepository,
    StagingRepository,
    mark_reviewed,
)


class IngestionPipeline:
    """Fetch, hash, normalize, validate, and queue without production access."""

    def __init__(self, repository: StagingRepository) -> None:
        self._repository = repository

    def run(
        self,
        connector: Connector,
        source_url: str,
        *,
        verified_on: date | None = None,
    ) -> list[ReviewItem]:
        fetched = connector.fetch(source_url)
        digest = sha256(fetched.body).hexdigest()
        snapshot = RawSnapshot(
            id=str(uuid4()),
            connector=connector.name,
            source_url=fetched.source_url,
            content_hash=digest,
            body=fetched.body,
            mime_type=fetched.mime_type,
            retrieved_at=fetched.retrieved_at,
            metadata={
                "status_code": fetched.status_code,
                "headers": {
                    key.lower(): value
                    for key, value in fetched.headers.items()
                    if key.lower() in {"etag", "last-modified", "content-length"}
                },
            },
        )
        persisted_id = self._repository.save_snapshot(snapshot)
        if persisted_id != snapshot.id:
            snapshot = replace(snapshot, id=persisted_id)

        review_items: list[ReviewItem] = []
        for record in connector.normalize(fetched, verified_on=verified_on):
            record.data.update(freshness_flags(record.data))
            validate_record(record.data)
            previous = self._repository.latest_data(record.entity_type, record.entity_key)
            changes = field_diff(previous or {}, record.data)
            self._repository.stage(snapshot.id, record, changes)
            review_items.append(self._repository.enqueue(snapshot, record, changes))
        return review_items


class ReviewService:
    """Human-only state machine and append-only publication boundary."""

    def __init__(self, repository: ReviewRepository) -> None:
        self._repository = repository

    def pending(self) -> list[ReviewItem]:
        return self._repository.list_reviews(ReviewStatus.PENDING)

    def reviews(self, status: ReviewStatus) -> list[ReviewItem]:
        return self._repository.list_reviews(status)

    def edit(
        self,
        review_id: str,
        *,
        reviewer: str,
        replacement: dict[str, Any],
        note: str,
    ) -> ReviewItem:
        item = self._repository.get_review(review_id)
        self._require_actionable(item)
        self._require_identity_and_note(reviewer, note)
        validate_record(replacement)
        item.reviewed_data = dict(replacement)
        mark_reviewed(item, ReviewStatus.NEEDS_CHANGES, reviewer, note)
        self._repository.save_review(item)
        return item

    def reject(self, review_id: str, *, reviewer: str, note: str) -> ReviewItem:
        item = self._repository.get_review(review_id)
        self._require_actionable(item)
        self._require_identity_and_note(reviewer, note)
        mark_reviewed(item, ReviewStatus.REJECTED, reviewer, note)
        self._repository.save_review(item)
        return item

    def approve(
        self,
        review_id: str,
        *,
        reviewer: str,
        citation_url: str,
        note: str,
    ) -> PublicationVersion:
        item = self._repository.get_review(review_id)
        self._require_actionable(item)
        self._require_identity_and_note(reviewer, note)
        citation = urlparse(citation_url)
        if citation.scheme not in {"http", "https"} or not citation.hostname:
            raise ValueError("approval requires an absolute citation URL")
        approved_data = dict(item.reviewed_data or item.proposed_data)
        source_hosts = {urlparse(item.source_url).hostname}
        document_url = approved_data.get("url")
        if isinstance(document_url, str):
            source_hosts.add(urlparse(document_url).hostname)
        if citation.hostname not in source_hosts:
            raise ValueError("citation host must match the reviewed official source")
        approved_data["citation_url"] = citation_url
        validate_record(approved_data)
        item.reviewed_data = approved_data
        mark_reviewed(item, ReviewStatus.APPROVED, reviewer, note)
        self._repository.save_review(item)
        return self._repository.publish(item, reviewer, citation_url)

    @staticmethod
    def _require_actionable(item: ReviewItem) -> None:
        if item.status not in {ReviewStatus.PENDING, ReviewStatus.NEEDS_CHANGES}:
            raise ValueError(f"review item is already {item.status}")

    @staticmethod
    def _require_identity_and_note(reviewer: str, note: str) -> None:
        if not reviewer.strip():
            raise ValueError("reviewer identity is required")
        if not note.strip():
            raise ValueError("an audit note is required")
