'use client';

import {
  CURRENT_RULESET_VERSION,
  TAMIL_NADU_DISTRICTS,
  type EvaluationResult,
  type MatcherInput,
  type RulesetVersion,
} from '@nilam/engine';
import Link from 'next/link';
import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type ReactNode,
} from 'react';

import { MATCHER_AS_OF, serializeMatcherState } from '../lib/matcher-state';
import {
  evaluateMatcherSurface,
  prepareSavedStackSnapshot,
} from '../lib/matcher-surfaces';
import { parseLegacyNilamHash } from '../lib/nilam-truth';

type MatcherProps = {
  readonly initialInput: MatcherInput;
  readonly initialRuleset: RulesetVersion;
  readonly initialEstate?: string;
  readonly projectMemoryEnabled?: boolean;
};

const sectorOptions = [
  ['food-processing', 'Food processing'],
  ['agri-infrastructure', 'Agri value-add'],
  ['manufacturing', 'Textiles'],
  ['traditional-industry', 'Engineering'],
  ['services', 'Services'],
] as const;

const schemeDescriptions: Readonly<Record<string, string>> = {
  needs:
    "Starting your family's first business? The TN government pays 25% of eligible capital cost as free money (up to ₹75 lakh) and supports a NEEDS-tagged loan.",
  aif: 'Building storage or food/agri processing? The government pays 3% of eligible loan interest for you — your loan becomes much cheaper.',
  cgtmse:
    'Bank asking for property as security? This lets an eligible lender cover collateral-free credit under the government guarantee.',
  'tiic-general':
    "Tamil Nadu's own lender offers term-loan access for eligible manufacturing, processing and service enterprises.",
  pmfme:
    'Making food products — pickles, snacks, flour or oil? Eligible existing micro units can receive a 35% credit-linked subsidy.',
  pmegp:
    'A central margin-money subsidy for eligible new micro enterprises, with higher rates for rural and special-category promoters.',
  mudra:
    'Collateral-free micro-enterprise credit through participating banks and financial institutions.',
  'zed-certification':
    'Support for eligible Udyam-registered MSMEs working toward ZED certification.',
};

function formatCompactLakhs(value: number): string {
  if (value >= 100) {
    return `₹${new Intl.NumberFormat('en-IN', {
      maximumFractionDigits: 1,
    }).format(value / 100)}Cr`;
  }
  return `₹${new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 1,
  }).format(value)}L`;
}

function projectCostToSlider(projectCostLakhs: number): number {
  return (100 * Math.log(projectCostLakhs / 10)) / Math.log(500);
}

function sliderToProjectCost(sliderValue: number): number {
  return Math.round(10 * 500 ** (sliderValue / 100));
}

