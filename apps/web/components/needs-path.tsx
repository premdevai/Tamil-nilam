'use client';

import { useEffect, useMemo, useState } from 'react';

import {
  BUSINESS_GROUPS,
  DEFAULT_NEEDS_BUSINESS,
  DPR_READY_DOCUMENTS,
  NEEDS_BUSINESSES,
  NEEDS_ROADMAP,
  type BusinessGroup,
  type FounderCategory,
  type FounderProfile,
  dprPrefillQuery,
  formatLakhs,
  getNeedsBusiness,
  needsEligibility,
  needsFundingPlan,
} from '../lib/needs-path';

export type NeedsEstate = {
  readonly name: string;
  readonly district: string;
  readonly block: string | null;
  readonly backward: boolean;
  readonly industrialPlots: number;
  readonly sheds: number;
  readonly cheapestPlotRs: number | null;
  readonly cheapestPlotAcres: number | null;
  readonly phone: string | null;
};

type SavedState = {
  readonly businessId: string;
  readonly projectLakhs: number;
  readonly profile: FounderProfile;
  readonly stepsDone: Readonly<Record<string, boolean>>;
  readonly docsReady: Readonly<Record<string, boolean>>;
};

const STORAGE_KEY = 'nilam-needs-path-v1';

const DEFAULT_PROFILE: FounderProfile = {
  name: '',
  age: null,
  category: 'special',
  education: '12th-iti-diploma',
  firstGeneration: null,
  tnResident3Years: null,
  district: 'Kallakurichi',
};

const STATUS_MARK = { pass: '✓', fail: '✕', check: '?' } as const;
const STATUS_TEXT = {
  pass: 'Looks fine',
  fail: 'Does not match',
  check: 'Answer to check',
} as const;

function loadSaved(): Partial<SavedState> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw === null ? {} : (JSON.parse(raw) as Partial<SavedState>);
  } catch {
    return {};
  }
}

function yesNo(value: boolean | null): string {
  return value === null ? '' : value ? 'yes' : 'no';
}

function fromYesNo(value: string): boolean | null {
  return value === '' ? null : value === 'yes';
}

