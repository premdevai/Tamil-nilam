'use client';

import { buildDprFinancials, dprFinancialInputSchema } from '@nilam/paid';
import { useMemo, useState } from 'react';

const emptyForm = {
  businessName: '',
  promoterName: '',
  entityKind: 'Proprietorship',
  sector: 'Food processing',
  district: 'Thanjavur',
  location: '',
  promoterProfile: '',
  projectDescription: '',
  productsAndCapacity: '',
  marketAndSales: '',
  employment: '12',
  implementationMonths: '8',
  projectCost: '1000000',
  landAndBuildingCost: '200000',
  landCost: '',
  plantAndMachineryCost: '500000',
  otherFixedCost: '100000',
  workingCapital: '200000',
  promoterContribution: '250000',
  termLoan: '750000',
  otherFunding: '0',
  capitalSubsidy: '',
  subsidySchemeName: '',
  projectedAnnualRevenue: '1500000',
  projectedAnnualOperatingCost: '1100000',
  variableCostSharePct: '',
  startUtilisationPct: '',
  maxUtilisationPct: '',
  revenueGrowthPct: '',
  loanInterestRatePct: '',
  interestSubventionPct: '',
  loanTenureYears: '',
  moratoriumMonths: '',
  taxRatePct: '',
  assumptions: 'Sales volume reaches 60% capacity in year one.',
  licences: '',
  citationTitle: 'Verified scheme source',
  citationUrl: 'https://example.gov.in/scheme',
  citationVerifiedOn: '2026-08-20',
};

export type DprPrefill = Partial<typeof emptyForm>;
type FormKey = keyof typeof emptyForm;

const REQUIRED_NUMBERS = [
  'projectCost',
  'landAndBuildingCost',
  'plantAndMachineryCost',
  'otherFixedCost',
  'workingCapital',
  'promoterContribution',
  'termLoan',
  'otherFunding',
  'projectedAnnualRevenue',
  'projectedAnnualOperatingCost',
  'employment',
  'implementationMonths',
] as const satisfies readonly FormKey[];

const OPTIONAL_NUMBERS = [
  'landCost',
  'capitalSubsidy',
  'variableCostSharePct',
  'startUtilisationPct',
  'maxUtilisationPct',
  'revenueGrowthPct',
  'loanInterestRatePct',
  'interestSubventionPct',
  'loanTenureYears',
  'moratoriumMonths',
  'taxRatePct',
] as const satisfies readonly FormKey[];

const OPTIONAL_TEXT = [
  'entityKind',
  'location',
  'promoterProfile',
  'projectDescription',
  'productsAndCapacity',
  'marketAndSales',
  'subsidySchemeName',
] as const satisfies readonly FormKey[];

const STEPS = [
  'Business',
  'Cost & funding',
  'Operations & loan',
  'Review',
] as const;

type FieldKind = 'money' | 'number' | 'text' | 'area' | 'entity';
type FieldSpec = readonly [
  key: FormKey,
  label: string,
  kind: FieldKind,
  hint?: string,
];

