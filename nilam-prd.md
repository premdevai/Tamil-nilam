# NILAM — Product Requirements Document
**நிலம் · Government land + scheme intelligence for Indian entrepreneurs**
v1.0 · 21 Aug 2026 · Author: Prem · Status: build-ready (pair with `nilam-tdd.md`)

---

## 1. One-liner

Every government industrial plot in Tamil Nadu, every scheme it unlocks, and exactly how to apply — computed for *your* business in under 90 seconds, verified at G.O. level.

## 2. Thesis

Indian industrial land is held by a dozen agencies (TANSIDCO, SIPCOT, DIC, TIDCO, SIDCO women's estates, revenue land via conversion). The money attached to it lives in a hundred Government Orders across central ministries (MoFPI, KVIC/MSME, DAC&FW) and state departments (TN MSME, Agri, Industries). Nobody joins the two sides. A founder spends 2–3 weeks reconstructing what NILAM answers in one session.

**The product is certainty, not listings.** Same thesis validated in Lingam Estate: Indian institutional information monetizes asymmetry; sell the confidence to act.

## 3. The moat (non-negotiable design constraint)

Lists rot. Rule engines compound. The moat is **verification ops**, and every product decision must feed it:

1. **G.O.-cited rules** — every number in the app carries its Government Order reference and a `verified_on` date. No orphan facts, ever.
2. **Stacking matrix** — pairwise scheme-compatibility verified at DIC level, the single dataset no portal has.
3. **Freshness as UI** — staleness is displayed, not hidden. A rule unverified for >90 days shows an amber badge. Honesty is the brand.
4. **Change tracking** — when a G.O. moves (PMFME's Sept 2026 sunset is the canonical example), the engine's answers change and affected saved-results users get notified. *That* is the retention loop.

A copier can scrape our content in a weekend. They cannot copy the loop: scraper-watch → change diff → human verification → versioned rule publish.

## 4. Users

| Persona | Moment | Need | Success |
|---|---|---|---|
| **P1 · The idle scroller** | Random idea while doom-scrolling ("machan, oil mill podalama?") | Zero-friction answer, no signup, phone-first, Tamil-friendly | Reaches a computed ₹-figure result in <90s, shares screenshot |
| **P2 · The committed founder** | Has capital, scouting land + subsidy stack (this was me) | Plot-level detail, stacking rules, application sequence, DPR | Saves stack, downloads playbook, starts applications in right order |
| **P3 · The consultant / CA / DIC-adjacent agent** | Runs stacks for many clients | Bulk runs, printable reports, citation trail | Pays for pro tier |

P1 is the acquisition engine (SEO + shareability). P2 is the revenue engine. P3 is the scale engine.

## 5. Core product surfaces

### 5.1 The Matcher (home page, the hero interaction)
- Three inputs, zero signup: **sector** (chips), **project size** (slider, ₹10L–₹50Cr log scale), **promoter profile** (toggles: first-gen+age, rural/backward block, woman/SC/ST, FPO-willing) + **district** (dropdown, geolocate default).
- Output in one screen: total support figure (big), scheme stack with computed amounts, conflicts auto-resolved with plain-language explanation, ranked land options, application sequence.
- Every scheme row expands to: eligibility test results against *your* inputs (pass/fail per criterion, shown like a checklist), G.O. citation, `verified_on` date, deadline countdown if any.
- **Interaction requirements:** every toggle recomputes live (no submit button after first run); flipping "first-generation" off visibly removes ₹75L — the demo moment. Result URL is stateful and shareable (`/stack?sec=food&pc=300&fgen=1...`). One-tap "share as image" renders a result card for WhatsApp.

### 5.2 Land Explorer (the visual layer)
- Full-screen map (MapLibre + OSM) of all indexed estates. Cluster → estate → **plot-level polygons** where data exists (TANSIDCO GIS exposes plot layers).
- Plot states color-coded: vacant / allotted / litigation / reserved — mirroring the source GIS legend.
- Estate detail panel: rates (₹/sq.ft where published), infrastructure checklist (road/EB/water/ETP), distance-to inputs (nearest highway, port, mandi), backward-block status flag (because it changes subsidy eligibility — cross-linked to Matcher).
- Filter by: agency, plot size range, sector suitability, "schemes unlocked here ≥ N".
- **Interaction requirements:** clicking a plot pre-fills the Matcher with that location's flags. Map ↔ Matcher is one loop, not two features.

### 5.3 Scheme Encyclopedia (the SEO layer)
- One page per scheme, statically generated, bilingual (Tamil primary for state schemes). Structure per page: what you get (computed examples at 3 project sizes), who qualifies (interactive mini-checker inline), what it conflicts with, how to apply (step-by-step with portal links + document checklist), G.O. history timeline, freshness badge.
- Programmatic long-tail pages: `{scheme} × {sector}`, `{scheme} × {district}`, `{estate} + schemes`. This is how P1 arrives from Google at 11pm.

### 5.4 Playbooks (the "how to apply for everything" promise)
- Ordered, checkbox-tracked application sequences per stack archetype (e.g., "Flagship SME: NEEDS + AIF + plot"). Each step: which office/portal, documents, fees, realistic timelines, failure modes ("banks won't volunteer AIF tagging — ask explicitly").
- Local-storage progress for anonymous users; account sync optional.

### 5.5 Alerts & saved stacks (retention)
- Save a stack (email/Telegram — Telegram bot is on-brand and free). Notify on: G.O. change affecting the stack, deadline T-30/T-7, new vacancy in watched estates.

### 5.6 DPR Generator (revenue, phase 2)
- Paid: turns a saved stack + a guided financials form into a bank-ready DPR skeleton (docx/pdf) with scheme annexures. Priced ₹2–5K; consultant tier bulk.

## 6. Data coverage & accuracy commitments

- **Launch scope:** Tamil Nadu only. All TANSIDCO estates indexed with plot geometry where GIS provides it; SIPCOT parks as polygons + park-level facts; 24+ schemes in the rule engine (the 14 from prototype + UYEGP, AABCS, Agri Value-Addition Centres, TNAPEx, MoFPI cluster, Stand-Up India, Mudra tiers, CGTMSE, stamp-duty concessions, TIIC loan products as financing entries).
- **Accuracy SLA:** every rule `verified_on ≤ 90 days` or it wears the amber badge. Deadline-bearing rules re-verified monthly. Public changelog of rule updates (trust artifact + SEO).
- **Explicit honesty rules:** amounts labeled "directional pre-DPR estimates"; never promise sanction; conflicts marked "confirm at DIC in writing" where G.O. fine print is ambiguous. Overpromising kills the trust brand faster than missing data.

## 7. Monetization

Free: matcher, explorer, encyclopedia, playbooks (reading). Paid: DPR generator (₹2–5K/doc), Pro (₹499/mo: saved stacks unlimited, alerts, printable cited reports, consultant bulk-run), later: qualified-lead referral to TIIC/banks/consultants (disclosed, never pay-to-rank).

## 8. Launch phases

- **P0 (agent build target, ~4 wks):** Matcher + rule engine + 24 schemes + scheme pages + TN estate directory (table + basic map, estate-level) + playbooks (3 archetypes) + share cards. No auth.
- **P1 (+4 wks):** plot-level GIS layer, saved stacks via Telegram, data-ops pipeline live (scrapers + review queue), Tamil UI.
- **P2:** DPR generator, Pro tier, alerts, consultant features.
- **P3:** second state (Karnataka — KIADB) proves the engine generalizes.

## 9. Metrics

North star: **completed stacks per week** (matcher run reaching result view). Guardrails: result-share rate ≥8%, scheme-page organic entrances, rule-freshness (% rules <90d), stack→playbook progression ≥20%, zero uncited numbers (CI-enforced, see TDD).

## 10. Out of scope (v1)

Private land, non-industrial govt land (housing boards), pan-India coverage, agent marketplace, loan brokering, any claim of "guaranteed approval."
