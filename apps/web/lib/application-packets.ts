import { randomUUID } from 'node:crypto';

import {
  getRuleset,
  type EvaluationResult,
  type MatcherInput,
} from '@nilam/engine';

import {
  emptyProjectCompanion,
  type ProjectCompanion,
} from './project-companion';
import { tansidcoApplyUrl } from './tansidco-estates';

export type ApplicationPacket = {
  readonly schemeId: string;
  readonly name: string;
  readonly kind: 'calculated' | 'official-door';
  readonly cashLakhs: number;
  readonly officialUrl: string;
  readonly organisation: string;
  readonly askTheOffice: string;
  readonly documents: readonly {
    readonly key: string;
    readonly label: string;
    readonly required: boolean;
  }[];
  readonly note: string;
};

const COMMON_DOCS = [
  { key: 'udyam', label: 'Udyam registration', required: true },
  { key: 'id-proof', label: 'Aadhaar / PAN of promoter', required: true },
  { key: 'dpr', label: 'Project report / DPR', required: true },
] as const;

export function buildApplicationPackets(
  result: EvaluationResult,
): readonly ApplicationPacket[] {
  const ruleset = getRuleset(result.rulesetVersion);
  const calculated = result.eligible.flatMap((scheme) => {
    const record = ruleset.records.find((item) => item.id === scheme.schemeId);
    if (record === undefined || record.status !== 'published') return [];
    const citation = record.citations[0];
    const firstStep = record.steps[0];
    return [
      {
        schemeId: record.id,
        name: record.name,
        kind: 'calculated' as const,
        cashLakhs: scheme.totalLakhs,
        officialUrl: citation?.url ?? tansidcoApplyUrl(),
        organisation: firstStep?.organisation ?? record.department,
        askTheOffice:
          record.id === 'needs'
            ? 'Ask the DIC/bank to write NEEDS tagging on the sanction letter itself.'
            : 'Ask the office to confirm this profile in writing before treating the stack as final.',
        documents: [...COMMON_DOCS],
        note:
          record.caveats[0] ??
          'Directional pre-DPR estimate. Confirm the current order at the official source.',
      },
    ];
  });

  return [...calculated, ...officialDoors(result.input)].sort((left, right) =>
    left.schemeId.localeCompare(right.schemeId),
  );
}

function officialDoors(input: MatcherInput): readonly ApplicationPacket[] {
  const doors: ApplicationPacket[] = [
    {
      schemeId: 'tansidco-plot',
      name: 'TANSIDCO plot application',
      kind: 'official-door',
      cashLakhs: 0,
      officialUrl: tansidcoApplyUrl(),
      organisation: 'TANSIDCO',
      askTheOffice:
        'Request current written vacancy, rate, tenure and EMD before paying. The matcher snapshot is not an allotment letter.',
      documents: [
        { key: 'emd', label: 'EMD / application fee proof', required: true },
        {
          key: 'needs-letter',
          label: 'NEEDS provisional letter if claiming preference',
          required: false,
        },
      ],
      note: 'Land ranking uses the TANSIDCO vacancy snapshot only. SIPCOT and SIDCO are not in that chart.',
    },
  ];

  if (['food-processing', 'manufacturing', 'services'].includes(input.sector)) {
    doors.push({
      schemeId: 'tn-capital-subsidy',
      name: 'Tamil Nadu MSME Capital Subsidy',
      kind: 'official-door',
      cashLakhs: 0,
      officialUrl: 'https://msmeonline.tn.gov.in/incentives/html_cye_CS.php',
      organisation: 'District Industries Centre / MSME online',
      askTheOffice:
        'Ask whether this unit is under NEEDS or the general capital-subsidy route. Do not stack both without written confirmation.',
      documents: [...COMMON_DOCS],
      note: 'Official and live on the portal. NILAM does not calculate the amount — exclusions and the governing G.O. are not fully pinned.',
    });
  }

  if (input.specialCategory !== 'none') {
    doors.push({
      schemeId: 'aabcs',
      name: 'Annal Ambedkar Business Champions Scheme',
      kind: 'official-door',
      cashLakhs: 0,
      officialUrl: 'http://www.msmeonline.tn.gov.in/aabcs/index.php',
      organisation: 'Tamil Nadu MSME Department',
      askTheOffice:
        'Confirm community eligibility and whether AABCS replaces or sits beside NEEDS for this unit.',
      documents: [
        ...COMMON_DOCS,
        {
          key: 'community',
          label: 'Community / special-category certificate',
          required: true,
        },
      ],
      note: 'Dashboard is live. Operative G.O. and full eligibility text are still pending review, so no cash is shown.',
    });
  }

  if (input.backwardBlock) {
    doors.push({
      schemeId: 'tn-stamp-duty-reimbursement',
      name: 'Stamp duty and registration concession',
      kind: 'official-door',
      cashLakhs: 0,
      officialUrl: 'http://www.msmeonline.tn.gov.in/incentives/index.php',
      organisation: 'DIC / Sub-registrar',
      askTheOffice:
        'Ask for the current backward-block notification and whether this plot is inside it.',
      documents: [
        {
          key: 'sale-deed',
          label: 'Draft sale / lease deed',
          required: true,
        },
      ],
      note: 'The incentive category is live. Rate and eligibility are not calculated here.',
    });
  }

  return doors;
}

export function companionFromPackets(
  packets: readonly ApplicationPacket[],
  now = new Date().toISOString(),
): ProjectCompanion {
  const documents = [
    ...new Map(
      packets.flatMap((packet) =>
        packet.documents.map((document) => [
          document.key,
          {
            key: document.key,
            label: document.label,
            required: document.required,
            status: 'missing' as const,
            expiresOn: null,
            evidenceUrl: '',
          },
        ]),
      ),
    ).values(),
  ];
  return {
    ...emptyProjectCompanion(),
    readiness: {
      profileFacts: {},
      documents,
      blockers: [],
      confirmedAssumptions: [],
      applicationReady: false,
      updatedAt: now,
    },
    tasks: packets.map((packet) => ({
      id: randomUUID(),
      title: packet.name,
      owner: 'Founder',
      reason: packet.askTheOffice,
      deadlineOn: null,
      officialUrl: packet.officialUrl,
      applicationId: '',
      followUpOn: null,
      proofUrl: '',
      completedAt: null,
      queryLog: [],
      createdAt: now,
    })),
  };
}
