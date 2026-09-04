from __future__ import annotations

from datetime import date
from pathlib import Path

import pytest

from nilam_dataops.connectors import FixtureTransport, HttpTransport, TansidcoConnector
from nilam_dataops.diffing import field_diff
from nilam_dataops.invariants import InvariantViolation, freshness_flags, validate_record
from nilam_dataops.models import ReviewStatus
from nilam_dataops.pipeline import IngestionPipeline, ReviewService
from nilam_dataops.repository import MemoryRepository

SOURCE_URL = "https://tansidco.tn.gov.in/fixtures/plots.json"
FIXTURES = Path(__file__).parent / "fixtures"


def connector(body: bytes | None = None) -> TansidcoConnector:
    fixture = body if body is not None else (FIXTURES / "tansidco_plots.json").read_bytes()
    return TansidcoConnector(
        FixtureTransport({SOURCE_URL: (fixture, "application/json")})
    )


def test_ingestion_persists_hash_raw_bytes_normalized_record_and_review() -> None:
    repository = MemoryRepository()

    reviews = IngestionPipeline(repository).run(
        connector(), SOURCE_URL, verified_on=date(2026, 8, 21)
    )

    assert len(repository.snapshots) == 1
    snapshot = next(iter(repository.snapshots.values()))
    assert len(snapshot.content_hash) == 64
    assert snapshot.body == (FIXTURES / "tansidco_plots.json").read_bytes()
    assert reviews[0].entity_key == "fixture-plot-001"
    assert reviews[0].proposed_data["source_url"] == SOURCE_URL
    assert reviews[0].proposed_data["verified_on"] == "2026-08-21"
    assert reviews[0].status == ReviewStatus.PENDING


def test_same_raw_snapshot_has_a_stable_hash_and_id() -> None:
    repository = MemoryRepository()
    pipeline = IngestionPipeline(repository)

    first = pipeline.run(connector(), SOURCE_URL, verified_on=date(2026, 8, 21))
    second = pipeline.run(connector(), SOURCE_URL, verified_on=date(2026, 8, 21))

    assert len(repository.snapshots) == 1
    assert first[0].snapshot_id == second[0].snapshot_id
    assert len(repository.reviews) == 1


def test_field_diff_is_leaf_level_and_deterministic() -> None:
    changes = field_diff(
        {"name": "old", "details": {"rate": 1}, "removed": True},
        {"name": "new", "details": {"rate": 2}, "added": True},
    )

    assert [(change.path, change.operation) for change in changes] == [
        ("$.added", "add"),
        ("$.details.rate", "replace"),
        ("$.name", "replace"),
        ("$.removed", "remove"),
    ]


def test_monetary_fact_requires_citation_and_verified_date() -> None:
    with pytest.raises(InvariantViolation, match="citation"):
        validate_record({"subsidy_amount": 10_000, "verified_on": "2026-08-21"})
    with pytest.raises(InvariantViolation, match="verified_on"):
        validate_record(
            {"subsidy_amount": 10_000, "citation_url": "https://example.gov.in/source"}
        )
    with pytest.raises(InvariantViolation, match="verified_on"):
        validate_record(
            {
                "interest_rate": "5 percent",
                "citation_url": "https://example.gov.in/source",
            }
        )


def test_invalid_geojson_is_rejected_before_review() -> None:
    with pytest.raises(InvariantViolation, match="geometry"):
        validate_record(
            {
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[[80.0, 13.0], [80.1, 13.0], [80.1, 13.1]]],
                }
            }
        )


def test_review_edit_approve_publishes_version_and_hooks() -> None:
    repository = MemoryRepository()
    item = IngestionPipeline(repository).run(
        connector(), SOURCE_URL, verified_on=date(2026, 8, 21)
    )[0]
    service = ReviewService(repository)
    replacement = dict(item.proposed_data)
    replacement["status"] = "vacant"

    edited = service.edit(
        item.id,
        reviewer="reviewer@example.test",
        replacement=replacement,
        note="Status confirmed against the cited artifact.",
    )
    publication = service.approve(
        edited.id,
        reviewer="reviewer@example.test",
        citation_url=SOURCE_URL,
        note="Approved after manual comparison.",
    )

    assert publication.version == 1
    assert publication.data["status"] == "vacant"
    assert publication.source_hash == next(iter(repository.snapshots))
    assert [action["action"] for action in repository.review_actions] == [
        "needs_changes",
        "approved",
    ]
    assert [event.kind for event in repository.hook_events()] == [
        "search.update",
        "pages.invalidate",
        "notifications.evaluate",
    ]
    with pytest.raises(ValueError, match="already approved"):
        service.approve(
            item.id,
            reviewer="reviewer@example.test",
            citation_url=SOURCE_URL,
            note="Duplicate approval.",
        )


def test_rejection_never_publishes() -> None:
    repository = MemoryRepository()
    item = IngestionPipeline(repository).run(
        connector(), SOURCE_URL, verified_on=date(2026, 8, 21)
    )[0]

    ReviewService(repository).reject(
        item.id,
        reviewer="reviewer@example.test",
        note="Fixture intentionally rejected.",
    )

    assert item.status == ReviewStatus.REJECTED
    assert repository.publications == []


def test_approval_rejects_citation_from_an_unreviewed_host() -> None:
    repository = MemoryRepository()
    item = IngestionPipeline(repository).run(
        connector(), SOURCE_URL, verified_on=date(2026, 8, 21)
    )[0]

    with pytest.raises(ValueError, match="citation host"):
        ReviewService(repository).approve(
            item.id,
            reviewer="reviewer@example.test",
            citation_url="https://example.com/unreviewed",
            note="Must not publish.",
        )

    assert repository.publications == []


def test_stale_and_deadline_sources_are_surfaced() -> None:
    flags = freshness_flags(
        {"verified_on": "2026-01-01", "deadline_on": "2026-08-25"},
        today=date(2026, 8, 21),
    )

    assert flags == {"is_stale": True, "deadline_state": "due_soon"}


def test_http_transport_rejects_non_allowlisted_and_non_https_sources() -> None:
    transport = HttpTransport(TansidcoConnector.allowed_hosts)

    with pytest.raises(ValueError, match="allowlisted"):
        transport.get("https://example.com/not-official")
    with pytest.raises(ValueError, match="allowlisted"):
        transport.get("http://tansidco.tn.gov.in/insecure")
