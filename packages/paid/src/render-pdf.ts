import {
  PDFDocument,
  type PDFFont,
  type PDFPage,
  StandardFonts,
  rgb,
} from 'pdf-lib';

import type { DprDocumentModel, DprTable } from './documents';

const PAGE: [number, number] = [595.28, 841.89];
const MARGIN = 48;
const TOP = PAGE[1] - 56;
const BOTTOM = 60;
const WIDTH = PAGE[0] - MARGIN * 2;

const INK = rgb(0.13, 0.14, 0.13);
const MUTED = rgb(0.42, 0.44, 0.42);
const BRAND = rgb(0.11, 0.3, 0.22);
const HEADER_FILL = rgb(0.86, 0.92, 0.89);
const EMPHASIS_FILL = rgb(0.95, 0.96, 0.95);
const KEY_FILL = rgb(0.96, 0.97, 0.96);
const RULE = rgb(0.78, 0.8, 0.78);

/** Standard PDF fonts are WinAnsi only; map the few non-ASCII glyphs we use. */
export function pdfSafe(value: string): string {
  return value
    .replace(/₹\s?/gu, 'Rs. ')
    .replaceAll('—', '-')
    .replaceAll('–', '-')
    .replaceAll('−', '-')
    .replaceAll('·', '-')
    .replaceAll('’', "'")
    .replaceAll('‘', "'")
    .replaceAll('“', '"')
    .replaceAll('”', '"')
    .replaceAll('…', '...')
    .replace(/[^\x20-\x7E]/g, '?');
}

type Fonts = { regular: PDFFont; bold: PDFFont };

export async function renderDeterministicPdf(
  model: DprDocumentModel,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create({ updateMetadata: false });
  const fonts: Fonts = {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
  };
  const fixedDate = new Date(model.generatedAt);
  pdf.setTitle(pdfSafe(model.title));
  pdf.setAuthor('NILAM');
  pdf.setCreator('NILAM deterministic DPR renderer');
  pdf.setProducer('NILAM');
  pdf.setCreationDate(fixedDate);
  pdf.setModificationDate(fixedDate);

  if (model.cover !== undefined) drawCover(pdf, fonts, model);

  const tocPage = model.cover === undefined ? null : pdf.addPage(PAGE);
  const sectionPages: number[] = [];

  let page = pdf.addPage(PAGE);
  let y = TOP;
  const newPage = () => {
    page = pdf.addPage(PAGE);
    y = TOP;
  };
  const ensure = (height: number) => {
    if (y - height < BOTTOM) newPage();
  };
  const text = (
    value: string,
    options: {
      size?: number;
      font?: PDFFont;
      color?: ReturnType<typeof rgb>;
      gap?: number;
      indent?: number;
    } = {},
  ) => {
    const size = options.size ?? 9.5;
    const font = options.font ?? fonts.regular;
    const indent = options.indent ?? 0;
    const leading = size * 1.42;
    for (const line of wrap(pdfSafe(value), font, size, WIDTH - indent)) {
      ensure(leading);
      page.drawText(line, {
        x: MARGIN + indent,
        y: y - size,
        size,
        font,
        color: options.color ?? INK,
      });
      y -= leading;
    }
    y -= options.gap ?? 4;
  };

  if (model.cover === undefined) {
    text(model.title, { size: 16, font: fonts.bold, color: BRAND });
    text(
      `Document version ${model.documentVersion} - generated ${model.generatedAt}`,
      {
        size: 8.5,
        color: MUTED,
        gap: 10,
      },
    );
  }

  model.sections.forEach((section, index) => {
    const major =
      index > 0 &&
      model.cover !== undefined &&
      /^(10\.|Annexure A)/u.test(section.heading);
    if (major && y < TOP) newPage();
    ensure(60);
    sectionPages.push(pdf.getPageCount() - 1);
    y -= 4;
    page.drawRectangle({
      x: MARGIN,
      y: y - 18,
      width: 3,
      height: 16,
      color: BRAND,
    });
    page.drawText(pdfSafe(section.heading), {
      x: MARGIN + 10,
      y: y - 14,
      size: 13,
      font: fonts.bold,
      color: BRAND,
    });
    y -= 28;
    for (const paragraph of section.paragraphs) text(paragraph, { gap: 5 });
    for (const table of section.tables ?? []) {
      const result = drawTable(pdf, fonts, table, page, y, () => {
        newPage();
        return { page, y };
      });
      page = result.page;
      y = result.y - 10;
    }
    for (const note of section.notes ?? []) {
      text(note, { size: 8.5, color: MUTED, gap: 3 });
    }
    y -= 8;
  });

  const pages = pdf.getPages();
  if (tocPage !== null) drawContents(tocPage, fonts, model, sectionPages);
  const firstNumbered = model.cover === undefined ? 0 : 1;
  const total = pages.length - firstNumbered;
  pages.forEach((current, index) => {
    if (index < firstNumbered) return;
    const label = pdfSafe(`${model.title} - v${model.documentVersion}`);
    current.drawLine({
      start: { x: MARGIN, y: 42 },
      end: { x: PAGE[0] - MARGIN, y: 42 },
      thickness: 0.5,
      color: RULE,
    });
    current.drawText(truncate(label, fonts.regular, 7.5, WIDTH - 80), {
      x: MARGIN,
      y: 30,
      size: 7.5,
      font: fonts.regular,
      color: MUTED,
    });
    const number = `Page ${index - firstNumbered + 1} of ${total}`;
    current.drawText(number, {
      x: PAGE[0] - MARGIN - fonts.regular.widthOfTextAtSize(number, 7.5),
      y: 30,
      size: 7.5,
      font: fonts.regular,
      color: MUTED,
    });
  });

  return pdf.save({ addDefaultPage: false, useObjectStreams: false });
}

