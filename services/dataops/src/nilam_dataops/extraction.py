from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
from typing import Protocol


@dataclass(frozen=True, slots=True)
class ExtractedDocument:
    text: str
    method: str
    page_count: int
    warnings: tuple[str, ...] = ()


class OcrEngine(Protocol):
    """Pluggable OCR boundary; implementations must not infer missing text."""

    def extract(self, pdf: bytes) -> ExtractedDocument: ...


class PdfExtractor(Protocol):
    def extract(self, pdf: bytes) -> ExtractedDocument: ...


class PypdfExtractor:
    """Extract embedded PDF text and delegate image-only documents to OCR."""

    def __init__(self, ocr: OcrEngine | None = None, min_text_characters: int = 40) -> None:
        self._ocr = ocr
        self._min_text_characters = min_text_characters

    def extract(self, pdf: bytes) -> ExtractedDocument:
        if not pdf.startswith(b"%PDF"):
            raise ValueError("input is not a PDF")
        try:
            from pypdf import PdfReader
        except ImportError as error:  # pragma: no cover - installation error path
            raise RuntimeError("pypdf is required for PDF extraction") from error

        reader = PdfReader(BytesIO(pdf))
        pages = [(page.extract_text() or "").strip() for page in reader.pages]
        text = "\n\n".join(page for page in pages if page)
        if len(text) >= self._min_text_characters:
            return ExtractedDocument(
                text=text,
                method="embedded_text",
                page_count=len(reader.pages),
            )
        if self._ocr is not None:
            result = self._ocr.extract(pdf)
            if result.page_count != len(reader.pages):
                return ExtractedDocument(
                    text=result.text,
                    method=result.method,
                    page_count=result.page_count,
                    warnings=result.warnings + ("OCR page count differs from PDF parser",),
                )
            return result
        return ExtractedDocument(
            text=text,
            method="embedded_text",
            page_count=len(reader.pages),
            warnings=("Document may require OCR; no OCR engine configured",),
        )


class RejectingOcrEngine:
    """Explicit default that prevents silent OCR fabrication."""

    def extract(self, pdf: bytes) -> ExtractedDocument:
        del pdf
        raise RuntimeError("OCR is required but no reviewed OCR engine is configured")
