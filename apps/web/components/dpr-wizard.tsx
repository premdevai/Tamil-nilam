'use client';

import { dprFinancialInputSchema } from '@nilam/paid';
import { useMemo, useState } from 'react';

const emptyForm = {
  businessName: '',
  promoterName: '',
  sector: 'Food processing',
  district: 'Thanjavur',
  projectCost: '1000000',
  landAndBuildingCost: '200000',
  plantAndMachineryCost: '500000',
  otherFixedCost: '100000',
  workingCapital: '200000',
  promoterContribution: '250000',
  termLoan: '750000',
  otherFunding: '0',
  projectedAnnualRevenue: '1500000',
  projectedAnnualOperatingCost: '1100000',
  employment: '12',
  implementationMonths: '8',
  assumptions: 'Sales volume reaches 70% capacity in year one.',
  citationTitle: 'Verified scheme source',
  citationUrl: 'https://example.gov.in/scheme',
  citationVerifiedOn: '2026-08-20',
};

export type DprPrefill = Partial<typeof emptyForm>;

export function DprWizard({
  initialProfile = {},
}: {
  readonly initialProfile?: DprPrefill;
}) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ ...emptyForm, ...initialProfile });
  const [message, setMessage] = useState<string>();
  const [busy, setBusy] = useState(false);

  const parsed = useMemo(
    () =>
      dprFinancialInputSchema.safeParse({
        ...numericFields(form),
        businessName: form.businessName,
        promoterName: form.promoterName,
        sector: form.sector,
        district: form.district,
        assumptions: form.assumptions
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.length > 0),
        citations: [
          {
            title: form.citationTitle,
            url: form.citationUrl,
            verifiedOn: form.citationVerifiedOn,
          },
        ],
      }),
    [form],
  );

  async function generate() {
    if (!parsed.success) return;
    setBusy(true);
    const response = await fetch('/api/dprs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        input: parsed.data,
        idempotencyKey: crypto.randomUUID(),
      }),
    });
    const result = (await response.json()) as {
      id?: string;
      error?: string;
      validationWarnings?: string[];
    };
    setBusy(false);
    setMessage(
      response.ok
        ? `DPR queued${result.validationWarnings?.length ? ` with ${result.validationWarnings.length} warning(s)` : ''}.`
        : result.error === 'paid_entitlement_required'
          ? 'A paid DPR entitlement is required.'
          : 'Could not queue this DPR. Check the financial totals.',
    );
  }

  return (
    <section className="account-card">
      <h2>Guided DPR inputs</h2>
      <p>
        Totals must balance. The generated Word and PDF files include cited
        annexures and an explicit non-approval disclaimer.
      </p>
      <ol className="dpr-steps">
        <li className={step === 0 ? 'current' : undefined}>Business</li>
        <li className={step === 1 ? 'current' : undefined}>Finance</li>
        <li className={step === 2 ? 'current' : undefined}>Evidence</li>
      </ol>
      {step === 0 ? (
        <div className="account-form">
          <Field
            label="Business name"
            value={form.businessName}
            onChange={(value) =>
              setForm((current) => ({ ...current, businessName: value }))
            }
          />
          <Field
            label="Promoter name"
            value={form.promoterName}
            onChange={(value) =>
              setForm((current) => ({ ...current, promoterName: value }))
            }
          />
          <Field
            label="Sector"
            value={form.sector}
            onChange={(value) =>
              setForm((current) => ({ ...current, sector: value }))
            }
          />
          <Field
            label="District"
            value={form.district}
            onChange={(value) =>
              setForm((current) => ({ ...current, district: value }))
            }
          />
        </div>
      ) : null}
      {step === 1 ? (
        <div className="account-form dpr-finance">
          {(
            [
              ['projectCost', 'Project cost (INR)'],
              ['landAndBuildingCost', 'Land and building'],
              ['plantAndMachineryCost', 'Plant and machinery'],
              ['otherFixedCost', 'Other fixed cost'],
              ['workingCapital', 'Working capital'],
              ['promoterContribution', 'Promoter contribution'],
              ['termLoan', 'Term loan'],
              ['otherFunding', 'Other funding'],
              ['projectedAnnualRevenue', 'Projected annual revenue'],
              [
                'projectedAnnualOperatingCost',
                'Projected annual operating cost',
              ],
              ['employment', 'Employment'],
              ['implementationMonths', 'Implementation months'],
            ] as const
          ).map(([key, label]) => (
            <Field
              key={key}
              label={label}
              value={form[key]}
              onChange={(value) =>
                setForm((current) => ({ ...current, [key]: value }))
              }
            />
          ))}
        </div>
      ) : null}
      {step === 2 ? (
        <div className="account-form">
          <label>
            Assumptions
            <textarea
              rows={4}
              value={form.assumptions}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  assumptions: event.currentTarget.value,
                }))
              }
            />
          </label>
          <Field
            label="Citation title"
            value={form.citationTitle}
            onChange={(value) =>
              setForm((current) => ({ ...current, citationTitle: value }))
            }
          />
          <Field
            label="Citation URL"
            value={form.citationUrl}
            onChange={(value) =>
              setForm((current) => ({ ...current, citationUrl: value }))
            }
          />
          <Field
            label="Verified on"
            value={form.citationVerifiedOn}
            onChange={(value) =>
              setForm((current) => ({ ...current, citationVerifiedOn: value }))
            }
          />
        </div>
      ) : null}
      {parsed.success ? null : (
        <div className="alert alert-error" role="alert">
          <strong>Fix the highlighted totals before generating.</strong>
          <ul>
            {parsed.error.issues.slice(0, 6).map((issue) => (
              <li key={issue.path.join('.')}>{issue.message}</li>
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
        {step < 2 ? (
          <button
            type="button"
            onClick={() => setStep((current) => current + 1)}
          >
            Next
          </button>
        ) : (
          <button
            disabled={!parsed.success || busy}
            type="button"
            onClick={() => void generate()}
          >
            Queue Word and PDF
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

function Field({
  label,
  value,
  onChange,
}: {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
}) {
  return (
    <label>
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </label>
  );
}

function numericFields(form: typeof emptyForm) {
  return {
    projectCost: Number(form.projectCost),
    landAndBuildingCost: Number(form.landAndBuildingCost),
    plantAndMachineryCost: Number(form.plantAndMachineryCost),
    otherFixedCost: Number(form.otherFixedCost),
    workingCapital: Number(form.workingCapital),
    promoterContribution: Number(form.promoterContribution),
    termLoan: Number(form.termLoan),
    otherFunding: Number(form.otherFunding),
    projectedAnnualRevenue: Number(form.projectedAnnualRevenue),
    projectedAnnualOperatingCost: Number(form.projectedAnnualOperatingCost),
    employment: Number(form.employment),
    implementationMonths: Number(form.implementationMonths),
  };
}