function drawCover(pdf: PDFDocument, fonts: Fonts, model: DprDocumentModel) {
  const cover = model.cover;
  if (cover === undefined) return;
  const page = pdf.addPage(PAGE);
  page.drawRectangle({
    x: 0,
    y: PAGE[1] - 250,
    width: PAGE[0],
    height: 250,
    color: BRAND,
  });
  page.drawText('DETAILED PROJECT REPORT', {
    x: MARGIN,
    y: PAGE[1] - 90,
    size: 11,
    font: fonts.bold,
    color: rgb(0.8, 0.9, 0.85),
  });
  let y = PAGE[1] - 125;
  const name = model.title.replace(/^Detailed Project Report — /u, '');
  for (const line of wrap(pdfSafe(name), fonts.bold, 26, WIDTH)) {
    page.drawText(line, {
      x: MARGIN,
      y,
      size: 26,
      font: fonts.bold,
      color: rgb(1, 1, 1),
    });
    y -= 32;
  }
  page.drawText(pdfSafe(cover.subtitle), {
    x: MARGIN,
    y: PAGE[1] - 225,
    size: 11,
    font: fonts.regular,
    color: rgb(0.88, 0.94, 0.91),
  });

  y = PAGE[1] - 300;
  page.drawText(pdfSafe(`Promoter: ${cover.preparedFor}`), {
    x: MARGIN,
    y,
    size: 11,
    font: fonts.bold,
    color: INK,
  });
  y -= 18;
  page.drawText(
    pdfSafe(
      `Prepared on ${cover.preparedOn} - document version ${model.documentVersion}`,
    ),
    {
      x: MARGIN,
      y,
      size: 9.5,
      font: fonts.regular,
      color: MUTED,
    },
  );

  y -= 40;
  const boxW = (WIDTH - 20) / 3;
  const boxH = 62;
  cover.highlights.forEach(([label, value], index) => {
    const col = index % 3;
    const rowIndex = Math.floor(index / 3);
    const x = MARGIN + col * (boxW + 10);
    const top = y - rowIndex * (boxH + 10);
    page.drawRectangle({
      x,
      y: top - boxH,
      width: boxW,
      height: boxH,
      color: KEY_FILL,
      borderColor: RULE,
      borderWidth: 0.6,
    });
    page.drawText(pdfSafe(label).toUpperCase(), {
      x: x + 10,
      y: top - 20,
      size: 7.5,
      font: fonts.bold,
      color: MUTED,
    });
    page.drawText(truncate(pdfSafe(value), fonts.bold, 15, boxW - 20), {
      x: x + 10,
      y: top - 44,
      size: 15,
      font: fonts.bold,
      color: BRAND,
    });
  });

  const note =
    'Prepared with NILAM from founder-supplied inputs. Projections are estimates for appraisal and are not a sanction, approval or guarantee by any bank or government body.';
  let noteY = 90;
  for (const line of wrap(pdfSafe(note), fonts.regular, 8, WIDTH)) {
    page.drawText(line, {
      x: MARGIN,
      y: noteY,
      size: 8,
      font: fonts.regular,
      color: MUTED,
    });
    noteY -= 11;
  }
}

