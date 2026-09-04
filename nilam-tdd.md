# NILAM — Technical Design Document
v1.0 · 21 Aug 2026 · Pair with `nilam-prd.md` · Audience: Claude Code build agent + Prem
Stack philosophy: **self-hosted, free-first, boring-first.** Everything runs on the existing Hostinger KVM2 VPS. No paid SaaS in the critical path.

---

## 1. Architecture overview

```
                        ┌──────────────────────────── VPS (Docker Compose) ────────────────────────────┐
                        │                                                                              │
  Browser ── Caddy ─────┼──► Next.js 14+ (App Router, TS)  ──► Postgres 16 + PostGIS                   │
  (HTTPS, auto-cert)    │        │  ISR/SSG scheme pages         │  (agencies, estates, plots,         │
                        │        │  /api routes (matcher, geo)   │   schemes, rules, GOs, verif_log)   │
                        │        │                               │                                     │
                        │        ├──► Rule Engine (pure TS pkg, ─┤   Meilisearch (schemes/estates      │
                        │        │    no I/O, versioned rules)   │   full-text, typo-tolerant Tamil)   │
                        │        │                               │                                     │
                        │   Python data-ops workers (cron): scrapers → diff → review queue → publish   │
                        │   Telegram bot (grammY/Node): saved stacks, alerts                           │
                        │   Umami (self-hosted analytics) · pg_dump nightly → object storage           │
                        └──────────────────────────────────────────────────────────────────────────────┘
```

Decisions and why:
- **Next.js App Router + TypeScript** — Prem's home stack; SSG/ISR gives the SEO layer for free; one repo serves app + API.
- **Postgres + PostGIS** — plots are geometry; PostGIS is the boring correct answer. Drizzle ORM (typed, no codegen server).
- **Rule engine as a pure TypeScript package** (`packages/engine`) — zero I/O, deterministic, unit-testable, runs identically server-side (API) and client-side (live-recompute toggles). This is the crown jewel; isolate it.
- **MapLibre GL + OSM/Protomaps tiles** — free, self-hostable tiles later (pmtiles on Caddy). No Google Maps billing.
- **Meilisearch** — self-hosted, handles Tamil transliteration search ("சிட்கோ", "sidco", "tansidco") with synonyms.
- **Python for scrapers** — requests/httpx + BeautifulSoup/playwright where GIS endpoints need it; writes to a staging schema only.
- **Telegram over email** for alerts — free, on-brand, Prem already runs bot infra.
- **Auth:** none in P0. P1: magic-link via Telegram deep-link (`/start save_<token>`). No passwords ever.

## 2. Monorepo layout

```
nilam/
├─ apps/web/                 # Next.js app
│  ├─ app/(marketing)/       # home = Matcher, /moat, /changelog
│  ├─ app/stack/             # shareable result pages (URL-state)
│  ├─ app/schemes/[slug]/    # SSG encyclopedia + programmatic combos
│  ├─ app/land/              # explorer (map) + /land/[estate]
│  ├─ app/playbooks/[slug]/
│  └─ app/api/               # matcher, geo, share-card (og image), health
├─ packages/engine/          # RULE ENGINE — pure TS, no deps beyond zod
│  ├─ rules/*.rule.ts        # one file per scheme
│  ├─ src/{types,evaluate,conflicts,sequence}.ts
│  └─ test/golden/*.json     # golden cases (see §6)
├─ packages/db/              # drizzle schema + migrations + seed
├─ services/dataops/         # Python: scrapers, differ, review CLI
├─ services/tgbot/
└─ docker-compose.yml        # caddy, web, postgres, meilisearch, umami, tgbot
```

## 3. Data model (core tables)

```sql
agency(id, slug, name, name_ta, kind, apply_url, notes)
estate(id, agency_id, slug, name, name_ta, district, block, backward_block bool,
       centroid geography(Point), boundary geography(Polygon) null,
       rates jsonb, infra jsonb, source_url, verified_on date)
plot(id, estate_id, plot_no, area_cents numeric, status enum(vacant|allotted|litigation|
     reserved|pending_cancel), geom geography(Polygon) null, source_synced_at timestamptz)
scheme(id, slug, name, name_ta, level enum(central|state), dept, summary_md,
       apply_steps_md, docs_checklist jsonb, portal_url, sunset_date date null)
go_ref(id, scheme_id, go_number, go_date, url, summary)          -- citation spine
rule_version(id, scheme_id, version, effective_from, effective_to null,
             rule_json jsonb, verified_on date, verified_by, changelog_md)
conflict_pair(scheme_a, scheme_b, kind enum(exclusive|caution), rationale_md,
              confirmed_at enum(go_text|dic_written|dic_verbal|inferred), verified_on)
playbook(id, slug, archetype, steps jsonb)
verification_log(id, entity, entity_id, action, actor, note, at)  -- the moat's audit trail
saved_stack(id, tg_chat_id, inputs jsonb, result_hash, created_at)  -- P1
```

