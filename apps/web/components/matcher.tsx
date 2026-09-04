'use client';

import {
  CURRENT_RULESET_VERSION,
  TAMIL_NADU_DISTRICTS,
  type EvaluationResult,
  type MatcherInput,
  type RulesetVersion,
} from '@nilam/engine';
import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type ReactNode,
} from 'react';

import {
  DEFAULT_MATCHER_INPUT,
  MATCHER_AS_OF,
  serializeMatcherState,
} from '../lib/matcher-state';
import {
  evaluateMatcherSurface,
  prepareSavedStackSnapshot,
} from '../lib/matcher-surfaces';
type RankedLand = {
  readonly id: number;
  readonly slug: string;
  readonly name: string;
  readonly district: string;
  readonly vacant: number;
};

type MatcherProps = {
  readonly initialInput: MatcherInput;
  readonly initialRuleset: RulesetVersion;
  readonly initialEstate?: string;
};

const sectors = [
  ['manufacturing', 'Manufacturing · உற்பத்தி'],
  ['food-processing', 'Food processing · உணவு பதப்படுத்துதல்'],
  ['services', 'Services · சேவைகள்'],
  ['trading', 'Trading · வர்த்தகம்'],
  ['agri-infrastructure', 'Agriculture infrastructure · வேளாண் உள்கட்டமைப்பு'],
  ['traditional-industry', 'Traditional industry · பாரம்பரிய தொழில்'],
  ['other', 'Other · மற்றவை'],
] as const;

function Field({
  label,
  hint,
  children,
}: {
  readonly label: string;
  readonly hint?: string;
  readonly children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint === undefined ? null : <small>{hint}</small>}
    </label>
  );
}

function formatLakhs(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 2,
  }).format(value);
}

