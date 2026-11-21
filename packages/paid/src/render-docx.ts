import { strToU8, zipSync } from 'fflate';

import type { DprDocumentModel, DprTable } from './documents';

/** Text width of an A4 page with 2 cm margins, in twentieths of a point. */
const TEXT_WIDTH = 9638;
const BRAND = '1C4D38';
const HEADER_FILL = 'DCEBE3';
const EMPHASIS_FILL = 'F2F4F2';
const KEY_FILL = 'F5F7F5';

export function renderDeterministicDocx(model: DprDocumentModel): Uint8Array {
  const body: string[] = [];

  if (model.cover !== undefined) {
    const cover = model.cover;
    body.push(
      paragraph('DETAILED PROJECT REPORT', { style: 'Subtitle' }),
      paragraph(model.title.replace(/^Detailed Project Report — /u, ''), {
        style: 'Title',
      }),
      paragraph(cover.subtitle, { style: 'Subtitle' }),
      paragraph(`Promoter: ${cover.preparedFor}`, { bold: true }),
      paragraph(
        `Prepared on ${cover.preparedOn} · document version ${model.documentVersion}`,
        { color: '6B706B' },
      ),
      table({
        columns: ['Item', 'Detail'],
        rows: cover.highlights.map(([label, value]) => [label, value]),
        header: false,
        widths: [1, 1],
      }),
      paragraph(
        'Prepared with NILAM from founder-supplied inputs. Projections are estimates for appraisal and are not a sanction, approval or guarantee by any bank or government body.',
        { color: '6B706B', size: 16 },
      ),
      pageBreak(),
      paragraph('Contents', { style: 'Heading1', outline: false }),
      tableOfContents(model),
      pageBreak(),
    );
  } else {
    body.push(
      paragraph(model.title, { style: 'Title' }),
      paragraph(
        `Document version ${model.documentVersion} · generated ${model.generatedAt}`,
      ),
    );
  }

  model.sections.forEach((section, index) => {
    if (
      model.cover !== undefined &&
      index > 0 &&
      /^(10\.|Annexure A)/u.test(section.heading)
    ) {
      body.push(pageBreak());
    }
    body.push(paragraph(section.heading, { style: 'Heading1' }));
    for (const text of section.paragraphs) body.push(paragraph(text));
    for (const entry of section.tables ?? []) {
      if (entry.caption !== undefined) {
        body.push(paragraph(entry.caption, { style: 'Caption' }));
      }
      body.push(table(entry), paragraph(''));
    }
    for (const note of section.notes ?? []) {
      body.push(paragraph(note, { color: '6B706B', size: 17 }));
    }
  });

  const footerLabel = `${model.title} · v${model.documentVersion}`;
  const files = {
    '[Content_Types].xml': xml(
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>',
    ),
    '_rels/.rels': xml(
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>',
    ),
    'word/_rels/document.xml.rels': xml(
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rIdSettings" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/><Relationship Id="rIdFooter1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>',
    ),
    'word/document.xml': xml(
      `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body.join('')}<w:sectPr><w:footerReference w:type="default" r:id="rIdFooter1"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/>${model.cover === undefined ? '' : '<w:titlePg/>'}</w:sectPr></w:body></w:document>`,
    ),
    'word/footer1.xml': xml(
      `<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:pStyle w:val="Footer"/><w:tabs><w:tab w:val="right" w:pos="${TEXT_WIDTH}"/></w:tabs></w:pPr>${run(footerLabel)}<w:r><w:tab/></w:r>${run('Page ')}<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r>${run('1')}<w:r><w:fldChar w:fldCharType="end"/></w:r></w:p></w:ftr>`,
    ),
    'word/settings.xml': xml(
      '<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:defaultTabStop w:val="720"/><w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat></w:settings>',
    ),
    'word/styles.xml': xml(
      `<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="21"/><w:lang w:val="en-IN"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="100" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:pPr><w:spacing w:before="240" w:after="120"/></w:pPr><w:rPr><w:b/><w:color w:val="${BRAND}"/><w:sz w:val="52"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:rPr><w:color w:val="4F6B5E"/><w:sz w:val="24"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="320" w:after="120"/><w:pBdr><w:left w:val="single" w:sz="24" w:space="6" w:color="${BRAND}"/></w:pBdr><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:color w:val="${BRAND}"/><w:sz w:val="28"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Caption"><w:name w:val="caption"/><w:pPr><w:keepNext/><w:spacing w:before="120" w:after="60"/></w:pPr><w:rPr><w:b/><w:sz w:val="19"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="TOC1"><w:name w:val="toc 1"/><w:pPr><w:tabs><w:tab w:val="right" w:leader="dot" w:pos="${TEXT_WIDTH}"/></w:tabs><w:spacing w:after="60"/></w:pPr></w:style><w:style w:type="paragraph" w:styleId="Footer"><w:name w:val="footer"/><w:rPr><w:color w:val="6B706B"/><w:sz w:val="16"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="TableText"><w:name w:val="Table Text"/><w:pPr><w:spacing w:before="20" w:after="20" w:line="240" w:lineRule="auto"/></w:pPr><w:rPr><w:sz w:val="17"/></w:rPr></w:style></w:styles>`,
    ),
    'docProps/core.xml': xml(
      `<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${escapeXml(model.title)}</dc:title><dc:creator>NILAM</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${escapeXml(model.generatedAt)}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${escapeXml(model.generatedAt)}</dcterms:modified></cp:coreProperties>`,
    ),
  };
  return zipSync(
    Object.fromEntries(
      Object.entries(files)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([path, content]) => [path, strToU8(content)]),
    ),
    { level: 0 },
  );
}

