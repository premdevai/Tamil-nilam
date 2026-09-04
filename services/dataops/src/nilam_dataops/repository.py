from __future__ import annotations

import json
from dataclasses import asdict
from typing import Any, Protocol
from uuid import uuid4

from nilam_dataops.models import (
    FieldDiff,
    HookEvent,
    NormalizedRecord,
    PublicationVersion,
    RawSnapshot,
    ReviewItem,
    ReviewStatus,
    utcnow,
)


class StagingRepository(Protocol):
    """The only repository available to connector processes."""

    def save_snapshot(self, snapshot: RawSnapshot) -> str: ...

    def latest_data(self, entity_type: str, entity_key: str) -> dict[str, Any] | None: ...

    def stage(
        self,
        snapshot_id: str,
        record: NormalizedRecord,
        diff: tuple[FieldDiff, ...],
    ) -> str: ...

    def enqueue(
        self,
        snapshot: RawSnapshot,
        record: NormalizedRecord,
        diff: tuple[FieldDiff, ...],
    ) -> ReviewItem: ...


class ReviewRepository(Protocol):
    """Reviewer connection; connector code never receives this capability."""

    def list_reviews(self, status: ReviewStatus = ReviewStatus.PENDING) -> list[ReviewItem]: ...

    def get_review(self, review_id: str) -> ReviewItem: ...

    def save_review(self, item: ReviewItem) -> None: ...

    def latest_publication(
        self, entity_type: str, entity_key: str
    ) -> PublicationVersion | None: ...

    def publish(self, item: ReviewItem, verifier: str, citation_url: str) -> PublicationVersion: ...

    def hook_events(self) -> list[HookEvent]: ...


class MemoryRepository(StagingRepository, ReviewRepository):
    def __init__(self) -> None:
        self.snapshots: dict[str, RawSnapshot] = {}
        self.records: list[tuple[str, NormalizedRecord, tuple[FieldDiff, ...]]] = []
        self.reviews: dict[str, ReviewItem] = {}
        self.review_actions: list[dict[str, Any]] = []
        self.publications: list[PublicationVersion] = []
        self.events: list[HookEvent] = []

    def save_snapshot(self, snapshot: RawSnapshot) -> str:
        existing = self.snapshots.get(snapshot.content_hash)
        if existing is not None:
            return existing.id
        self.snapshots[snapshot.content_hash] = snapshot
        return snapshot.id

    def latest_data(self, entity_type: str, entity_key: str) -> dict[str, Any] | None:
        publication = self.latest_publication(entity_type, entity_key)
        if publication is not None:
            return dict(publication.data)
        for _, record, _ in reversed(self.records):
            if record.entity_type == entity_type and record.entity_key == entity_key:
                return dict(record.data)
        return None

    def stage(
        self,
        snapshot_id: str,
        record: NormalizedRecord,
        diff: tuple[FieldDiff, ...],
    ) -> str:
        for index, (stored_snapshot_id, stored_record, _) in enumerate(self.records):
            if (
                stored_snapshot_id == snapshot_id
                and stored_record.entity_type == record.entity_type
                and stored_record.entity_key == record.entity_key
            ):
                self.records[index] = (snapshot_id, record, diff)
                return f"memory-record-{index}"
        record_id = str(uuid4())
        self.records.append((snapshot_id, record, diff))
        return record_id

    def enqueue(
        self,
        snapshot: RawSnapshot,
        record: NormalizedRecord,
        diff: tuple[FieldDiff, ...],
    ) -> ReviewItem:
        for existing in self.reviews.values():
            if (
                existing.snapshot_id == snapshot.id
                and existing.entity_type == record.entity_type
                and existing.entity_key == record.entity_key
            ):
                return existing
        item = ReviewItem(
            id=str(uuid4()),
            snapshot_id=snapshot.id,
            entity_type=record.entity_type,
            entity_key=record.entity_key,
            proposed_data=dict(record.data),
            field_diff=diff,
            source_url=record.source_url,
            content_hash=snapshot.content_hash,
        )
        self.reviews[item.id] = item
        return item

    def list_reviews(self, status: ReviewStatus = ReviewStatus.PENDING) -> list[ReviewItem]:
        return sorted(
            (item for item in self.reviews.values() if item.status == status),
            key=lambda item: item.created_at,
        )

    def get_review(self, review_id: str) -> ReviewItem:
        try:
            return self.reviews[review_id]
        except KeyError as error:
            raise KeyError(f"review item not found: {review_id}") from error

    def save_review(self, item: ReviewItem) -> None:
        self.reviews[item.id] = item
        self.review_actions.append(
            {
                "review_item_id": item.id,
                "action": item.status.value,
                "actor": item.reviewer,
                "note": item.review_note,
                "reviewed_data": dict(item.reviewed_data)
                if item.reviewed_data is not None
                else None,
                "at": item.reviewed_at,
            }
        )

    def latest_publication(self, entity_type: str, entity_key: str) -> PublicationVersion | None:
        matches = [
            version
            for version in self.publications
            if version.entity_type == entity_type and version.entity_key == entity_key
        ]
        return max(matches, key=lambda version: version.version) if matches else None

    def publish(self, item: ReviewItem, verifier: str, citation_url: str) -> PublicationVersion:
        previous = self.latest_publication(item.entity_type, item.entity_key)
        publication = PublicationVersion(
            id=str(uuid4()),
            review_item_id=item.id,
            entity_type=item.entity_type,
            entity_key=item.entity_key,
            version=1 if previous is None else previous.version + 1,
            data=dict(item.reviewed_data or item.proposed_data),
            verifier=verifier,
            citation_url=citation_url,
            source_hash=item.content_hash,
        )
        self.publications.append(publication)
        for kind in ("search.update", "pages.invalidate", "notifications.evaluate"):
            self.events.append(
                HookEvent(
                    id=str(uuid4()),
                    publication_id=publication.id,
                    kind=kind,
                    payload={
                        "entity_type": publication.entity_type,
                        "entity_key": publication.entity_key,
                        "version": publication.version,
                    },
                )
            )
        return publication

    def hook_events(self) -> list[HookEvent]:
        return list(self.events)


