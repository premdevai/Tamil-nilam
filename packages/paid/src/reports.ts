import type { DprDocumentModel } from './documents';

const DISCLAIMER =
  'This report is directional planning support, not legal, tax, investment, credit or bank-sanction advice. Eligibility, benefits, land availability and financing remain subject to the cited authority and the relevant institution’s independent review. NILAM does not claim government, legal or bank approval.';

export type PrintableReportSource = {
  title: string;
  generatedAt: string;
  documentVersion: number;
  asOf: string;
  rulesetVersion: string;
  rulesetHash: string;
  district: string;
  sector: string;
  totalLakhs: number;
  eligible: ReadonlyArray<{
    schemeId: string;
    name: string;
    totalLakhs: number;
  }>;
  warnings: readonly string[];
  citations: ReadonlyArray<{
    title: string;
    url: string;
    verifiedOn: string;
  }>;
};

export function buildPrintableReportModel(
  source: PrintableReportSource,
): DprDocumentModel {
  return {
    title: source.title,
    documentVersion: source.documentVersion,
    generatedAt: source.generatedAt,
    sections: [
      {
        heading: 'Matcher summary',
        paragraphs: [
          `District: ${source.district}`,
          `Sector: ${source.sector}`,
          `Evaluated as of: ${source.asOf}`,
          `Ruleset: ${source.rulesetVersion}`,
          `Ruleset snapshot hash: ${source.rulesetHash}`,
          `Directional calculated assistance: INR ${source.totalLakhs.toLocaleString('en-IN')} lakh`,
        ],
      },
      {
        heading: 'Eligible schemes after conflict resolution',
        paragraphs:
          source.eligible.length === 0
            ? ['No published schemes were retained on the supplied facts.']
            : source.eligible.map(
                (scheme) =>
                  `${scheme.name} (${scheme.schemeId}): INR ${scheme.totalLakhs.toLocaleString('en-IN')} lakh`,
              ),
      },
      {
        heading: 'Validation warnings',
        paragraphs:
          source.warnings.length > 0
            ? source.warnings.map((warning) => `Warning: ${warning}`)
            : ['No automated validation warnings were raised.'],
      },
      {
        heading: 'Cited annexure',
        paragraphs: source.citations.map(
          (citation) =>
            `${citation.title} — verified ${citation.verifiedOn} — ${citation.url}`,
        ),
      },
      { heading: 'Important disclaimer', paragraphs: [DISCLAIMER] },
    ],
  };
}