Invariant (CI-enforced): **no row that renders a number to users may lack a `go_ref` + `verified_on`.** A schema test fails the build otherwise. This encodes "zero uncited numbers" from the PRD.

## 4. Rule engine (the crown jewel)

### 4.1 Rule shape — declarative, versioned, cited
```ts
// packages/engine/rules/needs.rule.ts
export const needs: SchemeRule = {
  id: "needs", level: "state", conflictGroup: "state-capital",
  citation: { go: "G.O. Ms.13 MSME(D2) 24-04-2018", verifiedOn: "2026-08-21" },
  deadline: null,
  eligibility: [
    { id: "first-gen", test: i => i.firstGen, label: "First-generation entrepreneur" },
    { id: "age",       test: i => i.ageBand !== "45+", label: "Age 21–45 (special) / 21–35 (general)" },
    { id: "size",      test: i => i.projectLakhs >= 10 && i.projectLakhs <= 500,
                       label: "Project ₹10L–₹5Cr" },
  ],
  benefit: i => {
    const cap = Math.min(i.projectLakhs * 0.25, 75);
    const loan = estLoan(i, cap);
    return [
      { kind: "capital-subsidy", lakhs: cap, note: "25% of project cost, capped ₹75L" },
      { kind: "interest-subvention", lakhs: relief(loan, 0.03, 7), note: "3% for loan tenure" },
      { kind: "access", note: "Preferential SIDCO/TANSIDCO plot allotment" },
    ];
  },
};
```

Design rules:
- **`Input` is a closed zod schema** (sector, projectLakhs, district, backwardBlock, firstGen, ageBand, specialCategory, fpoWilling, entityKind). Adding an input field is a versioned engine change.
- **Eligibility is an array of named predicates**, not one boolean — the UI renders each as a pass/fail checklist row. Failing rules are returned too, with which predicate failed ("you miss NEEDS only on age → here's the fallback"). Near-misses are product, not noise.
- **`conflictGroup`** implements "one capital subsidy per government level": within a group, keep max total benefit, emit a `ConflictResolution` explaining the drop and the alternative-unit strategy. `conflict_pair` table overrides for special cases; `confirmed_at` level is surfaced in UI ("DIC-confirmed in writing" vs "inferred — confirm at DIC").
- **Versioning:** rules compile from `rule_version.rule_json` at build; engine API is `evaluate(input, ruleset)` where `ruleset` is pinned by version. Shareable stack URLs embed ruleset version — an old link renders with a banner "computed on ruleset v12; v14 changes this by ₹X" (the retention hook).
- **Sequencer:** deterministic topological order from per-scheme `prereq` hints (e.g., NEEDS before plot application; loan sanction before AIF tagging) → renders the playbook steps.

### 4.2 Engine API
```ts
evaluate(input): { eligible: SchemeResult[], nearMisses: NearMiss[],
  conflicts: ConflictResolution[], totalLakhs: number,
  sequence: Step[], rulesetVersion: string }
```
Runs client-side for live toggle recompute; server-side for share-card OG images and API consumers.

## 5. Data-ops pipeline (the moat's machinery)

```
scrapers (cron, Python)              differ                review               publish
tansidco GIS plots  ─┐         staging vs prod        CLI: `dataops review`   promote to prod +
tnswp/msmeonline    ─┼──► staging schema ──► field-level diff ──► human approve/  bump rule_version /
PIB/MoFPI releases  ─┤                        + LLM summary of    edit/reject     estate verified_on,
sipcot notices      ─┘                        G.O. text changes                  write verification_log,
                                                                                 notify affected saved_stacks
```

- Scrapers **never write to prod**. Everything lands in `staging.*`; the differ produces a human-readable change report (Telegram DM to Prem daily).
- G.O. PDFs: download, hash, extract text (pdfplumber), store in `go_ref`; an LLM pass (Claude API, cheap model) drafts the changelog + suggested rule edit — **human approves every rule change**. The approval is the verification op; never auto-publish rule changes.
- TANSIDCO GIS: their portal serves estate/plot layers — inspect network calls for the underlying map-service endpoints (likely ArcGIS/GeoServer JSON); fall back to per-estate page scraping of vacancy tables if geometry is unavailable. Store `source_synced_at`; UI shows sync age.
- Cadence: plots weekly, scheme portals weekly, PIB daily keyword watch, full manual re-verify sweep monthly (checklist generated from `verified_on` age).

## 6. Testing strategy