class PostgresStagingRepository(StagingRepository):
    """Fully-qualified staging writes; this class contains no public-schema mutation."""

    def __init__(self, connection: Any) -> None:
        self._connection = connection

    def save_snapshot(self, snapshot: RawSnapshot) -> str:
        metadata = dict(snapshot.metadata)
        with self._connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO staging.raw_source_snapshots
                    (id, connector, source_url, content_hash, raw_body, mime_type,
                     payload, retrieved_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb, %s)
                ON CONFLICT (connector, content_hash) DO UPDATE
                    SET connector = EXCLUDED.connector
                RETURNING id
                """,
                (
                    snapshot.id,
                    snapshot.connector,
                    snapshot.source_url,
                    snapshot.content_hash,
                    snapshot.body,
                    snapshot.mime_type,
                    json.dumps(metadata),
                    snapshot.retrieved_at,
                ),
            )
            row = cursor.fetchone()
        self._connection.commit()
        if row is None:
            raise RuntimeError("snapshot insert did not return an id")
        return str(row[0])

    def latest_data(self, entity_type: str, entity_key: str) -> dict[str, Any] | None:
        with self._connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT normalized_data
                FROM staging.records
                WHERE entity_type = %s AND entity_key = %s
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (entity_type, entity_key),
            )
            row = cursor.fetchone()
        return dict(row[0]) if row else None

    def stage(
        self,
        snapshot_id: str,
        record: NormalizedRecord,
        diff: tuple[FieldDiff, ...],
    ) -> str:
        record_id = str(uuid4())
        with self._connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO staging.records
                    (id, snapshot_id, entity_type, entity_key, normalized_data,
                     field_diff, source_url, verified_on, deadline_on)
                VALUES (%s, %s, %s, %s, %s::jsonb, %s::jsonb, %s, %s, %s)
                ON CONFLICT (snapshot_id, entity_type, entity_key) DO UPDATE
                    SET normalized_data = EXCLUDED.normalized_data,
                        field_diff = EXCLUDED.field_diff,
                        source_url = EXCLUDED.source_url,
                        verified_on = EXCLUDED.verified_on,
                        deadline_on = EXCLUDED.deadline_on
                RETURNING id
                """,
                (
                    record_id,
                    snapshot_id,
                    record.entity_type,
                    record.entity_key,
                    json.dumps(record.data),
                    json.dumps([asdict(change) for change in diff]),
                    record.source_url,
                    record.verified_on,
                    record.deadline_on,
                ),
            )
            row = cursor.fetchone()
        self._connection.commit()
        if row is None:
            raise RuntimeError("staged record insert did not return an id")
        return str(row[0])

    def enqueue(
        self,
        snapshot: RawSnapshot,
        record: NormalizedRecord,
        diff: tuple[FieldDiff, ...],
    ) -> ReviewItem:
        item = ReviewItem(
            id=str(uuid4()),
            snapshot_id=snapshot.id,
            entity_type=record.entity_type,
            entity_key=record.entity_key,
            proposed_data=dict(record.data),
            field_diff=diff,
            source_url=record.source_url,
            content_hash=snapshot.content_hash,
        )
        with self._connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO staging.review_queue
                    (id, snapshot_id, entity_type, entity_key, proposed_data,
                     field_diff, source_url, content_hash)
                VALUES (%s, %s, %s, %s, %s::jsonb, %s::jsonb, %s, %s)
                ON CONFLICT (snapshot_id, entity_type, entity_key) DO NOTHING
                RETURNING id
                """,
                (
                    item.id,
                    item.snapshot_id,
                    item.entity_type,
                    item.entity_key,
                    json.dumps(item.proposed_data),
                    json.dumps([asdict(change) for change in item.field_diff]),
                    item.source_url,
                    item.content_hash,
                ),
            )
            row = cursor.fetchone()
            if row is None:
                cursor.execute(
                    """
                    SELECT id
                    FROM staging.review_queue
                    WHERE snapshot_id = %s AND entity_type = %s AND entity_key = %s
                    """,
                    (item.snapshot_id, item.entity_type, item.entity_key),
                )
                row = cursor.fetchone()
        self._connection.commit()
        if row is None:
            raise RuntimeError("review queue insert did not return an id")
        item.id = str(row[0])
        return item


class PostgresReviewRepository(ReviewRepository):
    """Reviewer-only repository; publishing is delegated to a guarded DB function."""

    def __init__(self, connection: Any) -> None:
        self._connection = connection

    @staticmethod
    def _item(row: Any) -> ReviewItem:
        changes = tuple(
            FieldDiff(
                path=value["path"],
                before=value.get("before"),
                after=value.get("after"),
                operation=value["operation"],
            )
            for value in row[5]
        )
        return ReviewItem(
            id=str(row[0]),
            snapshot_id=str(row[1]),
            entity_type=row[2],
            entity_key=row[3],
            proposed_data=dict(row[4]),
            field_diff=changes,
            source_url=row[6],
            content_hash=row[7],
            status=ReviewStatus(row[8]),
            reviewed_data=dict(row[9]) if row[9] is not None else None,
            reviewer=row[10],
            review_note=row[11],
            reviewed_at=row[12],
            created_at=row[13],
        )

    def list_reviews(self, status: ReviewStatus = ReviewStatus.PENDING) -> list[ReviewItem]:
        with self._connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, snapshot_id, entity_type, entity_key, proposed_data,
                       field_diff, source_url, content_hash, status, reviewed_data,
                       reviewer, review_note, reviewed_at, created_at
                FROM staging.review_queue
                WHERE status = %s
                ORDER BY created_at
                """,
                (status.value,),
            )
            return [self._item(row) for row in cursor.fetchall()]

    def get_review(self, review_id: str) -> ReviewItem:
        with self._connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, snapshot_id, entity_type, entity_key, proposed_data,
                       field_diff, source_url, content_hash, status, reviewed_data,
                       reviewer, review_note, reviewed_at, created_at
                FROM staging.review_queue
                WHERE id = %s
                """,
                (review_id,),
            )
            row = cursor.fetchone()
        if row is None:
            raise KeyError(f"review item not found: {review_id}")
        return self._item(row)

    def save_review(self, item: ReviewItem) -> None:
        with self._connection.cursor() as cursor:
            cursor.execute(
                """
                UPDATE staging.review_queue
                SET status = %s, reviewed_data = %s::jsonb, reviewer = %s,
                    review_note = %s, reviewed_at = %s
                WHERE id = %s AND status IN ('pending', 'needs_changes')
                """,
                (
                    item.status.value,
                    json.dumps(item.reviewed_data) if item.reviewed_data is not None else None,
                    item.reviewer,
                    item.review_note,
                    item.reviewed_at,
                    item.id,
                ),
            )
            if cursor.rowcount != 1:
                raise RuntimeError("review item changed concurrently or is no longer actionable")
            cursor.execute(
                """
                INSERT INTO staging.review_actions
                    (review_item_id, action, actor, note, reviewed_data)
                VALUES (%s, %s, %s, %s, %s::jsonb)
                """,
                (
                    item.id,
                    item.status.value,
                    item.reviewer,
                    item.review_note,
                    json.dumps(item.reviewed_data)
                    if item.reviewed_data is not None
                    else None,
                ),
            )
        # Approval and append-only publication must commit as one transaction.
        if item.status != ReviewStatus.APPROVED:
            self._connection.commit()

    def latest_publication(self, entity_type: str, entity_key: str) -> PublicationVersion | None:
        with self._connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, review_item_id, entity_type, entity_key, version, data,
                       verifier, citation_url, source_hash, published_at
                FROM publication_versions
                WHERE entity_type = %s AND entity_key = %s
                ORDER BY version DESC
                LIMIT 1
                """,
                (entity_type, entity_key),
            )
            row = cursor.fetchone()
        return self._publication(row) if row else None

    @staticmethod
    def _publication(row: Any) -> PublicationVersion:
        return PublicationVersion(
            id=str(row[0]),
            review_item_id=str(row[1]),
            entity_type=row[2],
            entity_key=row[3],
            version=row[4],
            data=dict(row[5]),
            verifier=row[6],
            citation_url=row[7],
            source_hash=row[8],
            published_at=row[9],
        )

    def publish(self, item: ReviewItem, verifier: str, citation_url: str) -> PublicationVersion:
        with self._connection.cursor() as cursor:
            cursor.execute(
                "SELECT staging.publish_review_item(%s, %s, %s)",
                (item.id, verifier, citation_url),
            )
            publication_id = cursor.fetchone()[0]
            cursor.execute(
                """
                SELECT id, review_item_id, entity_type, entity_key, version, data,
                       verifier, citation_url, source_hash, published_at
                FROM publication_versions
                WHERE id = %s
                """,
                (publication_id,),
            )
            row = cursor.fetchone()
        self._connection.commit()
        if row is None:
            raise RuntimeError("publication function returned no version")
        return self._publication(row)

    def hook_events(self) -> list[HookEvent]:
        with self._connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, publication_id, kind, payload, created_at
                FROM publication_outbox
                ORDER BY created_at
                """
            )
            return [
                HookEvent(
                    id=str(row[0]),
                    publication_id=str(row[1]),
                    kind=row[2],
                    payload=dict(row[3]),
                    created_at=row[4],
                )
                for row in cursor.fetchall()
            ]


def mark_reviewed(item: ReviewItem, status: ReviewStatus, reviewer: str, note: str) -> None:
    item.status = status
    item.reviewer = reviewer
    item.review_note = note
    item.reviewed_at = utcnow()
