from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, date, datetime
from enum import StrEnum
from typing import Any, Mapping

JsonObject = dict[str, Any]


def utcnow() -> datetime:
    return datetime.now(UTC)


@dataclass(frozen=True, slots=True)
class FetchResult:
    source_url: str
    body: bytes
    mime_type: str
    retrieved_at: datetime = field(default_factory=utcnow)
    status_code: int = 200
    headers: Mapping[str, str] = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class RawSnapshot:
    id: str
    connector: str
    source_url: str
    content_hash: str
    body: bytes
    mime_type: str
    retrieved_at: datetime
    metadata: JsonObject = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class NormalizedRecord:
    entity_type: str
    entity_key: str
    data: JsonObject
    source_url: str
    verified_on: date | None
    source_published_on: date | None = None
    deadline_on: date | None = None


@dataclass(frozen=True, slots=True)
class FieldDiff:
    path: str
    before: Any
    after: Any
    operation: str


class ReviewStatus(StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    NEEDS_CHANGES = "needs_changes"


@dataclass(slots=True)
class ReviewItem:
    id: str
    snapshot_id: str
    entity_type: str
    entity_key: str
    proposed_data: JsonObject
    field_diff: tuple[FieldDiff, ...]
    source_url: str
    content_hash: str
    status: ReviewStatus = ReviewStatus.PENDING
    reviewed_data: JsonObject | None = None
    reviewer: str | None = None
    review_note: str | None = None
    reviewed_at: datetime | None = None
    created_at: datetime = field(default_factory=utcnow)


@dataclass(frozen=True, slots=True)
class PublicationVersion:
    id: str
    review_item_id: str
    entity_type: str
    entity_key: str
    version: int
    data: JsonObject
    verifier: str
    citation_url: str
    source_hash: str
    published_at: datetime = field(default_factory=utcnow)


@dataclass(frozen=True, slots=True)
class HookEvent:
    id: str
    publication_id: str
    kind: str
    payload: JsonObject
    created_at: datetime = field(default_factory=utcnow)