const STEP_FIELDS: readonly (readonly FieldSpec[])[] = [
  [
    ['businessName', 'Business name', 'text'],
    ['promoterName', 'Promoter name', 'text'],
    ['entityKind', 'Constitution', 'entity'],
    ['sector', 'Activity / sector', 'text'],
    ['district', 'District', 'text'],
    ['location', 'Site address or industrial estate', 'text'],
    ['employment', 'People employed', 'number'],
    ['implementationMonths', 'Months to start production', 'number'],
    [
      'promoterProfile',
      'Promoter profile',
      'area',
      'Education, experience, EDP training and any family business background.',
    ],
    [
      'projectDescription',
      'Project summary',
      'area',
      'One paragraph a bank manager can read in a minute.',
    ],
    ['productsAndCapacity', 'Products, process and installed capacity', 'area'],
    [
      'marketAndSales',
      'Market and sales plan',
      'area',
      'Who buys, at what price, through which channels; any orders or letters of intent.',
    ],
  ],
  [
    ['landAndBuildingCost', 'Land and building', 'money'],
    [
      'landCost',
      'of which land (not depreciated)',
      'money',
      'Leave blank if you lease the site or the shed is allotted.',
    ],
    ['plantAndMachineryCost', 'Plant and machinery', 'money'],
    [
      'otherFixedCost',
      'Other fixed assets',
      'money',
      'Electrification, furniture, pre-operative expenses, contingency.',
    ],
    ['workingCapital', 'Working capital margin', 'money'],
    ['projectCost', 'Total project cost', 'money'],
    ['promoterContribution', 'Promoter contribution', 'money'],
    ['termLoan', 'Term loan', 'money'],
    ['otherFunding', 'Other funding', 'money'],
    [
      'capitalSubsidy',
      'Capital subsidy expected',
      'money',
      'Credited to the loan after production starts; not a day-one source.',
    ],
    [
      'subsidySchemeName',
      'Scheme name',
      'text',
      'For example NEEDS, PMEGP or UYEGP.',
    ],
  ],
  [
    ['projectedAnnualRevenue', 'Year-1 revenue', 'money'],
    [
      'projectedAnnualOperatingCost',
      'Year-1 operating cost (before interest and depreciation)',
      'money',
    ],
    [
      'variableCostSharePct',
      'Variable share of operating cost (%)',
      'number',
      'Default 70%.',
    ],
    [
      'startUtilisationPct',
      'Year-1 capacity utilisation (%)',
      'number',
      'Default 60%.',
    ],
    [
      'maxUtilisationPct',
      'Steady-state utilisation (%)',
      'number',
      'Default 85%.',
    ],
    [
      'revenueGrowthPct',
      'Annual price and cost escalation (%)',
      'number',
      'Default 5%.',
    ],
    [
      'loanInterestRatePct',
      'Loan interest rate (%)',
      'number',
      'Default 10.5%.',
    ],
    [
      'interestSubventionPct',
      'Interest subvention (%)',
      'number',
      'NEEDS gives 3%.',
    ],
    [
      'loanTenureYears',
      'Loan tenure (years, incl. moratorium)',
      'number',
      'Default 7.',
    ],
    ['moratoriumMonths', 'Moratorium (months)', 'number', 'Default 12.'],
    ['taxRatePct', 'Income-tax rate (%)', 'number', 'Default 25%.'],
  ],
  [
    ['assumptions', 'Assumptions (one per line)', 'area'],
    ['licences', 'Licences and approvals (one per line)', 'area'],
    ['citationTitle', 'Source title', 'text'],
    ['citationUrl', 'Source URL', 'text'],
    ['citationVerifiedOn', 'Source verified on (YYYY-MM-DD)', 'text'],
  ],
];