export function Matcher({
  initialInput,
  initialRuleset,
  initialEstate,
}: MatcherProps) {
  const [input, setInput] = useState(initialInput);
  const [ruleset, setRuleset] = useState(initialRuleset);
  const [shareNotice, setShareNotice] = useState('');
  const [rankedEstates, setRankedEstates] = useState<readonly RankedLand[]>([]);
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

  const query = useMemo(
    () =>
      serializeMatcherState({
        input,
        ruleset,
        ...(initialEstate === undefined ? {} : { estate: initialEstate }),
      }),
    [initialEstate, input, ruleset],
  );

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

  async function share(): Promise<void> {
    const url = `${window.location.origin}/?${query}`;
    const data = {
      title: 'My NILAM scheme match',
      text: 'A cited, version-pinned Tamil Nadu scheme shortlist from NILAM.',
      url,
    };
    try {
      if (navigator.share !== undefined) {
        await navigator.share(data);
        setShareNotice('Shared.');
      } else {
        await navigator.clipboard.writeText(url);
        setShareNotice('Share link copied.');
      }
    } catch {
      setShareNotice(
        'Share cancelled. Your URL still contains the full profile.',
      );
    }
  }

  async function saveStack(): Promise<void> {
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
    setShareNotice(
      response.ok
        ? 'Saved to your account.'
        : response.status === 401
          ? 'Sign in from Account to save this stack.'
          : response.status === 402
            ? 'Free accounts can keep five stacks. Pro unlocks unlimited saves.'
            : 'Could not save this stack.',
    );
  }

  async function printReport(): Promise<void> {
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
        ? 'Printable report queued. Open Account to download the signed file.'
        : response.status === 401
          ? 'Sign in from Account to print a Pro report.'
          : response.status === 402
            ? 'Printable reports require an active Pro or consultant entitlement.'
            : 'Could not queue a printable report.',
    );
  }

  useEffect(() => {
    let live = true;
    const query = new URLSearchParams({
      district: input.district,
      backward: input.backwardBlock ? '1' : '0',
    });
    fetch(`/api/estates/ranked?${query.toString()}`)
      .then((response) =>
        response.ok
          ? response.json()
          : Promise.reject(new Error(String(response.status))),
      )
      .then((body: { ranked: RankedLand[]; fetchedAt: string | null }) => {
        if (!live) return;
        setRankedEstates(body.ranked);
        setLandSnapshotAt(body.fetchedAt?.slice(0, 10) ?? null);
      })
      .catch(() => {
        if (live) setRankedEstates([]);
      });
    return () => {
      live = false;
    };
  }, [input.backwardBlock, input.district]);

  return (
    <div className="matcher-layout">
      <form
        className="matcher-form"
        onSubmit={(event) => event.preventDefault()}
      >
        <div className="section-heading">
          <p className="eyebrow">01 · Your project</p>
          <h2>Tell us what you are building</h2>
          <p lang="ta">உங்கள் திட்ட விவரங்களை உள்ளிடுங்கள்.</p>
        </div>

        <div className="field-grid">
          <Field label="Sector · துறை">
            <select
              value={input.sector}
              onChange={(event) =>
                update(
                  'sector',
                  event.currentTarget.value as MatcherInput['sector'],
                )
              }
            >
              {sectors.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="District · மாவட்டம்">
            <select
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
          </Field>
          <Field label="Project cost (₹ lakh)" hint="Full project budget.">
            <input
              min="0.01"
              max="5000"
              step="0.25"
              type="number"
              value={input.projectCostLakhs}
              onChange={numberChange('projectCostLakhs')}
            />
          </Field>
          <Field
            label="Eligible capital cost (₹ lakh)"
            hint="Your evidence-backed estimate, not the full budget."
          >
            <input
              min="0"
              max={input.projectCostLakhs}
              step="0.25"
              type="number"
              value={input.eligibleCapitalCostLakhs}
              onChange={numberChange('eligibleCapitalCostLakhs')}
            />
          </Field>
          <Field label="Plant & machinery (₹ lakh)">
            <input
              min="0"
              max={input.projectCostLakhs}
              step="0.25"
              type="number"
              value={input.eligiblePlantMachineryLakhs}
              onChange={numberChange('eligiblePlantMachineryLakhs')}
            />
          </Field>
          <Field label="Requested loan (₹ lakh)">
            <input
              min="0"
              max={input.projectCostLakhs}
              step="0.25"
              type="number"
              value={input.requestedLoanLakhs}
              onChange={numberChange('requestedLoanLakhs')}
            />
          </Field>
        </div>

        <details>
          <summary>Eligibility details · தகுதி விவரங்கள்</summary>
          <div className="field-grid details-grid">
            <Field label="Age · வயது">
              <input
                min="18"
                max="100"
                type="number"
                value={input.age}
                onChange={numberChange('age')}
              />
            </Field>
            <Field label="Location">
              <select
                value={input.locationClass}
                onChange={(event) =>
                  update(
                    'locationClass',
                    event.currentTarget.value as MatcherInput['locationClass'],
                  )
                }
              >
                <option value="urban">Urban · நகர்ப்புறம்</option>
                <option value="rural">Rural · ஊரகம்</option>
              </select>
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
            <Field label="Entity">
              <select
                value={input.entityKind}
                onChange={(event) =>
                  update(
                    'entityKind',
                    event.currentTarget.value as MatcherInput['entityKind'],
                  )
                }
              >
                <option value="proprietorship">Proprietorship</option>
                <option value="partnership">Partnership</option>
                <option value="company">Company</option>
                <option value="cooperative">Cooperative</option>
                <option value="fpo">FPO</option>
                <option value="shg">SHG</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <Field label="Special category">
              <select
                value={input.specialCategory}
                onChange={(event) =>
                  update(
                    'specialCategory',
                    event.currentTarget
                      .value as MatcherInput['specialCategory'],
                  )
                }
              >
                <option value="none">None</option>
                <option value="woman">Woman</option>
                <option value="sc">Scheduled Caste</option>
                <option value="st">Scheduled Tribe</option>
                <option value="bc">Backward Class</option>
                <option value="mbc">Most Backward Class</option>
                <option value="minority">Minority</option>
                <option value="ex-serviceman">Ex-serviceman</option>
                <option value="transgender">Transgender</option>
                <option value="differently-abled">Differently abled</option>
              </select>
            </Field>
            <Field label="Education">
              <select
                value={input.educationLevel}
                onChange={(event) =>
                  update(
                    'educationLevel',
                    event.currentTarget.value as MatcherInput['educationLevel'],
                  )
                }
              >
                <option value="below-eighth">Below eighth standard</option>
                <option value="eighth">Eighth standard</option>
                <option value="twelfth">Twelfth standard</option>
                <option value="iti">ITI</option>
                <option value="diploma">Diploma</option>
                <option value="degree">Degree</option>
              </select>
            </Field>
            <Field label="Annual family income (₹ lakh)">
              <input
                min="0"
                max="1000"
                step="0.25"
                type="number"
                value={input.annualFamilyIncomeLakhs}
                onChange={numberChange('annualFamilyIncomeLakhs')}
              />
            </Field>
          </div>
          <div className="check-grid">
            {[
              ['firstGeneration', 'First-generation entrepreneur'],
              ['backwardBlock', 'Located in a backward block'],
              ['udyamRegistered', 'Udyam registered'],
              ['fpoWilling', 'Willing to form/join an FPO'],
              ['repaidMudraTarun', 'Successfully repaid MUDRA Tarun'],
              [
                'priorGovernmentCapitalSubsidy',
                'Already received a government capital subsidy',
              ],
            ].map(([key, label]) => (
              <label className="check-field" key={key}>
                <input
                  checked={input[key as keyof MatcherInput] as boolean}
                  type="checkbox"
                  onChange={(event) =>
                    update(
                      key as keyof MatcherInput,
                      event.currentTarget.checked as never,
                    )
                  }
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </details>
      </form>

      <section className="matcher-results" aria-live="polite">
        <div className="results-toolbar">
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
          <button type="button" onClick={() => void share()}>
            Share result
          </button>
          <button
            disabled={evaluation.result === null}
            type="button"
            onClick={() => void saveStack()}
          >
            Save stack
          </button>
          <button
            className="button-secondary"
            disabled={evaluation.result === null}
            type="button"
            onClick={() => void printReport()}
          >
            Print Pro report
          </button>
          <a
            className="button-secondary"
            href={`/api/share-card?${query}`}
            target="_blank"
            rel="noreferrer"
          >
            Image card
          </a>
        </div>
        {shareNotice === '' ? null : <p className="notice">{shareNotice}</p>}

        {evaluation.result === null ? (
          <div className="alert alert-error" role="alert">
            <strong>Check the profile values.</strong>
            <p>{evaluation.error}</p>
          </div>
        ) : (
          <>
            <div className="total-card">
              <p className="eyebrow">Directional calculated assistance</p>
              <p className="total-value">
                ₹{formatLakhs(evaluation.result.totalLakhs)} lakh
              </p>
              <p>
                {evaluation.result.eligible.length} verified scheme
                {evaluation.result.eligible.length === 1 ? '' : 's'} retained
                after conflict resolution.
              </p>
              <small>
                Ruleset {evaluation.result.rulesetVersion} · evaluated{' '}
                {evaluation.result.asOf}
              </small>
            </div>

            <div className="alert">
              <strong>Pre-sanction estimate, not an entitlement.</strong>
              <p>{evaluation.result.warnings.join(' ')}</p>
            </div>

            <div className="result-list">
              {evaluation.result.eligible.map((scheme, index) => (
                <article className="scheme-result" key={scheme.schemeId}>
                  <div className="result-rank">
                    {String(index + 1).padStart(2, '0')}
                  </div>
                  <div>
                    <p className="eyebrow">Eligible on supplied facts</p>
                    <h3>{scheme.name}</h3>
                    <p lang="ta">{scheme.nameTa}</p>
                    <p className="scheme-value">
                      {scheme.totalLakhs > 0
                        ? `₹${formatLakhs(scheme.totalLakhs)} lakh calculated`
                        : 'Non-cash / lender-mediated support'}
                    </p>
                    <details>
                      <summary>Why this matched</summary>
                      <ul className="evidence-list">
                        {scheme.predicates.map((predicate) => (
                          <li key={predicate.id}>
                            <span aria-hidden="true">✓</span> {predicate.label}
                            {predicate.actual === undefined
                              ? ''
                              : ` — ${predicate.actual}`}
                          </li>
                        ))}
                      </ul>
                      {scheme.benefits.map((benefit) => (
                        <p key={benefit.id}>{benefit.label}</p>
                      ))}
                      <p>
                        Source verified {scheme.citations[0]?.verifiedOn}.{' '}
                        <a
                          href={scheme.citations[0]?.url}
                          rel="noreferrer"
                          target="_blank"
                        >
                          Open primary source
                        </a>
                      </p>
                    </details>
                  </div>
                </article>
              ))}
            </div>

            {evaluation.result.conflicts.length === 0 ? null : (
              <section className="result-section">
                <h2>Conflict decisions</h2>
                {evaluation.result.conflicts.map((conflict) => (
                  <p
                    key={`${conflict.keptSchemeId}-${conflict.droppedSchemeId}`}
                  >
                    Kept <strong>{conflict.keptSchemeId}</strong> over{' '}
                    <strong>{conflict.droppedSchemeId}</strong>:{' '}
                    {conflict.rationale}
                  </p>
                ))}
              </section>
            )}

            <section className="result-section">
              <h2>Application sequence</h2>
              <ol className="sequence-list">
                {evaluation.result.sequence.map((step) => (
                  <li key={step.id}>
                    <strong>{step.title}</strong>
                    <span>{step.organisation}</span>
                  </li>
                ))}
              </ol>
            </section>

            <section className="result-section">
              <h2>Near matches</h2>
              {evaluation.result.nearMisses.slice(0, 4).map((nearMiss) => (
                <article className="near-miss" key={nearMiss.schemeId}>
                  <h3>{nearMiss.name}</h3>
                  <p>
                    Not included. Failed:{' '}
                    {nearMiss.failedPredicates
                      .map((predicate) => predicate.label)
                      .join('; ')}
                  </p>
                </article>
              ))}
            </section>

            <section className="result-section status-register">
              <h2>Verification register</h2>
              <p>
                <strong>{evaluation.result.pendingVerification.length}</strong>{' '}
                records are pending verification and contribute{' '}
                <strong>₹0</strong> to this result.
              </p>
              <details>
                <summary>See pending and retired records</summary>
                <ul>
                  {evaluation.result.pendingVerification.map((record) => (
                    <li key={record.id}>
                      <strong>{record.name}</strong> — Pending verification; not
                      calculated
                    </li>
                  ))}
                  {evaluation.result.retired.map((record) => (
                    <li key={record.id}>
                      <strong>{record.name}</strong> — Retired; not available
                    </li>
                  ))}
                </ul>
              </details>
            </section>

            <section className="result-section">
              <h2>Land shortlist</h2>
              <p>
                Ranked from the TANSIDCO vacancy snapshot
                {landSnapshotAt === null ? '' : ` (${landSnapshotAt})`}. Confirm
                written vacancy before paying EMD.
              </p>
              <div className="estate-strip">
                {rankedEstates.map((estate) => (
                  <article key={estate.id}>
                    <span className="status-badge status-published">
                      {estate.vacant} vacant
                    </span>
                    <h3>{estate.name}</h3>
                    <p>{estate.district}</p>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}
      </section>
    </div>
  );
}

export { DEFAULT_MATCHER_INPUT };