function Field({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}) {
  return (
    <label className="matcher-advanced-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function Matcher({
  initialInput,
  initialRuleset,
  initialEstate,
  projectMemoryEnabled = false,
}: MatcherProps) {
  const [input, setInput] = useState(initialInput);
  const [ruleset, setRuleset] = useState(initialRuleset);
  const [expandedScheme, setExpandedScheme] = useState('needs');
  const [shareNotice, setShareNotice] = useState('');
  const [rankedEstates, setRankedEstates] = useState<
    readonly {
      id: number;
      slug: string;
      name: string;
      district: string;
      vacant: number;
    }[]
  >([]);
  const [landSnapshotAt, setLandSnapshotAt] = useState<string | null>(null);

  const evaluation = useMemo<
    { result: EvaluationResult; error: null } | { result: null; error: string }
  >(() => {
    try {
      return {
        result: evaluateMatcherSurface(input, ruleset),
        error: null,
      };
    } catch (error) {
      return {
        result: null,
        error:
          error instanceof Error
            ? error.message
            : 'The supplied profile could not be evaluated.',
      };
    }
  }, [input, ruleset]);

  const query = useMemo(() => {
    const serialized = serializeMatcherState({
      input,
      ruleset,
      ...(initialEstate === undefined ? {} : { estate: initialEstate }),
    });
    return serialized;
  }, [initialEstate, input, ruleset]);

  useEffect(() => {
    const legacy = parseLegacyNilamHash(window.location.hash);
    if (legacy === null) return;
    const frame = requestAnimationFrame(() => {
      setInput(legacy.input);
      setRuleset(legacy.ruleset);
      const canonical = serializeMatcherState(legacy);
      window.history.replaceState(null, '', `/?${canonical}`);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    window.history.replaceState(null, '', `/?${query}`);
  }, [query]);

  const update = <Key extends keyof MatcherInput>(
    key: Key,
    value: MatcherInput[Key],
  ) => {
    setInput((current) => ({ ...current, [key]: value }));
  };

  const numberChange =
    (key: keyof MatcherInput) => (event: ChangeEvent<HTMLInputElement>) => {
      update(
        key,
        Number(event.currentTarget.value) as MatcherInput[typeof key],
      );
    };

  function updateProjectCost(projectCostLakhs: number) {
    setInput((current) => ({
      ...current,
      projectCostLakhs,
      eligibleCapitalCostLakhs: Math.min(
        current.eligibleCapitalCostLakhs,
        projectCostLakhs,
      ),
      eligiblePlantMachineryLakhs: Math.min(
        current.eligiblePlantMachineryLakhs,
        projectCostLakhs,
      ),
      requestedLoanLakhs: Math.min(
        current.requestedLoanLakhs,
        projectCostLakhs,
      ),
    }));
  }

  async function share() {
    const url = `${window.location.origin}/?${query}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* The stateful URL remains directly copyable when clipboard access is blocked. */
    }
    setShareNotice('Link copied ✓');
  }

  async function saveStack() {
    if (evaluation.result === null) return;
    const encoded = new TextEncoder().encode(
      JSON.stringify({
        input,
        ruleset,
        eligible: evaluation.result.eligible.map(({ schemeId }) => schemeId),
      }),
    );
    const resultHash = [
      ...new Uint8Array(await crypto.subtle.digest('SHA-256', encoded)),
    ]
      .map((value) => value.toString(16).padStart(2, '0'))
      .join('');
    const response = await fetch('/api/account/saved-stacks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: `${input.sector} · ${input.district}`,
        inputs: input,
        resultSnapshot: prepareSavedStackSnapshot(evaluation.result),
        resultHash,
        rulesetVersion: evaluation.result.rulesetVersion,
      }),
    });
    const body = (await response.json().catch(() => ({}))) as {
      projectUrl?: string;
    };
    if (response.ok && body.projectUrl !== undefined) {
      location.assign(body.projectUrl);
      return;
    }
    setShareNotice(
      response.status === 401
        ? 'Sign in from Account to save this stack.'
        : 'Could not save this stack.',
    );
  }

  async function printReport() {
    if (evaluation.result === null) return;
    const response = await fetch('/api/reports', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        asOf: MATCHER_AS_OF,
        rulesetVersion: ruleset,
        matcherInput: input,
        idempotencyKey: crypto.randomUUID(),
      }),
    });
    setShareNotice(
      response.ok
        ? 'Printable report queued.'
        : 'Sign in with an eligible plan to print a report.',
    );
  }

  useEffect(() => {
    let live = true;
    const landQuery = new URLSearchParams({
      district: input.district,
      backward: input.backwardBlock ? '1' : '0',
    });
    fetch(`/api/estates/ranked?${landQuery.toString()}`)
      .then((response) =>
        response.ok
          ? response.json()
          : Promise.reject(new Error(String(response.status))),
      )
      .then(
        (body: {
          ranked: {
            id: number;
            slug: string;
            name: string;
            district: string;
            vacant: number;
          }[];
          fetchedAt: string | null;
        }) => {
          if (!live) return;
          setRankedEstates(body.ranked);
          setLandSnapshotAt(body.fetchedAt?.slice(0, 10) ?? null);
        },
      )
      .catch(() => {
        if (live) setRankedEstates([]);
      });
    return () => {
      live = false;
    };
  }, [input.backwardBlock, input.district]);

  const schemes = [...(evaluation.result?.eligible ?? [])].sort((a, b) => {
    if (a.schemeId === 'needs') return -1;
    if (b.schemeId === 'needs') return 1;
    return b.totalLakhs - a.totalLakhs || a.name.localeCompare(b.name);
  });

  return (
    <div className="matcher-stage">
      <form
        className="matcher-controls"
        onSubmit={(event) => event.preventDefault()}
      >
        <fieldset className="sector-picker">
          <legend>Sector</legend>
          <div>
            {sectorOptions.map(([value, label]) => (
              <label
                className={
                  input.sector === value
                    ? 'sector-chip selected'
                    : 'sector-chip'
                }
                key={label}
              >
                <input
                  checked={input.sector === value}
                  name="sector"
                  type="radio"
                  value={value}
                  onChange={() => update('sector', value)}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label
          className="project-slider"
          style={
            {
              '--slider-progress': `${projectCostToSlider(input.projectCostLakhs)}%`,
            } as CSSProperties
          }
        >
          <span className="control-label">Project size</span>
          <output>{formatCompactLakhs(input.projectCostLakhs)}</output>
          <input
            aria-label="Project size"
            max="100"
            min="0"
            step="1"
            type="range"
            value={Math.round(projectCostToSlider(input.projectCostLakhs))}
            onChange={(event) =>
              updateProjectCost(
                sliderToProjectCost(Number(event.currentTarget.value)),
              )
            }
          />
          <small className="range-min">₹10L</small>
          <small className="range-max">₹50Cr</small>
        </label>

        <label className="district-picker">
          <span className="control-label">District</span>
          <select
            aria-label="District · மாவட்டம்"
            value={input.district}
            onChange={(event) =>
              update(
                'district',
                event.currentTarget.value as MatcherInput['district'],
              )
            }
          >
            {TAMIL_NADU_DISTRICTS.map((district) => (
              <option key={district}>{district}</option>
            ))}
          </select>
        </label>

        <fieldset className="promoter-profile">
          <legend>Promoter profile</legend>
          <label>
            <span>
              First-generation entrepreneur
              <small>First business in your family · unlocks NEEDS</small>
            </span>
            <input
              checked={input.firstGeneration}
              type="checkbox"
              onChange={(event) =>
                update('firstGeneration', event.currentTarget.checked)
              }
            />
          </label>
          <label>
            <span>
              Woman / SC / ST promoter
              <small>Exact category changes published rates</small>
            </span>
            <input
              checked={input.specialCategory !== 'none'}
              type="checkbox"
              onChange={(event) =>
                update(
                  'specialCategory',
                  event.currentTarget.checked ? 'woman' : 'none',
                )
              }
            />
          </label>
          <label>
            <span>
              Rural / backward block
              <small>
                Rural rates may apply; pending concessions stay excluded
              </small>
            </span>
            <input
              checked={input.backwardBlock}
              type="checkbox"
              onChange={(event) =>
                update('backwardBlock', event.currentTarget.checked)
              }
            />
          </label>
          <label>
            <span>
              Willing to route via FPO
              <small>
                Profile fact for group programmes still under verification
              </small>
            </span>
            <input
              checked={input.fpoWilling}
              type="checkbox"
              onChange={(event) =>
                update('fpoWilling', event.currentTarget.checked)
              }
            />
          </label>
        </fieldset>

        <p className="matcher-live-note">
          Every change recomputes live — flip “first-generation” off and watch
          NEEDS leave the stack.
        </p>

        <details className="matcher-advanced" open>
          <summary>Advanced eligibility inputs</summary>
          <div>
            <Field label="Project cost (₹ lakh)">
              <input
                min="0.01"
                max="5000"
                step="0.25"
                type="number"
                value={input.projectCostLakhs}
                onChange={(event) =>
                  updateProjectCost(Number(event.currentTarget.value))
                }
              />
            </Field>
            <Field label="Eligible capital cost (₹ lakh)">
              <input
                min="0"
                max={input.projectCostLakhs}
                step="0.1"
                type="number"
                value={input.eligibleCapitalCostLakhs}
                onChange={numberChange('eligibleCapitalCostLakhs')}
              />
            </Field>
            <Field label="Plant & machinery (₹ lakh)">
              <input
                min="0"
                max={input.projectCostLakhs}
                step="0.1"
                type="number"
                value={input.eligiblePlantMachineryLakhs}
                onChange={numberChange('eligiblePlantMachineryLakhs')}
              />
            </Field>
            <Field label="Requested loan (₹ lakh)">
              <input
                min="0"
                max={input.projectCostLakhs}
                step="0.1"
                type="number"
                value={input.requestedLoanLakhs}
                onChange={numberChange('requestedLoanLakhs')}
              />
            </Field>
            <Field label="Age">
              <input
                min="18"
                max="100"
                type="number"
                value={input.age}
                onChange={numberChange('age')}
              />
            </Field>
            <Field label="Enterprise stage">
              <select
                value={input.enterpriseStage}
                onChange={(event) =>
                  update(
                    'enterpriseStage',
                    event.currentTarget
                      .value as MatcherInput['enterpriseStage'],
                  )
                }
              >
                <option value="new">New enterprise</option>
                <option value="existing">Existing enterprise</option>
              </select>
            </Field>
            <Field label="Enterprise size">
              <select
                value={input.enterpriseSize}
                onChange={(event) =>
                  update(
                    'enterpriseSize',
                    event.currentTarget.value as MatcherInput['enterpriseSize'],
                  )
                }
              >
                <option value="micro">Micro</option>
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="not-msme">Not an MSME</option>
              </select>
            </Field>
          </div>
        </details>
      </form>

      <section className="matcher-output" aria-live="polite">
        {evaluation.result === null ? (
          <div className="matcher-error" role="alert">
            <strong>Check the profile values.</strong>
            <p>{evaluation.error}</p>
          </div>
        ) : (
          <>
            <header className="computed-total">
              <div>
                <p className="matcher-kicker">Total computed support</p>
                <p className="computed-value">
                  {formatCompactLakhs(evaluation.result.totalLakhs)}
                </p>
                <p className="computed-meta">
                  Directional pre-DPR estimate — never a sanction assurance ·{' '}
                  <Link href="/changelog">
                    ruleset {evaluation.result.rulesetVersion}
                  </Link>
                </p>
                <p className="computed-explainer">
                  The total includes only amounts the verified engine can
                  calculate from this profile. Loan, guarantee and other access
                  benefits remain labeled as access rather than cash.
                </p>
              </div>
              <div className="computed-actions">
                <button type="button" onClick={() => void share()}>
                  {shareNotice === 'Link copied ✓'
                    ? shareNotice
                    : 'Share result'}
                </button>
                <Link
                  className="matcher-secondary-button"
                  href="/playbooks/industrial-land-shortlist"
                >
                  Open playbook
                </Link>
              </div>
            </header>

            <div className="scheme-stack">
              <h2>
                Your scheme stack · {schemes.length} scheme
                {schemes.length === 1 ? '' : 's'}
              </h2>
              {schemes.map((scheme) => {
                const expanded = expandedScheme === scheme.schemeId;
                return (
                  <article
                    className={
                      expanded ? 'scheme-line expanded' : 'scheme-line'
                    }
                    key={scheme.schemeId}
                  >
                    <button
                      aria-expanded={expanded}
                      className="scheme-line-heading"
                      type="button"
                      onClick={() =>
                        setExpandedScheme(expanded ? '' : scheme.schemeId)
                      }
                    >
                      <span className="scheme-title-copy">
                        <span>
                          <strong>
                            {scheme.schemeId === 'needs'
                              ? 'NEEDS'
                              : scheme.name}
                          </strong>
                          <span lang="ta">{scheme.nameTa}</span>
                          <span className="scheme-tag">
                            verified ·{' '}
                            {scheme.totalLakhs > 0 ? 'capital' : 'access'}
                          </span>
                          {scheme.deadline === null ? null : (
                            <span className="scheme-deadline">
                              Sunsets {scheme.deadline}
                            </span>
                          )}
                        </span>
                        <small>
                          {schemeDescriptions[scheme.schemeId] ??
                            scheme.caveats[0]}
                        </small>
                      </span>
                      <span className="scheme-amount">
                        {scheme.totalLakhs > 0
                          ? formatCompactLakhs(scheme.totalLakhs)
                          : 'Access'}
                      </span>
                      <span className="scheme-chevron">
                        {expanded ? '−' : '+'}
                      </span>
                    </button>
                    {expanded ? (
                      <div className="scheme-expanded">
                        <div>
                          <h3>Eligibility — your inputs</h3>
                          {scheme.predicates.map((predicate) => (
                            <p key={predicate.id}>
                              <span aria-hidden="true">✓</span>
                              {predicate.label}
                              {predicate.actual === undefined
                                ? ''
                                : ` · ${predicate.actual}`}
                            </p>
                          ))}
                        </div>
                        <div>
                          <h3>Benefit components</h3>
                          {scheme.benefits.map((benefit) => (
                            <p key={benefit.id}>
                              <strong>
                                {benefit.amountLakhs === null
                                  ? '—'
                                  : formatCompactLakhs(benefit.amountLakhs)}
                              </strong>{' '}
                              — {benefit.label}
                            </p>
                          ))}
                          <p className="scheme-citation">
                            {scheme.citations[0]?.title} · verified{' '}
                            {scheme.citations[0]?.verifiedOn}
                          </p>
                          <Link href={`/schemes/${scheme.schemeId}`}>
                            Full scheme page →
                          </Link>
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>

            <section className="scheme-stack">
              <h2>Dated TANSIDCO land</h2>
              <p className="computed-explainer">
                Ranked from the vacancy snapshot
                {landSnapshotAt === null ? '' : ` (${landSnapshotAt})`}. This is
                not an allotment letter.
              </p>
              <div className="estate-strip">
                {rankedEstates.map((estate) => (
                  <article key={estate.id}>
                    <span className="status-badge status-published">
                      {estate.vacant} vacant
                    </span>
                    <h3>{estate.name}</h3>
                    <p>{estate.district}</p>
                    <Link href={`/estates/${estate.slug}`}>
                      Inspect evidence
                    </Link>
                  </article>
                ))}
              </div>
              <Link
                className="text-link"
                href={`/land?district=${encodeURIComponent(input.district)}`}
              >
                Explore land map →
              </Link>
            </section>

            <div className="matcher-utility-actions">
              <label>
                Ruleset
                <select
                  aria-label="Ruleset version"
                  value={ruleset}
                  onChange={(event) =>
                    setRuleset(event.currentTarget.value as RulesetVersion)
                  }
                >
                  <option value={CURRENT_RULESET_VERSION}>
                    Current · {CURRENT_RULESET_VERSION}
                  </option>
                  <option value="2025.03">Historic · 2025.03</option>
                </select>
              </label>
              {projectMemoryEnabled ? (
                <button type="button" onClick={() => void saveStack()}>
                  Save as project
                </button>
              ) : null}
              <button type="button" onClick={() => void printReport()}>
                Print Pro report
              </button>
              <a
                href={`/api/share-card?${query}`}
                target="_blank"
                rel="noreferrer"
              >
                Image card
              </a>
              {shareNotice === '' ? null : <p>{shareNotice}</p>}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