export function DprWizard({
  initialProfile = {},
}: {
  readonly initialProfile?: DprPrefill;
}) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ ...emptyForm, ...initialProfile });
  const [message, setMessage] = useState<string>();
  const [needsUnlock, setNeedsUnlock] = useState(false);
  const [busy, setBusy] = useState(false);

  const set = (key: FormKey, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const itemised =
    num(form.landAndBuildingCost) +
    num(form.plantAndMachineryCost) +
    num(form.otherFixedCost) +
    num(form.workingCapital);
  const funded =
    num(form.promoterContribution) +
    num(form.termLoan) +
    num(form.otherFunding);

  const parsed = useMemo(
    () => dprFinancialInputSchema.safeParse(toInput(form)),
    [form],
  );
  const preview = useMemo(
    () => (parsed.success ? buildDprFinancials(parsed.data) : null),
    [parsed],
  );

  async function queue(): Promise<'ok' | 'unlock' | 'error'> {
    if (!parsed.success) return 'error';
    const response = await fetch('/api/dprs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        input: parsed.data,
        idempotencyKey: crypto.randomUUID(),
      }),
    });
    const result = (await response.json().catch(() => ({}))) as {
      error?: string;
      validationWarnings?: string[];
    };
    if (response.ok) {
      setMessage(
        `Your DPR is being generated${result.validationWarnings?.length ? ` with ${result.validationWarnings.length} note(s) to review` : ''}. It appears under “Your reports” in a few seconds.`,
      );
      window.dispatchEvent(new Event('nilam:dpr-queued'));
      return 'ok';
    }
    if (result.error === 'paid_entitlement_required') return 'unlock';
    setMessage('Could not queue this DPR. Check the totals and try again.');
    return 'error';
  }

  async function generate() {
    setBusy(true);
    setMessage(undefined);
    const outcome = await queue();
    setNeedsUnlock(outcome === 'unlock');
    if (outcome === 'unlock') {
      setMessage(
        'Generating a DPR uses one DPR credit, and this account has none left.',
      );
    }
    setBusy(false);
  }

  async function unlockAndGenerate() {
    setBusy(true);
    const checkout = await fetch('/api/payments/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        plan: 'dpr_once',
        idempotencyKey: crypto.randomUUID(),
      }),
    });
    const order = (await checkout.json().catch(() => ({}))) as {
      paymentId?: string;
      testMode?: boolean;
    };
    if (
      !checkout.ok ||
      order.paymentId === undefined ||
      order.testMode !== true
    ) {
      // Live checkout happens on the billing page.
      window.location.assign('/account/billing');
      return;
    }
    const completed = await fetch('/api/payments/fake-complete', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ paymentId: order.paymentId }),
    });
    if (!completed.ok) {
      setBusy(false);
      setMessage('The test payment could not be completed.');
      return;
    }
    const outcome = await queue();
    setNeedsUnlock(outcome === 'unlock');
    setBusy(false);
  }

  return (
    <section className="account-card dpr-wizard">
      <h2>Build your detailed project report</h2>
      <p>
        A bank-style DPR in Word and PDF: cost and means of finance, 7-year
        profitability, cash flow and balance sheet, loan repayment, DSCR,
        break-even, IRR and sensitivity. Blank optional fields use the defaults
        shown.
      </p>
      <ol className="dpr-steps">
        {STEPS.map((label, index) => (
          <li key={label} className={step === index ? 'current' : undefined}>
            <button type="button" onClick={() => setStep(index)}>
              {index + 1}. {label}
            </button>
          </li>
        ))}
      </ol>

      <div className="dpr-layout">
        <div>
          <div
            className={`account-form ${step === 0 || step === 3 ? 'dpr-business' : 'dpr-finance'}`}
          >
            {(STEP_FIELDS[step] ?? []).map(([key, label, kind, hint]) => (
              <Field
                key={key}
                label={label}
                kind={kind}
                hint={hint}
                value={form[key]}
                onChange={(value) => set(key, value)}
              />
            ))}
          </div>

          {step === 1 ? (
            <div className="dpr-balance">
              <p>
                Itemised cost <strong>{inr(itemised)}</strong> · Project cost{' '}
                <strong>{inr(num(form.projectCost))}</strong> · Funding{' '}
                <strong>{inr(funded)}</strong>
              </p>
              {itemised !== num(form.projectCost) || funded !== itemised ? (
                <button
                  className="button-secondary"
                  type="button"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      projectCost: String(itemised),
                      termLoan: String(
                        Math.max(
                          0,
                          itemised -
                            num(current.promoterContribution) -
                            num(current.otherFunding),
                        ),
                      ),
                    }))
                  }
                >
                  Balance: project cost = itemised total, loan = the gap
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        <aside className="dpr-preview" aria-live="polite">
          <h3>Bank view</h3>
          {preview === null ? (
            <p>Complete the totals to see DSCR, IRR and break-even.</p>
          ) : (
            <>
              <dl>
                <Metric
                  label="Average DSCR"
                  value={fixed(preview.averageDscr)}
                  tone={tone(preview.averageDscr, 1.5)}
                />
                <Metric
                  label="Minimum DSCR"
                  value={fixed(preview.minimumDscr)}
                  tone={tone(preview.minimumDscr, 1.2)}
                />
                <Metric
                  label="Project IRR"
                  value={
                    preview.irrPct === null
                      ? 'n/a'
                      : `${preview.irrPct.toFixed(1)}%`
                  }
                />
                <Metric
                  label="Break-even"
                  value={
                    preview.breakEven.breakEvenPct === null
                      ? 'n/a'
                      : `${preview.breakEven.breakEvenPct.toFixed(0)}% capacity`
                  }
                />
                <Metric
                  label="Payback"
                  value={
                    preview.paybackYears === null
                      ? 'beyond period'
                      : `${preview.paybackYears.toFixed(1)} years`
                  }
                />
                <Metric
                  label="Year-3 profit after tax"
                  value={inr(preview.years[2]?.pat ?? 0)}
                />
              </dl>
              {preview.warnings.length > 0 ? (
                <ul className="dpr-flags">
                  {preview.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              ) : (
                <p className="dpr-ok">
                  Meets common bank thresholds: average DSCR at least 1.5 and no
                  year below 1.2.
                </p>
              )}
            </>
          )}
        </aside>
      </div>

      {parsed.success ? null : (
        <div className="alert alert-error" role="alert">
          <strong>Fix these before generating:</strong>
          <ul>
            {parsed.error.issues.slice(0, 6).map((issue) => (
              <li key={`${issue.path.join('.')}:${issue.message}`}>
                {labelFor(issue.path.join('.'))}: {issue.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="button-row">
        <button
          className="button-secondary"
          disabled={step === 0 || busy}
          type="button"
          onClick={() => setStep((current) => Math.max(0, current - 1))}
        >
          Back
        </button>
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={() => setStep((current) => current + 1)}
          >
            Next
          </button>
        ) : needsUnlock ? (
          <button
            disabled={!parsed.success || busy}
            type="button"
            onClick={() => void unlockAndGenerate()}
          >
            {busy ? 'Working…' : 'Unlock one DPR and generate'}
          </button>
        ) : (
          <button
            disabled={!parsed.success || busy}
            type="button"
            onClick={() => void generate()}
          >
            {busy ? 'Queuing…' : 'Generate Word and PDF'}
          </button>
        )}
      </div>
      {message === undefined ? null : (
        <p className="notice" role="status">
          {message}
        </p>
      )}
    </section>
  );
}

function Metric({
  label,
  value,
  tone: toneClass,
}: {
  readonly label: string;
  readonly value: string;
  readonly tone?: string | undefined;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd className={toneClass}>{value}</dd>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  kind,
  hint,
}: {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly kind: FieldKind;
  readonly hint?: string | undefined;
}) {
  const money =
    kind === 'money' && value.trim() !== '' && Number.isFinite(Number(value));
  return (
    <label className={kind === 'area' ? 'dpr-wide' : undefined}>
      {label}
      {kind === 'area' ? (
        <textarea
          rows={3}
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
        />
      ) : kind === 'entity' ? (
        <select
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
        >
          {[
            'Proprietorship',
            'Partnership',
            'Limited liability partnership',
            'Private limited company',
          ].map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      ) : (
        <input
          inputMode={
            kind === 'money' || kind === 'number' ? 'decimal' : undefined
          }
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
        />
      )}
      {money ? <small>{inr(Number(value))}</small> : null}
      {hint === undefined ? null : <small>{hint}</small>}
    </label>
  );
}

function num(value: string): number {
  const parsed = Number(value);
  return value.trim() === '' || !Number.isFinite(parsed) ? 0 : parsed;
}

function toInput(form: typeof emptyForm) {
  const input: Record<string, unknown> = {
    businessName: form.businessName,
    promoterName: form.promoterName,
    sector: form.sector,
    district: form.district,
    assumptions: lines(form.assumptions),
    citations: [
      {
        title: form.citationTitle,
        url: form.citationUrl,
        verifiedOn: form.citationVerifiedOn,
      },
    ],
  };
  for (const key of REQUIRED_NUMBERS) input[key] = Number(form[key]);
  for (const key of OPTIONAL_NUMBERS) {
    if (form[key].trim() !== '') input[key] = Number(form[key]);
  }
  for (const key of OPTIONAL_TEXT) {
    if (form[key].trim() !== '') input[key] = form[key].trim();
  }
  const licences = lines(form.licences);
  if (licences.length > 0) input.licences = licences;
  return input;
}

function lines(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function inr(value: number): string {
  if (Math.abs(value) >= 100_000) {
    return `₹${(value / 100_000).toLocaleString('en-IN', { maximumFractionDigits: 2 })} lakh`;
  }
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}

function fixed(value: number | null): string {
  return value === null ? 'n/a' : value.toFixed(2);
}

function tone(value: number | null, threshold: number): string | undefined {
  if (value === null) return undefined;
  return value >= threshold ? 'dpr-good' : 'dpr-weak';
}

function labelFor(path: string): string {
  for (const fields of STEP_FIELDS) {
    const match = fields.find(([key]) => key === path);
    if (match !== undefined) return match[1];
  }
  if (path.startsWith('citations')) return 'Source';
  return path.length === 0 ? 'Form' : path;
}
