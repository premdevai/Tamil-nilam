import json
from dataclasses import asdict
from datetime import date
from pathlib import Path
from typing import Any

import psycopg
import typer

from nilam_dataops.connectors import (
    CONNECTOR_TYPES,
    Connector,
    FixtureTransport,
    GovernmentOrderConnector,
    HttpTransport,
    Transport,
)
from nilam_dataops.extraction import PypdfExtractor, RejectingOcrEngine
from nilam_dataops.models import ReviewStatus
from nilam_dataops.pipeline import IngestionPipeline, ReviewService
from nilam_dataops.repository import PostgresReviewRepository, PostgresStagingRepository
from nilam_dataops.settings import Settings

app = typer.Typer(no_args_is_help=True)
review_app = typer.Typer(no_args_is_help=True)
app.add_typer(review_app, name="review")


def _settings() -> Settings:
    return Settings()  # type: ignore[call-arg]


def _echo_json(value: Any) -> None:
    typer.echo(json.dumps(value, default=str, ensure_ascii=False, indent=2))


@app.command()
def check() -> None:
    """Validate configuration without contacting a source or database."""
    settings = _settings()
    typer.echo(f"Configuration valid; write schema={settings.database_schema}")


@app.command()
def ingest(
    connector_name: str = typer.Argument(
        ..., help="tansidco, sipcot, tn-msme-tnswp, mofpi-pib, or tn-go-pdf"
    ),
    source_url: str = typer.Argument(..., help="Explicit official source URL"),
    verified_on: date | None = typer.Option(
        None, help="Human verification date; required before monetary facts can queue"
    ),
    fixture_manifest: Path | None = typer.Option(
        None, help="JSON URL-to-fixture manifest for deterministic offline ingestion"
    ),
) -> None:
    """Fetch an official source and write raw/normalized data to staging only."""
    settings = _settings()
    connector_type = CONNECTOR_TYPES.get(connector_name)
    if connector_name == "tn-go-pdf":
        allowed_hosts = GovernmentOrderConnector.allowed_hosts
    elif connector_type is None:
        raise typer.BadParameter(f"unknown connector: {connector_name}")
    else:
        allowed_hosts = connector_type.allowed_hosts
    if fixture_manifest is not None:
        manifest = json.loads(fixture_manifest.read_text(encoding="utf-8"))
        if not isinstance(manifest, dict):
            raise typer.BadParameter("fixture manifest must be a JSON object")
        transport: Transport = FixtureTransport.from_directory(
            fixture_manifest.parent, manifest
        )
    else:
        transport = HttpTransport(allowed_hosts)
    connector: Connector
    if connector_name == "tn-go-pdf":
        connector = GovernmentOrderConnector(
            transport, PypdfExtractor(ocr=RejectingOcrEngine())
        )
    else:
        assert connector_type is not None
        connector = connector_type(transport)
    with psycopg.connect(settings.database_url) as connection:
        pipeline = IngestionPipeline(PostgresStagingRepository(connection))
        items = pipeline.run(connector, source_url, verified_on=verified_on)
    _echo_json(
        [
            {
                "review_id": item.id,
                "entity_type": item.entity_type,
                "entity_key": item.entity_key,
                "changes": len(item.field_diff),
            }
            for item in items
        ]
    )


def _review_service() -> tuple[psycopg.Connection[Any], ReviewService]:
    settings = _settings()
    connection = psycopg.connect(settings.require_reviewer_database_url())
    return connection, ReviewService(PostgresReviewRepository(connection))


@review_app.command("list")
def list_reviews(status: ReviewStatus = ReviewStatus.PENDING) -> None:
    """List review queue items without publishing."""
    connection, service = _review_service()
    try:
        items = service.reviews(status)
        _echo_json(
            [
                {
                    "id": item.id,
                    "entity_type": item.entity_type,
                    "entity_key": item.entity_key,
                    "status": item.status,
                    "source_url": item.source_url,
                    "diff": [asdict(change) for change in item.field_diff],
                }
                for item in items
            ]
        )
    finally:
        connection.close()


@review_app.command()
def edit(
    review_id: str,
    replacement_file: Path,
    reviewer: str = typer.Option(...),
    note: str = typer.Option(...),
) -> None:
    """Attach an explicit reviewed replacement; approval remains separate."""
    replacement = json.loads(replacement_file.read_text(encoding="utf-8"))
    if not isinstance(replacement, dict):
        raise typer.BadParameter("replacement file must contain a JSON object")
    connection, service = _review_service()
    try:
        item = service.edit(
            review_id, reviewer=reviewer, replacement=replacement, note=note
        )
        _echo_json({"id": item.id, "status": item.status})
    finally:
        connection.close()


@review_app.command()
def reject(
    review_id: str,
    reviewer: str = typer.Option(...),
    note: str = typer.Option(...),
) -> None:
    """Reject a staged proposal and retain its audit history."""
    connection, service = _review_service()
    try:
        item = service.reject(review_id, reviewer=reviewer, note=note)
        _echo_json({"id": item.id, "status": item.status})
    finally:
        connection.close()


@review_app.command()
def approve(
    review_id: str,
    reviewer: str = typer.Option(...),
    citation_url: str = typer.Option(...),
    note: str = typer.Option(...),
) -> None:
    """Publish an approved append-only version and enqueue downstream hooks."""
    connection, service = _review_service()
    try:
        publication = service.approve(
            review_id,
            reviewer=reviewer,
            citation_url=citation_url,
            note=note,
        )
        _echo_json(asdict(publication))
    finally:
        connection.close()


if __name__ == "__main__":
    app()
