import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { strToU8, zipSync } from 'fflate';

import type { DprSnapshot, RulesetSnapshot } from './index';

export type DprDocumentModel = {
  title: string;
  documentVersion: number;
  generatedAt: string;
  sections: ReadonlyArray<{
    heading: string;
    paragraphs: readonly string[];
  }>;
};

const DISCLAIMER =
  'This report is directional planning support, not legal, tax, investment, credit or bank-sanction advice. Eligibility, benefits, land availability and financing remain subject to the cited authority and the relevant institution’s independent review. NILAM does not claim government, legal or bank approval.';

export function resolveDocumentStorageDir(
  configured = process.env.DOCUMENT_STORAGE_DIR,
): string {
  if (configured !== undefined) return path.resolve(configured);
  const cwd = process.cwd();
  return path.basename(path.dirname(cwd)) === 'apps'
    ? path.resolve(cwd, '..', '..', '.data', 'documents')
    : path.resolve(cwd, '.data', 'documents');
}

export function documentStorageKey(
  documentId: string,
  version: number,
  format: 'pdf' | 'docx',
): string {
  return path.posix.join(documentId, `v${version}.${format}`);
}

export function resolveStoredDocumentPath(
  storageKey: string,
  configured = process.env.DOCUMENT_STORAGE_DIR,
): string {
  const root = path.resolve(resolveDocumentStorageDir(configured));
  const resolved = path.resolve(root, storageKey);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error('Document storage key escaped the storage root.');
  }
  return resolved;
}

export async function persistGeneratedDocuments(options: {
  documentId: string;
  version: number;
  model: DprDocumentModel;
  storageDir?: string;
}): Promise<{ docxStorageKey: string; pdfStorageKey: string }> {
  const docxStorageKey = documentStorageKey(
    options.documentId,
    options.version,
    'docx',
  );
  const pdfStorageKey = documentStorageKey(
    options.documentId,
    options.version,
    'pdf',
  );
  const docxPath = resolveStoredDocumentPath(
    docxStorageKey,
    options.storageDir,
  );
  const pdfPath = resolveStoredDocumentPath(pdfStorageKey, options.storageDir);
  await mkdir(path.dirname(docxPath), { recursive: true });
  await writeFile(docxPath, renderDeterministicDocx(options.model));
  await writeFile(pdfPath, await renderDeterministicPdf(options.model));
  return { docxStorageKey, pdfStorageKey };
}

