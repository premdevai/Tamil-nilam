from __future__ import annotations

from datetime import date

from nilam_dataops.connectors import FixtureTransport, GovernmentOrderConnector
from nilam_dataops.extraction import ExtractedDocument
from nilam_dataops.pipeline import IngestionPipeline
from nilam_dataops.repository import MemoryRepository

GO_URL = "https://cms.tn.gov.in/fixture/go.pdf"


class FixturePdfExtractor:
    def extract(self, pdf: bytes) -> ExtractedDocument:
        assert pdf == b"%PDF-fixture-only"
        return ExtractedDocument(
            text="Fixture extraction output; not a government fact.",
            method="fixture",
            page_count=1,
        )


def test_go_pdf_uses_extraction_interface_and_stays_in_review() -> None:
    connector = GovernmentOrderConnector(
        FixtureTransport({GO_URL: (b"%PDF-fixture-only", "application/pdf")}),
        FixturePdfExtractor(),
    )
    repository = MemoryRepository()

    item = IngestionPipeline(repository).run(
        connector, GO_URL, verified_on=date(2026, 8, 21)
    )[0]

    assert item.entity_type == "government_order_document"
    assert item.proposed_data["extraction_method"] == "fixture"
    assert repository.publications == []