export function NeedsPath({
  districts,
  estates,
  landSnapshotDate,
  tansidcoUrl,
}: {
  readonly districts: readonly string[];
  readonly estates: readonly NeedsEstate[];
  readonly landSnapshotDate: string;
  readonly tansidcoUrl: string;
}) {
  const [group, setGroup] = useState<BusinessGroup | 'all'>('all');
  const [businessId, setBusinessId] = useState(DEFAULT_NEEDS_BUSINESS.id);
  const [projectLakhs, setProjectLakhs] = useState(
    DEFAULT_NEEDS_BUSINESS.typicalLakhs,
  );
  const [profile, setProfile] = useState<FounderProfile>(DEFAULT_PROFILE);
  const [stepsDone, setStepsDone] = useState<Record<string, boolean>>({});
  const [docsReady, setDocsReady] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);

  // Restore this device's saved progress after hydration (same pattern as
  // the playbook progress in nilam-app.tsx).
  useEffect(() => {
    const saved = loadSaved();
    const frame = requestAnimationFrame(() => {
      if (
        saved.businessId !== undefined &&
        getNeedsBusiness(saved.businessId)
      ) {
        setBusinessId(saved.businessId);
      }
      if (typeof saved.projectLakhs === 'number') {
        setProjectLakhs(saved.projectLakhs);
      }
      if (saved.profile !== undefined) {
        setProfile({ ...DEFAULT_PROFILE, ...saved.profile });
      }
      if (saved.stepsDone !== undefined) setStepsDone({ ...saved.stepsDone });
      if (saved.docsReady !== undefined) setDocsReady({ ...saved.docsReady });
      setLoaded(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      const state: SavedState = {
        businessId,
        projectLakhs,
        profile,
        stepsDone,
        docsReady,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage can be unavailable (private mode); the page still works.
    }
  }, [loaded, businessId, projectLakhs, profile, stepsDone, docsReady]);

  const business = getNeedsBusiness(businessId) ?? DEFAULT_NEEDS_BUSINESS;
  const plan = useMemo(
    () => needsFundingPlan(projectLakhs, profile.category, business.split),
    [projectLakhs, profile.category, business.split],
  );
  const checks = needsEligibility(profile);
  const visibleBusinesses = NEEDS_BUSINESSES.filter(
    (item) => group === 'all' || item.group === group,
  );
  const districtEstates = estates
    .filter((estate) => estate.district === profile.district)
    .slice()
    .sort(
      (a, b) => b.industrialPlots + b.sheds - (a.industrialPlots + a.sheds),
    );
  const stepsComplete = NEEDS_ROADMAP.filter(
    (step) => stepsDone[step.id],
  ).length;
  const docsComplete = DPR_READY_DOCUMENTS.filter(
    ([key]) => docsReady[key],
  ).length;
  const eligibilityClear = checks.every((check) => check.status === 'pass');
  const dprReady =
    eligibilityClear &&
    profile.name.trim().length >= 2 &&
    docsComplete === DPR_READY_DOCUMENTS.length;

  const chooseBusiness = (id: string) => {
    const next = getNeedsBusiness(id);
    if (next === undefined) return;
    setBusinessId(id);
    setProjectLakhs(next.typicalLakhs);
  };
  const updateProfile = (patch: Partial<FounderProfile>) =>
    setProfile((current) => ({ ...current, ...patch }));

  const youShare = (plan.yourContributionLakhs / plan.projectLakhs) * 100;
  const dprHref = `/account/dpr?${dprPrefillQuery({
    business,
    plan,
    promoterName: profile.name.trim() || 'Promoter',
    district: profile.district,
  })}`;

  return (
    <div className="needs-path">
      <nav className="needs-jump" aria-label="NEEDS path sections">
        {[
          ['business', '1 Business'],
          ['money', '2 Money'],
          ['you', '3 About you'],
          ['land', '4 Land'],
          ['roadmap', '5 Steps'],
          ['dpr', '6 DPR'],
        ].map(([id, label]) => (
          <a key={id} href={`#${id}`}>
            {label}
          </a>
        ))}
      </nav>

      {/* 1 ── Business */}
      <section id="business" aria-labelledby="needs-business-title">
        <p className="eyebrow">Step 1</p>
        <h2 id="needs-business-title">Pick a business that fits NEEDS</h2>
        <p>
          Manufacturing and manufacturing-linked services with real machinery
          qualify. Pure trading does not. Costs are NILAM planning ranges to
          start your DIC conversation — not quotations.
        </p>
        <div className="needs-chips" role="group" aria-label="Filter by sector">
          {[['all', 'All'] as const, ...BUSINESS_GROUPS].map(
            ([id, label]: readonly [BusinessGroup | 'all', string]) => (
              <button
                key={id}
                type="button"
                className="needs-chip"
                aria-pressed={group === id}
                onClick={() => setGroup(id)}
              >
                {label}
              </button>
            ),
          )}
        </div>
        <ul className="needs-business-grid">
          {visibleBusinesses.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="needs-business"
                aria-pressed={item.id === business.id}
                onClick={() => chooseBusiness(item.id)}
              >
                <span className="needs-business-name">{item.name}</span>
                <span className="needs-business-ta" lang="ta">
                  {item.nameTa}
                </span>
                <span className="needs-business-makes">{item.makes}</span>
                <span className="needs-business-meta">
                  {formatLakhs(item.minLakhs)} – {formatLakhs(item.maxLakhs)} ·{' '}
                  {item.jobs} jobs
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* 2 ── Money */}
      <section id="money" aria-labelledby="needs-money-title">
        <p className="eyebrow">Step 2</p>
        <h2 id="needs-money-title">How much do you need from your hand?</h2>
        <div className="needs-money">
          <div className="needs-money-controls">
            <fieldset className="needs-toggle">
              <legend>Your category</legend>
              {(
                [
                  [
                    'special',
                    'Special — 5%',
                    'SC, ST, BC, MBC, women, minorities, ex-servicemen, differently-abled, transgender',
                  ],
                  ['general', 'General — 10%', 'Everyone else'],
                ] as const
              ).map(([value, label, hint]) => (
                <label key={value}>
                  <input
                    type="radio"
                    name="needs-category"
                    value={value}
                    checked={profile.category === value}
                    onChange={() =>
                      updateProfile({ category: value as FounderCategory })
                    }
                  />
                  <span>
                    <strong>{label}</strong>
                    <small>{hint}</small>
                  </span>
                </label>
              ))}
            </fieldset>
            <label className="field">
              <span>
                Project cost for {business.name.toLowerCase()}:{' '}
                <strong>{formatLakhs(plan.projectLakhs)}</strong>
              </span>
              <input
                type="range"
                min={business.minLakhs}
                max={business.maxLakhs}
                step={1}
                value={Math.min(
                  Math.max(projectLakhs, business.minLakhs),
                  business.maxLakhs,
                )}
                onChange={(event) =>
                  setProjectLakhs(Number(event.target.value))
                }
                aria-valuetext={formatLakhs(plan.projectLakhs)}
              />
              <small>
                Typical range {formatLakhs(business.minLakhs)} –{' '}
                {formatLakhs(business.maxLakhs)}. NEEDS allows ₹10 lakh to ₹5
                crore.
              </small>
            </label>
          </div>

          <div className="needs-money-result" aria-live="polite">
            <p className="needs-headline">
              <span>From your hand</span>
              <strong>{formatLakhs(plan.yourContributionLakhs)}</strong>
              <span>
                for a {formatLakhs(plan.projectLakhs)} unit — that’s{' '}
                {Math.round(plan.contributionRate * 100)}%.
              </span>
            </p>
            <div
              className="needs-bar"
              role="img"
              aria-label={`You ${formatLakhs(plan.yourContributionLakhs)}, bank loan ${formatLakhs(plan.bankLoanLakhs)}`}
            >
              <span
                className="needs-bar-you"
                style={{ width: `${youShare}%` }}
              />
              <span
                className="needs-bar-bank"
                style={{ width: `${100 - youShare}%` }}
              />
            </div>
            <dl className="needs-figures">
              <div>
                <dt>Bank / TIIC loan</dt>
                <dd>{formatLakhs(plan.bankLoanLakhs)}</dd>
              </div>
              <div>
                <dt>
                  Capital subsidy (25%{plan.subsidyCapped ? ', capped' : ''})
                </dt>
                <dd>{formatLakhs(plan.subsidyLakhs)}</dd>
              </div>
              <div>
                <dt>Loan left after subsidy</dt>
                <dd>{formatLakhs(plan.loanAfterSubsidyLakhs)}</dd>
              </div>
              <div>
                <dt>Interest saved in year 1 (3%)</dt>
                <dd>≈ {formatLakhs(plan.firstYearInterestSavedLakhs)}</dd>
              </div>
            </dl>
            <p className="needs-note">
              The subsidy is credited to your loan after production starts, so
              plan to bring your {Math.round(plan.contributionRate * 100)}% on
              day one. No collateral? Ask the bank for a CGTMSE guarantee. SC/ST
              and differently-abled founders may get an extra 10% — confirm with
              your DIC; it is not counted here.
            </p>
          </div>
        </div>
        <table className="needs-table">
          <caption>Where the {formatLakhs(plan.projectLakhs)} goes</caption>
          <tbody>
            <tr>
              <th scope="row">Land & building</th>
              <td>{formatLakhs(plan.costs.landAndBuilding)}</td>
            </tr>
            <tr>
              <th scope="row">Plant & machinery</th>
              <td>{formatLakhs(plan.costs.plantAndMachinery)}</td>
            </tr>
            <tr>
              <th scope="row">Other fixed assets</th>
              <td>{formatLakhs(plan.costs.otherFixed)}</td>
            </tr>
            <tr>
              <th scope="row">Working capital (no subsidy)</th>
              <td>{formatLakhs(plan.costs.workingCapital)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* 3 ── About you */}
      <section id="you" aria-labelledby="needs-you-title">
        <p className="eyebrow">Step 3</p>
        <h2 id="needs-you-title">Tell us about you</h2>
        <p>Two minutes. Saved only on this device.</p>
        <div className="needs-form">
          <label className="field">
            <span>Full name</span>
            <input
              autoComplete="name"
              value={profile.name}
              onChange={(event) => updateProfile({ name: event.target.value })}
            />
          </label>
          <label className="field">
            <span>Age</span>
            <input
              type="number"
              inputMode="numeric"
              min={18}
              max={70}
              value={profile.age ?? ''}
              onChange={(event) =>
                updateProfile({
                  age:
                    event.target.value === ''
                      ? null
                      : Number(event.target.value),
                })
              }
            />
          </label>
          <label className="field">
            <span>Education</span>
            <select
              value={profile.education}
              onChange={(event) =>
                updateProfile({
                  education: event.target.value as FounderProfile['education'],
                })
              }
            >
              <option value="below-12th">Below 12th</option>
              <option value="12th-iti-diploma">12th / ITI / diploma</option>
              <option value="degree">Degree or above</option>
            </select>
          </label>
          <label className="field">
            <span>District for the unit</span>
            <select
              value={profile.district}
              onChange={(event) =>
                updateProfile({ district: event.target.value })
              }
            >
              {districts.map((district) => (
                <option key={district} value={district}>
                  {district}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>First in your family to start a business?</span>
            <select
              value={yesNo(profile.firstGeneration)}
              onChange={(event) =>
                updateProfile({
                  firstGeneration: fromYesNo(event.target.value),
                })
              }
            >
              <option value="">Choose</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>
          <label className="field">
            <span>Lived in Tamil Nadu for 3+ years?</span>
            <select
              value={yesNo(profile.tnResident3Years)}
              onChange={(event) =>
                updateProfile({
                  tnResident3Years: fromYesNo(event.target.value),
                })
              }
            >
              <option value="">Choose</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>
        </div>
        <ul className="needs-checks" aria-label="Eligibility checks">
          {checks.map((check) => (
            <li
              key={check.id}
              className={`needs-check needs-check-${check.status}`}
            >
              <span aria-hidden="true">{STATUS_MARK[check.status]}</span>
              <div>
                <strong>{check.label}</strong>
                <span className="visually-hidden">
                  : {STATUS_TEXT[check.status]}
                </span>
                <small>{check.note}</small>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* 4 ── Land */}
      <section id="land" aria-labelledby="needs-land-title">
        <p className="eyebrow">Step 4</p>
        <h2 id="needs-land-title">Land in {profile.district}</h2>
        <p>
          NEEDS applicants get priority in SIDCO estates. Space this business
          usually needs: <strong>{business.space}</strong>. Vacancy from the
          TANSIDCO chart as of {landSnapshotDate} — confirm in writing before
          paying any EMD.
        </p>
        {districtEstates.length === 0 ? (
          <p className="notice">
            No TANSIDCO vacancy is listed for {profile.district} in our
            snapshot. Check a neighbouring district above, or use your own or
            purchased land — that works for NEEDS too.
          </p>
        ) : (
          <ul className="needs-estates">
            {districtEstates.map((estate) => (
              <li key={estate.name}>
                <strong>{estate.name}</strong>
                <span>
                  {estate.block ?? estate.district}
                  {estate.backward ? ' · backward block' : ''}
                </span>
                <span>
                  {estate.industrialPlots} plots · {estate.sheds} sheds vacant
                </span>
                {estate.cheapestPlotRs !== null && (
                  <span>
                    From {formatLakhs(estate.cheapestPlotRs / 100_000)}
                    {estate.cheapestPlotAcres !== null
                      ? ` (${Math.round(estate.cheapestPlotAcres * 100)} cents)`
                      : ''}
                  </span>
                )}
                {estate.phone !== null && (
                  <a href={`tel:${estate.phone}`}>Call branch {estate.phone}</a>
                )}
              </li>
            ))}
          </ul>
        )}
        <p>
          <a href={tansidcoUrl} rel="noreferrer" target="_blank">
            Apply on the TANSIDCO portal
          </a>
        </p>
      </section>

      {/* 5 ── Roadmap */}
      <section id="roadmap" aria-labelledby="needs-roadmap-title">
        <p className="eyebrow">Step 5</p>
        <h2 id="needs-roadmap-title">Every step, Udyam to first production</h2>
        <p>
          <strong>
            {stepsComplete} of {NEEDS_ROADMAP.length} done.
          </strong>{' '}
          Tick steps as you finish them. Times are typical, not promised.
        </p>
        <progress
          className="needs-progress"
          max={NEEDS_ROADMAP.length}
          value={stepsComplete}
          aria-label="Roadmap progress"
        />
        <ol className="needs-roadmap">
          {NEEDS_ROADMAP.map((step) => {
            const done = Boolean(stepsDone[step.id]);
            const external = step.url.startsWith('http');
            return (
              <li key={step.id} className={done ? 'is-done' : undefined}>
                <label className="needs-step-check">
                  <input
                    type="checkbox"
                    checked={done}
                    onChange={() =>
                      setStepsDone((current) => ({
                        ...current,
                        [step.id]: !done,
                      }))
                    }
                  />
                  <span className="visually-hidden">
                    Mark “{step.title}” done
                  </span>
                </label>
                <div>
                  <p className="needs-step-meta">
                    {step.phase} · {step.org} · {step.time}
                  </p>
                  <h3>{step.title}</h3>
                  <p>{step.what}</p>
                  <p className="needs-step-docs">
                    Keep ready: {step.docs.join(', ')}
                  </p>
                  {step.warn !== undefined && (
                    <p className="needs-step-warn">⚠ {step.warn}</p>
                  )}
                  <a
                    href={step.url}
                    {...(external
                      ? { rel: 'noreferrer', target: '_blank' }
                      : {})}
                  >
                    {external ? 'Open official site' : 'Go to this step'}
                  </a>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {/* 6 ── DPR ready */}
      <section id="dpr" aria-labelledby="needs-dpr-title">
        <p className="eyebrow">Step 6</p>
        <h2 id="needs-dpr-title">Get DPR-ready</h2>
        <div className="needs-dpr">
          <div className="needs-dpr-sheet">
            <h3>{business.name}</h3>
            <dl className="needs-figures">
              <div>
                <dt>Promoter</dt>
                <dd>{profile.name.trim() || '—'}</dd>
              </div>
              <div>
                <dt>District</dt>
                <dd>{profile.district}</dd>
              </div>
              <div>
                <dt>Project cost</dt>
                <dd>{formatLakhs(plan.projectLakhs)}</dd>
              </div>
              <div>
                <dt>Your contribution</dt>
                <dd>{formatLakhs(plan.yourContributionLakhs)}</dd>
              </div>
              <div>
                <dt>Term loan</dt>
                <dd>{formatLakhs(plan.bankLoanLakhs)}</dd>
              </div>
              <div>
                <dt>NEEDS subsidy</dt>
                <dd>{formatLakhs(plan.subsidyLakhs)}</dd>
              </div>
              <div>
                <dt>Jobs created</dt>
                <dd>{business.jobs}</dd>
              </div>
              <div>
                <dt>Licences</dt>
                <dd>{business.licences.join(', ')}</dd>
              </div>
            </dl>
          </div>
          <fieldset className="needs-docs">
            <legend>
              Documents ready: {docsComplete} of {DPR_READY_DOCUMENTS.length}
            </legend>
            {DPR_READY_DOCUMENTS.map(([key, label]) => (
              <label key={key} className="check-field">
                <span>{label}</span>
                <input
                  type="checkbox"
                  checked={Boolean(docsReady[key])}
                  onChange={() =>
                    setDocsReady((current) => ({
                      ...current,
                      [key]: !current[key],
                    }))
                  }
                />
              </label>
            ))}
          </fieldset>
        </div>
        <p
          className={dprReady ? 'needs-ready is-ready' : 'needs-ready'}
          role="status"
        >
          {dprReady
            ? 'You are DPR-ready. Generate the report and apply on the MSME portal.'
            : 'Finish your details in step 3 and tick every document to be DPR-ready.'}
        </p>
        <div className="button-row">
          <a className="button-link" href={dprHref}>
            Build my DPR with these numbers
          </a>
          <button
            type="button"
            className="button-secondary"
            onClick={() => window.print()}
          >
            Print this summary
          </button>
        </div>
      </section>
    </div>
  );
}