- **Golden cases** (`packages/engine/test/golden/`): ~40 JSON fixtures of (input → expected stack), including the real ones from Prem's own research (₹5Cr food unit ⇒ NEEDS+AIF ≈ ₹1.8Cr; ₹25L micro ⇒ PMFME kept over PMEGP; first-gen off ⇒ TN-cap fallback). Any rule edit that shifts a golden total fails CI until the fixture is consciously updated — rule changes become reviewed diffs, never silent drift.
- **Invariant tests:** no benefit without citation; conflictGroups never emit two winners; totals never exceed project cost; every deadline-bearing rule has a sunset test.
- **E2E (Playwright):** matcher happy path <90s including first paint on throttled 4G; toggle recompute without page reload; share URL reproduces identical result; scheme page renders bilingual.
- **Data tests:** every prod estate row has source_url + verified_on; plot geometries valid (ST_IsValid).

## 7. Non-functional

- **Perf:** matcher page ≤120KB JS budget (engine is small; map loads only on /land). Scheme pages SSG, revalidate on rule publish. Target LCP <2s on mid-range Android — P1 is on a phone in a bathroom.
- **i18n:** next-intl, `ta` primary for state content; scheme names stored bilingual in DB, not translated at runtime.
- **SEO:** programmatic sitemaps for scheme×district×sector combos; JSON-LD (GovernmentService/FAQ); public `/changelog` doubles as freshness proof.
- **Analytics:** Umami self-hosted; events: matcher_run, result_view, toggle_recompute, share, playbook_step_done.
- **Backups:** nightly pg_dump + weekly offsite; rule_versions are append-only so history is never lost.
- **Legal posture:** disclaimer on every computed figure ("directional, not sanction assurance"); no scheme "guarantee" language anywhere (enforced by a lint rule on content strings, same spirit as citation CI).

## 8. Build plan for the Claude Code agent (phased, each with acceptance gate)

**M0 · Skeleton (day 1–2).** Monorepo, docker-compose (caddy+web+pg+meili), drizzle schema §3, CI with the citation invariant test stubbed. ✅ Gate: `docker compose up` serves hello page over HTTPS; migrations apply; CI green.

**M1 · Engine (day 3–6).** `packages/engine` with 14 seed rules ported from prototype + 10 more from PRD §6 list; conflicts, near-misses, sequencer; 40 golden tests. ✅ Gate: all goldens pass; `evaluate()` pure (no imports beyond zod); mutation test — flipping firstGen flips NEEDS.

**M2 · Matcher UI (day 7–11).** Home page per PRD §5.1: chips/slider/toggles, live recompute, expandable eligibility checklists, conflict cards, sequence panel, stateful URLs, OG share-card endpoint. Design language: paper/ink, single desaturated turmeric accent `#7a6a12`, Cabinet Grotesk/Satoshi/JetBrains Mono, asymmetric editorial layout, no cards-for-everything, transform/opacity motion only. ✅ Gate: Playwright E2E passes; Lighthouse perf ≥90 mobile; share URL round-trips.

**M3 · Encyclopedia + directory (day 12–16).** SSG scheme pages (bilingual), estate directory table + estate detail pages (map optional this milestone, estate centroids fine), playbooks ×3 with localStorage progress. ✅ Gate: 24 scheme pages + ≥120 estate pages build statically; sitemap valid; every rendered number traces to go_ref (CI).

**M4 · Land explorer (day 17–22).** MapLibre estate layer; plot polygons for ≥5 pilot estates (Kattuvananjur among them if geometry obtainable); plot→matcher prefill loop. ✅ Gate: map interactive on mobile; plot click opens matcher with location flags set.

**M5 · Data-ops + bot (day 23–28).** Python scrapers (staging-only) + differ + review CLI + Telegram daily digest; saved stacks via bot; `/changelog` page. ✅ Gate: a simulated G.O. change flows staging→review→publish→rule_version bump→goldens updated→saved-stack notification fired.

Agent operating rules: work milestone-by-milestone, never skip a gate; when a scheme fact is uncertain, mark `confirmed_at: inferred` and add to the review queue rather than inventing; never weaken the citation invariant to make CI pass.

## 9. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Source portals change/block scraping | Staging isolation; scrape gently (rate-limit, cache); estate data degrades to "verified table" mode without geometry — product still works |
| Rule wrongness harms a user | Near-miss transparency, citation-on-every-number, disclaimer lint, human-approved rule changes, public changelog |
| Solo maintenance load | Freshness badges make staleness honest instead of fatal; monthly sweep checklist auto-generated; scope stays TN until ops loop is proven |
| Copycat | The moat is §5 pipeline + `verification_log` history — ship the changelog publicly so the compounding is visible |