function drawContents(
  page: PDFPage,
  fonts: Fonts,
  model: DprDocumentModel,
  sectionPages: readonly number[],
) {
  let y = TOP;
  page.drawText('Contents', {
    x: MARGIN,
    y: y - 16,
    size: 18,
    font: fonts.bold,
    color: BRAND,
  });
  y -= 44;
  model.sections.forEach((section, index) => {
    const label = pdfSafe(section.heading);
    // The cover is unnumbered, so page index n prints as "Page n".
    const number = String(sectionPages[index] ?? 1);
    page.drawText(truncate(label, fonts.regular, 10, WIDTH - 50), {
      x: MARGIN,
      y,
      size: 10,
      font: fonts.regular,
      color: INK,
    });
    page.drawText(number, {
      x: PAGE[0] - MARGIN - fonts.regular.widthOfTextAtSize(number, 10),
      y,
      size: 10,
      font: fonts.regular,
      color: INK,
    });
    page.drawLine({
      start: { x: MARGIN, y: y - 5 },
      end: { x: PAGE[0] - MARGIN, y: y - 5 },
      thickness: 0.3,
      color: RULE,
    });
    y -= 19;
  });
}

function drawTable(
  pdf: PDFDocument,
  fonts: Fonts,
  table: DprTable,
  startPage: PDFPage,
  startY: number,
  breakPage: () => { page: PDFPage; y: number },
): { page: PDFPage; y: number } {
  void pdf;
  let page = startPage;
  let y = startY;
  const columns = table.columns.length;
  const size = columns > 9 ? 6.8 : columns > 6 ? 7.6 : 8.6;
  const padX = columns > 9 ? 3 : 5;
  const padY = 4;
  const leading = size * 1.3;
  const weights =
    table.widths ??
    (table.numeric === true
      ? [
          columns > 7 ? 2.6 : 2.4,
          ...Array.from({ length: columns - 1 }, () => 1),
        ]
      : Array.from({ length: columns }, (_, i) => (i === 0 ? 1.6 : 1)));
  const sum = weights.reduce((total, weight) => total + weight, 0);
  const widths = weights.map((weight) => (weight / sum) * WIDTH);
  const emphasis = new Set(
    table.emphasis === 'last'
      ? [table.rows.length - 1]
      : (table.emphasis ?? []),
  );
  const showHeader = table.header !== false;

  if (table.caption !== undefined) {
    if (y - 40 < BOTTOM) ({ page, y } = breakPage());
    page.drawText(pdfSafe(table.caption), {
      x: MARGIN,
      y: y - 9,
      size: 9,
      font: fonts.bold,
      color: INK,
    });
    y -= 15;
  }

  const drawRow = (
    cells: readonly string[],
    kind: 'header' | 'emphasis' | 'body',
    keyColumn: boolean,
  ) => {
    const font = kind === 'body' ? fonts.regular : fonts.bold;
    const lines = cells.map((cell, index) =>
      wrap(
        pdfSafe(cell),
        index === 0 && keyColumn ? fonts.bold : font,
        size,
        (widths[index] ?? 40) - padX * 2,
      ),
    );
    const height =
      Math.max(...lines.map((cell) => cell.length)) * leading + padY * 2;
    if (y - height < BOTTOM) {
      ({ page, y } = breakPage());
      if (showHeader && kind !== 'header')
        drawRow(table.columns, 'header', false);
    }
    const fill =
      kind === 'header'
        ? HEADER_FILL
        : kind === 'emphasis'
          ? EMPHASIS_FILL
          : undefined;
    if (fill !== undefined) {
      page.drawRectangle({
        x: MARGIN,
        y: y - height,
        width: WIDTH,
        height,
        color: fill,
      });
    } else if (keyColumn) {
      page.drawRectangle({
        x: MARGIN,
        y: y - height,
        width: widths[0] ?? 0,
        height,
        color: KEY_FILL,
      });
    }
    let x = MARGIN;
    lines.forEach((cellLines, index) => {
      const width = widths[index] ?? 40;
      const right = table.numeric === true && index > 0;
      const cellFont = index === 0 && keyColumn ? fonts.bold : font;
      cellLines.forEach((line, lineIndex) => {
        const lineWidth = cellFont.widthOfTextAtSize(line, size);
        page.drawText(line, {
          x: right ? x + width - padX - lineWidth : x + padX,
          y: y - padY - size - lineIndex * leading + 1.5,
          size,
          font: cellFont,
          color: INK,
        });
      });
      x += width;
    });
    page.drawLine({
      start: { x: MARGIN, y: y - height },
      end: { x: MARGIN + WIDTH, y: y - height },
      thickness: 0.4,
      color: RULE,
    });
    y -= height;
  };

  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: MARGIN + WIDTH, y },
    thickness: 0.8,
    color: BRAND,
  });
  if (showHeader) drawRow(table.columns, 'header', false);
  table.rows.forEach((cells, index) => {
    drawRow(cells, emphasis.has(index) ? 'emphasis' : 'body', !showHeader);
  });
  return { page, y };
}