function tableOfContents(model: DprDocumentModel): string {
  // A real TOC field: Word and LibreOffice refresh page numbers on update;
  // the cached result lists every heading so it reads correctly unopened.
  const entries = model.sections
    .map(
      (section) =>
        `<w:p><w:pPr><w:pStyle w:val="TOC1"/></w:pPr>${run(section.heading)}</w:p>`,
    )
    .join('');
  return `<w:p><w:r><w:fldChar w:fldCharType="begin" w:dirty="true"/></w:r><w:r><w:instrText xml:space="preserve"> TOC \\o "1-1" \\h \\z \\u </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r></w:p>${entries}<w:p><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>`;
}

function table(entry: DprTable): string {
  const columns = entry.columns.length;
  const weights =
    entry.widths ??
    (entry.numeric === true
      ? [
          columns > 7 ? 2.6 : 2.4,
          ...Array.from({ length: columns - 1 }, () => 1),
        ]
      : Array.from({ length: columns }, (_, i) => (i === 0 ? 1.6 : 1)));
  const sum = weights.reduce((total, weight) => total + weight, 0);
  const widths = weights.map((weight) =>
    Math.round((weight / sum) * TEXT_WIDTH),
  );
  const size = columns > 9 ? 14 : columns > 6 ? 15 : 17;
  const emphasis = new Set(
    entry.emphasis === 'last'
      ? [entry.rows.length - 1]
      : (entry.emphasis ?? []),
  );
  const showHeader = entry.header !== false;
  const border = (side: string, sizeValue: number, color: string) =>
    `<w:${side} w:val="single" w:sz="${sizeValue}" w:space="0" w:color="${color}"/>`;

  const cell = (
    text: string,
    index: number,
    options: { bold?: boolean | undefined; fill?: string | undefined },
  ) => {
    const right = entry.numeric === true && index > 0;
    const shading =
      options.fill === undefined
        ? ''
        : `<w:shd w:val="clear" w:color="auto" w:fill="${options.fill}"/>`;
    return `<w:tc><w:tcPr><w:tcW w:w="${widths[index] ?? 1000}" w:type="dxa"/>${shading}</w:tcPr><w:p><w:pPr><w:pStyle w:val="TableText"/>${right ? '<w:jc w:val="right"/>' : ''}</w:pPr>${run(text, { bold: options.bold, size })}</w:p></w:tc>`;
  };

  const rows: string[] = [];
  if (showHeader) {
    rows.push(
      `<w:tr><w:trPr><w:tblHeader/><w:cantSplit/></w:trPr>${entry.columns
        .map((column, index) =>
          cell(column, index, { bold: true, fill: HEADER_FILL }),
        )
        .join('')}</w:tr>`,
    );
  }
  entry.rows.forEach((cells, rowIndex) => {
    const strong = emphasis.has(rowIndex);
    rows.push(
      `<w:tr><w:trPr><w:cantSplit/></w:trPr>${cells
        .map((text, index) =>
          cell(text, index, {
            bold: strong || (!showHeader && index === 0),
            fill: strong
              ? EMPHASIS_FILL
              : !showHeader && index === 0
                ? KEY_FILL
                : undefined,
          }),
        )
        .join('')}</w:tr>`,
    );
  });

  return `<w:tbl><w:tblPr><w:tblW w:w="${TEXT_WIDTH}" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders>${border('top', 8, BRAND)}${border('bottom', 4, 'C7CCC7')}${border('insideH', 4, 'C7CCC7')}</w:tblBorders><w:tblCellMar><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${widths
    .map((width) => `<w:gridCol w:w="${width}"/>`)
    .join('')}</w:tblGrid>${rows.join('')}</w:tbl>`;
}

function paragraph(
  text: string,
  options: {
    style?: string;
    bold?: boolean;
    color?: string;
    size?: number;
    outline?: boolean;
  } = {},
): string {
  const style =
    options.style === undefined
      ? ''
      : `<w:pStyle w:val="${options.style}"/>${options.outline === false ? '<w:outlineLvl w:val="9"/>' : ''}`;
  const properties = style.length === 0 ? '' : `<w:pPr>${style}</w:pPr>`;
  return `<w:p>${properties}${text.length === 0 ? '' : run(text, options)}</w:p>`;
}

function run(
  text: string,
  options: {
    bold?: boolean | undefined;
    color?: string | undefined;
    size?: number | undefined;
  } = {},
): string {
  const props = [
    options.bold === true ? '<w:b/>' : '',
    options.color === undefined ? '' : `<w:color w:val="${options.color}"/>`,
    options.size === undefined ? '' : `<w:sz w:val="${options.size}"/>`,
  ].join('');
  return `<w:r>${props.length === 0 ? '' : `<w:rPr>${props}</w:rPr>`}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
}

function pageBreak(): string {
  return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
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