export async function removeStoredDocuments(
  storageKeys: ReadonlyArray<string | null | undefined>,
  configured = process.env.DOCUMENT_STORAGE_DIR,
): Promise<string[]> {
  const removed: string[] = [];
  for (const key of storageKeys) {
    if (key === undefined || key === null || key.length === 0) continue;
    try {
      await unlink(resolveStoredDocumentPath(key, configured));
      removed.push(key);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  return removed;
}

export function buildDprDocumentModel(
  snapshot: DprSnapshot,
  ruleset: RulesetSnapshot,
  documentVersion: number,
  generatedAt: string,
): DprDocumentModel {
  const { input, warnings } = snapshot;
  const margin =
    input.projectedAnnualRevenue - input.projectedAnnualOperatingCost;
  return {
    title: `Detailed Project Report — ${input.businessName}`,
    documentVersion,
    generatedAt,
    sections: [
      {
        heading: 'Project overview',
        paragraphs: [
          `Promoter: ${input.promoterName}`,
          `Sector: ${input.sector}`,
          `District: ${input.district}`,
          `Proposed employment: ${input.employment}`,
          `Implementation period: ${input.implementationMonths} months`,
        ],
      },
      {
        heading: 'Cost of project and means of finance',
        paragraphs: [
          `Total project cost: ${formatInr(input.projectCost)}`,
          `Land and building: ${formatInr(input.landAndBuildingCost)}`,
          `Plant and machinery: ${formatInr(input.plantAndMachineryCost)}`,
          `Other fixed costs: ${formatInr(input.otherFixedCost)}`,
          `Working capital: ${formatInr(input.workingCapital)}`,
          `Promoter contribution: ${formatInr(input.promoterContribution)}`,
          `Term loan sought: ${formatInr(input.termLoan)}`,
          `Other funding: ${formatInr(input.otherFunding)}`,
        ],
      },
      {
        heading: 'Directional operating projection',
        paragraphs: [
          `Projected annual revenue: ${formatInr(input.projectedAnnualRevenue)}`,
          `Projected annual operating cost: ${formatInr(input.projectedAnnualOperatingCost)}`,
          `Projected operating surplus before finance, tax and depreciation: ${formatInr(margin)}`,
          'These figures are user-supplied estimates and have not been independently verified.',
        ],
      },
      {
        heading: 'Assumptions and validation warnings',
        paragraphs: [
          ...(input.assumptions.length > 0
            ? input.assumptions
            : ['No supporting assumptions were supplied.']),
          ...(warnings.length > 0
            ? warnings.map((warning) => `Warning: ${warning}`)
            : ['No automated validation warnings were raised.']),
        ],
      },
      {
        heading: 'Cited scheme annexure',
        paragraphs: input.citations.map(
          (citation) =>
            `${citation.title} — verified ${citation.verifiedOn} — ${citation.url}`,
        ),
      },
      {
        heading: 'Ruleset and reproducibility',
        paragraphs: [
          `Ruleset version: ${ruleset.rulesetVersion}`,
          `Ruleset snapshot hash: ${ruleset.hash}`,
          `Input captured: ${snapshot.capturedAt}`,
          `Ruleset captured: ${ruleset.capturedAt}`,
          ...ruleset.rules.map(
            (rule) =>
              `${rule.schemeSlug} v${rule.version}, verified ${rule.verifiedOn}: ${rule.sourceUrl}`,
          ),
        ],
      },
      { heading: 'Important disclaimer', paragraphs: [DISCLAIMER] },
    ],
  };
}

export function renderDeterministicDocx(model: DprDocumentModel): Uint8Array {
  const paragraphs = [
    wordParagraph(model.title, 'Title'),
    wordParagraph(
      `Document version ${model.documentVersion} · generated ${model.generatedAt}`,
    ),
    ...model.sections.flatMap((section) => [
      wordParagraph(section.heading, 'Heading1'),
      ...section.paragraphs.map((paragraph) => wordParagraph(paragraph)),
    ]),
  ].join('');

  const files = {
    '[Content_Types].xml': xml(
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>',
    ),
    '_rels/.rels': xml(
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>',
    ),
    'word/document.xml': xml(
      `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr></w:body></w:document>`,
    ),
    'word/styles.xml': xml(
      '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:sz w:val="22"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:rPr><w:b/><w:sz w:val="36"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style></w:styles>',
    ),
    'docProps/core.xml': xml(
      `<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${escapeXml(model.title)}</dc:title><dc:creator>NILAM</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${escapeXml(model.generatedAt)}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${escapeXml(model.generatedAt)}</dcterms:modified></cp:coreProperties>`,
    ),
  };
  return zipSync(
    Object.fromEntries(
      Object.entries(files)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([path, body]) => [path, strToU8(body)]),
    ),
    { level: 0 },
  );
}

export async function renderDeterministicPdf(
  model: DprDocumentModel,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create({ updateMetadata: false });
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const fixedDate = new Date(model.generatedAt);
  pdf.setTitle(model.title);
  pdf.setAuthor('NILAM');
  pdf.setCreator('NILAM deterministic DPR renderer');
  pdf.setProducer('NILAM');
  pdf.setCreationDate(fixedDate);
  pdf.setModificationDate(fixedDate);

  let page = pdf.addPage([595.28, 841.89]);
  let y = 790;
  const addLine = (text: string, heading = false) => {
    const size = heading ? 15 : 9.5;
    const font = heading ? bold : regular;
    for (const line of wrapPdfText(asciiPdfText(text), heading ? 66 : 94)) {
      if (y < 55) {
        page = pdf.addPage([595.28, 841.89]);
        y = 790;
      }
      page.drawText(line, {
        x: 48,
        y,
        size,
        font,
        color: heading ? rgb(0.12, 0.19, 0.16) : rgb(0.15, 0.15, 0.14),
      });
      y -= heading ? 21 : 14;
    }
  };

  addLine(model.title, true);
  addLine(
    `Document version ${model.documentVersion} · generated ${model.generatedAt}`,
  );
  y -= 8;
  for (const section of model.sections) {
    addLine(section.heading, true);
    for (const paragraph of section.paragraphs) addLine(paragraph);
    y -= 8;
  }
  return pdf.save({ addDefaultPage: false, useObjectStreams: false });
}

function wordParagraph(text: string, style?: string): string {
  const property =
    style === undefined ? '' : `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>`;
  return `<w:p>${property}<w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
}

function xml(body: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${body}`;
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function wrapPdfText(text: string, width: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    if (`${line} ${word}`.trim().length > width && line.length > 0) {
      lines.push(line);
      line = word;
    } else {
      line = `${line} ${word}`.trim();
    }
  }
  if (line.length > 0) lines.push(line);
  return lines;
}

function asciiPdfText(value: string): string {
  return value
    .replaceAll('₹', 'INR ')
    .replaceAll('—', '-')
    .replaceAll('·', '-')
    .replace(/[^\x20-\x7E]/g, '?');
}

function formatInr(value: number): string {
  return `INR ${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}