function wrap(
  text: string,
  font: PDFFont,
  size: number,
  width: number,
): string[] {
  if (text.length === 0) return [''];
  const words = text.split(/\s+/u);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line.length === 0 ? word : `${line} ${word}`;
    if (font.widthOfTextAtSize(candidate, size) <= width || line.length === 0) {
      line = candidate;
      while (font.widthOfTextAtSize(line, size) > width && line.length > 1) {
        // Break very long tokens such as URLs and hashes.
        let cut = line.length - 1;
        while (
          cut > 1 &&
          font.widthOfTextAtSize(line.slice(0, cut), size) > width
        )
          cut -= 1;
        lines.push(line.slice(0, cut));
        line = line.slice(cut);
      }
    } else {
      lines.push(line);
      line = word;
      while (font.widthOfTextAtSize(line, size) > width && line.length > 1) {
        let cut = line.length - 1;
        while (
          cut > 1 &&
          font.widthOfTextAtSize(line.slice(0, cut), size) > width
        )
          cut -= 1;
        lines.push(line.slice(0, cut));
        line = line.slice(cut);
      }
    }
  }
  if (line.length > 0) lines.push(line);
  return lines;
}

function truncate(
  text: string,
  font: PDFFont,
  size: number,
  width: number,
): string {
  if (font.widthOfTextAtSize(text, size) <= width) return text;
  let cut = text.length;
  while (
    cut > 1 &&
    font.widthOfTextAtSize(`${text.slice(0, cut)}...`, size) > width
  )
    cut -= 1;
  return `${text.slice(0, cut)}...`;
}
