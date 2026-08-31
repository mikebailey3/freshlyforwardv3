# Job-Search OSS Audit — Investigation Report (No Implementation)

**Scope:** Investigation of `mikebailey3/job_finder`, `mikebailey3/job-finder`, and related
open-source job-search projects (Career-Ops, Career Caddy, CareerBot, plus a strong
"Job Hunter" match) to determine what is responsibly reusable for FreshlyForward/ForwardOS.
**Per explicit instruction: investigation/report only. No code was written or changed.**

Repos examined (6 total):

| # | Repo | Upstream / Owner | Stack |
|---|---|---|---|
| 1 | `mikebailey3/job_finder` | fork of `ATAboukhadra/job_finder` | Python/Flask, SQLite |
| 2 | `mikebailey3/job-finder` | fork of `ejirocodes/job-finder` | Node/TS, Firecrawl + Together AI |
| 3 | `santifer/career-ops` | original (69k, viral, press-covered) | Node/Go, runs inside AI coding CLIs |
| 4 | `overcast-software/career_caddy` (+ 6 sibling repos) | original (~1) | Django+DRF+Postgres, Ember, pydantic-ai, MCP |
| 5 | `thoughtfulllc/careerbot` | original (69) | Next.js dashboard + Claude Code skills, markdown-as-DB |
| 6 | `Donvink/swiss-job-hunter` | original (141) | Python/FastAPI + React, SQLite |

Plus a full internal audit of FreshlyForward's existing implementation: `opportunityEngine.ts`,
`freshFitScore.ts`, `scraped_jobs`/`job_matches` schema, Forward DNA tables
(`career_scope`/`career_responsibilities`/`career_skills`), `useEntitlements.ts`, and the
strategist Opportunity Engine UI.

---

## A. Executive Recommendation

**Don't adopt any of the 6 audited repos wholesale.** FreshlyForward already has roughly
70% of the "job discovery + matching" architecture in place — the **Opportunity Engine**
(`scraped_jobs`, `job_matches`, FreshFit deterministic scoring, strategist-gated
promote-to-opportunity workflow) — and it's built *more* cleanly (RLS-secured,
service-role-only writes, deterministic + explainable scoring) than half of what was
reviewed. This audit is not "should we build a job engine" — it's "how do we harden and
extend the one that already exists."

The real gaps found, in priority order:

1. **Active legal/ToS risk sitting in production code today** — `scripts/scrapeIndeed.ts`
   scrapes indeed.com against their ToS. It's honestly written and self-documented as
   "educational/best-effort," but it's live and swappable-in-name-only until it's actually
   replaced.
2. **Forward DNA is built but unused by matching.** The new `career_scope` /
   `career_responsibilities` / `career_skills` tables (2026-08-31 migration) aren't
   referenced anywhere in `freshFitScore.ts`. All that structured evidence just sits there.
3. **No job staleness/expiration mechanism.** `scraped_jobs.is_active` is set once at
   scrape time and never re-verified.
4. **No member-submitted job path.** Members can't paste a URL/description themselves;
   they can only wait for strategist-curated Opportunities. Three of the six audited repos
   (job_finder, career-ops, careerbot) treat this as a first-class, low-effort feature.

None of the fixes require the heavy multi-service architectures seen in `career_caddy` or
`career-ops`; those solve problems (multi-tenant SaaS scraping infra at scale, LLM-driven
CV tailoring) that contradict FreshlyForward's own stated positioning — "100% human-led,
hand-crafted applications, explicitly not AI mass-applying" (`PRODUCT.md`).

---

## B. Repo Comparison Table

| Repo | Signal | License | Core Approach | Fit for FreshlyForward |
|---|---|---|---|---|
| `job_finder` (ATAboukhadra fork) | Modest, personal | MIT (claimed; no GitHub license field) | 20 scrapers + semantic matcher + local-LLM (Ollama) auto-apply pipeline | Medium — strong scraper/dedup/matcher *patterns*; résumé-similarity model and local-LLM dependency are the wrong fit |
| `job-finder` (ejirocodes fork) | Small, thin | MIT (claimed) | LLM normalizes scraped markdown → structured `JobSchema` via Firecrawl + Together AI | Low-medium — interesting normalization idea, but per-call paid API cost and a fragile prompt-only "jobs posted today" filter (the prompt itself has a "DO NOT HALLUCINATE" warning — a smell) |
| `career-ops` (santifer) | Huge (69k, WIRED/Business Insider coverage) | MIT | Agent-orchestrated: your AI coding CLI *is* the scraper/evaluator, no server | High signal — best precedent for member-submitted-URL evaluation, 55+ pre-configured job-board providers, opt-in liveness verification. Architecture (runs per-user inside a CLI) doesn't map onto a hosted SaaS though |
| `career_caddy` (overcast-software) | Tiny (~1), very ambitious | Unconfirmed — do not copy code without checking | Django+DRF+Postgres, Ember SPA, pydantic-ai agents, tiered self-tuning scrape pipeline, MCP | Low for wholesale reuse (different stack, massive overkill for FreshlyForward's scale); high signal-value for the tiered-cost-escalation and race-free-worker-claiming *ideas* |
| `careerbot` (thoughtfulllc) | Tiny (69) | MIT | Markdown-files-as-database, folder-name-as-status, Claude Code skills do the work | Low direct reuse (worse than Postgres+RLS for a multi-tenant paid product); the folder-as-status idea is a nice human-auditable pattern conceptually |
| `swiss-job-hunter` (Donvink) | Modest, active (141) | **AGPL-3.0 ** | 8 scrapers, SHA-256 + MiniLM semantic dedup, two-stage keyword-then-LLM scoring, Kanban tracker | Medium idea-value, but AGPL means literal/adapted code copy would obligate FreshlyForward to open-source its own modifications since FreshlyForward *is* a hosted service. **Ideas only, never code.** |

---

## C. Top 10 Reusable Ideas (patterns, not code)

1. **Tiered-cost extraction escalation** (`career_caddy`'s `scrape_graph`: free CSS parse →
   small model → Haiku → Sonnet, tracked per-domain hit/miss). Apply this *if* FreshlyForward
   ever needs to parse non-ATS company career pages — try free parsing first, only spend LLM
   tokens when it fails, and remember which domains need which tier.
2. **Public ATS API sources over HTML scraping** (Greenhouse/Lever/Ashby — used by
   `job_finder`, `career-ops`, `career_caddy`). Zero ToS risk, structured JSON, no
   bot-detection arms race. Should replace Indeed scraping directly (see Section E).
3. **Opt-in liveness/expiration verification pass** (`career-ops`'s `scan.mjs --verify` —
   sequential Playwright check, run only on *new* postings after dedup so cost stays
   bounded). Directly solves FreshlyForward's current lack of staleness detection.
4. **Human-in-the-loop as an explicit, advertised guarantee** (`career-ops`: "never submits,
   sends, or clicks anything"; `job_finder`'s approval-gated application workflow;
   `careerbot`: "you review every draft and submit yourself"). FreshlyForward already does
   this via strategists — worth treating as an explicit, protected product principle for
   any new automation, since it's both a trust promise and a legal safeguard.
5. **A parallel "legitimacy" signal that never blends into the match score**
   (`career-ops`'s Block G: a scam/ghost-job flag kept separate from the 1-5 score).
   FreshlyForward's FreshFit score is a single number today; a distinct legitimacy flag
   protects the "we vet everything" brand promise without muddying the match score.
6. **Member-submitted job URL as first-class input into the same scoring pipeline**
   (`job_finder`'s `/api/add-job`, `career-ops`'s auto-pipeline, `careerbot`'s
   `/add-application`). Completely absent from FreshlyForward today.
7. **Cross-platform de-duplication beyond URL/fingerprint** (`career_caddy`'s canonical
   `JobPost` merge across LinkedIn/Greenhouse/Lever, trust-aware "higher-trust source
   upgrades a stub in place"). Not urgent at FreshlyForward's current single-source scale,
   but worth knowing *before* a second source is added — today's `UNIQUE(source,
   external_id)` constraint would create duplicate rows for the same role across sources.
8. **Repost/ghost-job detection** (`career-ops`'s `detect-reposts.mjs`) — a transparent
   signal for strategists reviewing `job_matches`, not an auto-filter.
9. **Config-driven scheduling with double-run guards** (`job-finder`'s `node-cron`
   `isRunning`/`lastRunDate` check; `career-ops`'s `pipeline-lock.mjs`). Relevant the moment
   `scrapeIndeed.ts`/`syncFreshFitScores.ts` move from manual `npm run` to a scheduled job.
10. **A named, documented `JobSource` abstraction with an "add a scraper" recipe**
    (`swiss-job-hunter`'s `BaseScraper` + `SOURCES` constant; `job_finder`'s `SCRAPERS`
    registry). FreshlyForward's `scrapeIndeed.ts` is a single hardcoded script today —
    worth formalizing before source #2 ships.

---

## D. Top 5 Specific Code Pieces Worth Studying (pattern-level; licenses noted)

1. **`job_finder/scrapers/greenhouse.py`** — clean, free, unauthenticated public ATS API
   scraper. Safest concrete template for FreshlyForward's first non-Indeed source.
   (MIT claimed in-repo; GitHub metadata shows no license field — verify before literal
   reuse.)
2. **`job_finder/scrapers/base.py`** — ABC with `scrape()`/`get_job_details()`, shared
   session/headers/jitter. Good shape for a TS `JobSource` interface FreshlyForward
   doesn't have yet.
3. **`career-ops`'s Block G "posting-legitimacy" behavior + `detect-reposts.mjs` concept**
   — its mode files are prose/prompt-driven, not portable code anyway, so this is
   describing behavior to reimplement independently as a small heuristic (title+company+
   near-identical-description hash) inside FreshlyForward's own sync script.
4. **`career_caddy`'s "claim-next" distributed worker pattern** (Postgres
   `SELECT ... FOR UPDATE SKIP LOCKED`) — license unconfirmed, treat as a pattern to
   reimplement, not copy. Only relevant once FreshlyForward needs concurrent scrape
   runners; premature today, but the SQL idea is directly usable later since FreshlyForward
   is already on Postgres via Supabase.
5. **`swiss-job-hunter`'s two-stage scoring** (cheap keyword pre-filter → only jobs above
   threshold get an expensive LLM call). **AGPL-3.0 — do not copy code.** The *strategy*
   (keep FreshFit's free deterministic score as the pre-filter; only spend LLM budget on
   top-N matches if an LLM re-rank is ever added) is legally clean to reuse since it's an
   architectural idea, not text or code.

---

## E. Job Discovery Recommendation

**Stop scheduling Indeed scraping.** Concrete plan:

- Keep `scrapeIndeed.ts` in the repo (it's already correctly labeled best-effort/
  educational) but stop running it as the production source.
- Add Greenhouse + Lever + Ashby public JSON API sources into the same `scraped_jobs`
  table — zero auth, zero ToS risk, structured data. Follow `job_finder`'s
  `greenhouse.py` shape and `career-ops`'s "pre-configured company list" pattern (a
  `portals.yml`-style config, not a hardcoded scraper per company).
- The `20260821000000_opportunity_engine.sql` migration's own doc comment *already*
  names a licensed aggregator (Adzuna, JSearch) as the intended eventual swap-in — this
  isn't new advice, it's finishing what's already documented in the codebase.
- Schema needs no change: `scraped_jobs.source` + `external_id` unique constraint is
  already source-agnostic.
- Add the opt-in liveness/expiration sweep (Section C, #3) before scaling volume so
  `is_active` actually reflects reality.

---

## F. Forward DNA Integration Plan

**Current gap:** `freshFitScore.ts` scores against `MemberProfile.skills` (flat `text[]`),
`preferred_jobs`, `employment_history` (jsonb), and free-text summary/headline. It does
**not** touch `career_scope`, `career_responsibilities`, or `career_skills` — Forward DNA's
richer, evidence-graded skill states (`claimed`/`demonstrated`/`supported`) and scope
metrics (revenue managed, team size, budget, direct reports) currently sit unused by
matching.

Proposed integration — additive, no breaking changes to the existing scoring shape:

1. **New factor:** weight `career_skills` matches higher than generic keyword hits, and
   weight `demonstrated`/`supported` states higher than `claimed` — cross-reference JD
   skill mentions against the member's own skill-state table instead of (or alongside) the
   flat `skills[]` array.
2. **New factor:** `career_scope` as a seniority/scope-fit signal — light extraction of
   scope language from the JD ("manages a team of 10+", "$5M+ budget") compared against
   the member's own `team_size`/`budget_managed_cents`/`revenue_managed_cents`. Same spirit
   as `job_finder`'s "seniority fit" factor, but grounded in FreshlyForward's own structured
   data instead of résumé text.
3. **Keep the breakdown shape backward compatible:** add new keys to
   `JobMatchScoreBreakdown` (e.g. `dnaSkillEvidence`, `scopeFit`) rather than replacing the
   existing four factors, re-weighting them down slightly so the total still sums to 100 —
   nothing downstream (UI, existing tests) breaks.
4. **`why_it_matches` text** (used in `promoteMatchToOpportunity`) should quote Forward
   DNA evidence when available ("Demonstrated: team leadership, 12 direct reports")
   instead of only generic matched-skill names — directly serves `PRODUCT.md` principle #1
   ("a real human did this specific thing for you... visible, attributable effort") by
   making strategist-reviewed matches feel evidence-backed, not keyword-soup.
5. **Sequencing:** do this *after* Section E — better Forward DNA scoring is wasted effort
   against a shrinking, ToS-risky Indeed pool.

---

## G. Cost Analysis

- **Current FreshlyForward job-discovery cost: effectively $0.** FreshFit is a pure
  deterministic function; `scrapeIndeed.ts` is unauthenticated HTTP+cheerio (already a
  dependency); sync runs are manual `npm run` invocations. This is a genuine strength
  versus 4 of 6 audited projects, all of which assume a paid LLM key (`career-ops`,
  `career_caddy`, `swiss-job-hunter`) or a paid scraping API (`job-finder`'s Firecrawl,
  `job_finder`'s optional Apify LinkedIn fallback).
- **The recommended path (Section E) keeps cost at $0:** Greenhouse/Lever/Ashby public
  APIs are free and unauthenticated — same cost as today, just legally safer.
- **If a licensed aggregator is added later** (Adzuna free tier / JSearch on RapidAPI):
  small, bounded, predictable line items — verify current quotas before committing —
  versus the unbounded/variable cost of any LLM-per-job-description approach.
- **Forward DNA integration (Section F) is $0 marginal cost** — pure arithmetic against
  existing Postgres tables, no new external calls.
- **The one place a real LLM cost could enter:** if member-submitted-URL fetching
  (Section E/C-6) ever needs JD *extraction* from messy/unstructured pages rather than
  clean ATS JSON. At that point, `career_caddy`'s tiered-escalation idea (C-1) directly
  minimizes spend by trying free parsing first.
- Scheduled scraping (cron / Supabase Edge Function) has a small, negligible infra cost
  compared to any LLM-per-job approach.

---

## H. Risk Analysis

**Legal/ToS:**
- **HIGH, ACTIVE:** `scrapeIndeed.ts` is live in the repo, scraping indeed.com against
  their ToS. Well-written and self-documented about the risk, but running it in
  production is the site owner's decision, not something this audit is validating as
  compliant. Single highest-priority item in this whole report — see Section E.
- **MEDIUM:** `swiss-job-hunter` is AGPL-3.0. Copying any of its code — even adapted —
  would create an obligation to open-source FreshlyForward's own modifications, since
  FreshlyForward literally is "an as-a-service" offering. **Ideas only, never code**,
  which is what this report recommends throughout.
- **LOW-MEDIUM:** LinkedIn "guest" endpoint scraping (seen in `job_finder` and
  `swiss-job-hunter`) is explicitly flagged as fragile/ToS-risky by those repos'
  own authors. Do not add this as a FreshlyForward source.
- **Unconfirmed license (`career_caddy`):** do not copy code without confirming a
  license first; every "reuse" from that repo in this report is pattern-only.

**Security:**
- FreshlyForward already does better here structurally than most of what was reviewed —
  Supabase RLS, member-scoped tables, service-role-only writes for scraped data. Nothing
  to import security-wise; just keep copying the existing `job_matches`/`scraped_jobs`
  RLS pattern for any new job-related table.
- Scraping from FreshlyForward's own infrastructure risks its outbound IP getting
  rate-limited/blocked by target sites — an operational risk (breaks discovery for
  everyone at once), not just a legal one. `career_caddy`'s distributed-runner idea
  solves this at scale but is premature at FreshlyForward's current single-source volume.

**Product/trust risk:**
- Ghost jobs/scams reaching a strategist's promote queue could damage the concierge
  brand promise ("we vet everything") — Section C item #5/#8 (legitimacy flag) mitigates
  this before it becomes a support incident.
- LLM hallucination risk if any future work generates member-facing text from Forward DNA
  data — `career-ops`'s own docs mention a "story provenance" check specifically because
  their AI invented numbers before. If FreshlyForward ever auto-drafts "why it matches"
  copy from structured data, a provenance/fact-check gate belongs in that pipeline from
  day one.

---

## I. Build / Don't-Build Matrix

| Item | Verdict | Why |
|---|---|---|
| Replace Indeed scraper with Greenhouse/Lever/Ashby APIs | **BUILD — priority 1** | Removes active legal risk, zero cost, 3 repos precedent |
| Wire Forward DNA into FreshFit scoring | **BUILD — priority 2** | Data already exists unused; $0 marginal cost; serves stated product principle |
| Member-submitted job URL entry point | **BUILD — priority 3** | Clear 3-repo precedent, reuses 100% of existing scoring pipeline |
| Job posting liveness/expiration sweep | **BUILD — priority 4** | `is_active` currently means nothing; cheap, bounded pattern exists |
| Ghost-job/scam legitimacy flag | **BUILD, lower priority** | Real trust risk, matters more once discovery volume grows |
| Cross-source job de-duplication (beyond URL) | **DON'T BUILD YET** | Only one source today; premature until source #2 ships |
| Local-LLM/Ollama auto-apply or CV-tailoring pipeline | **DON'T BUILD** | Contradicts "100% human-led, hand-crafted" positioning |
| Browser extension for one-click job capture | **DON'T BUILD** | Solves a workflow FreshlyForward's concierge model doesn't have; revisit only if member-submitted-URL proves clunky |
| Multi-service microservice split (`career_caddy`-style) | **DON'T BUILD** | Solves scale problems FreshlyForward doesn't have |
| Distributed scrape-runner workers (claim-next) | **DON'T BUILD YET** | Premature; a single scheduled job suffices |
| Markdown-files-as-database (`careerbot`-style) | **DON'T BUILD** | Worse than Postgres+RLS for a multi-tenant paid product |
| LLM-based JD normalization (Firecrawl+LLM style) | **DON'T BUILD NOW** | Real cost + hallucination risk; no need while ATS APIs return structured JSON |

---

## J. Recommended Next Project

**"Job Discovery Hardening + Forward DNA Matching"** — one scoped, additive project
combining Sections E + F + the member-submitted-URL entry point (C-6/I-3), in this order:

1. Add Greenhouse/Lever/Ashby scraper sources; retire Indeed from scheduled use.
2. Add an opt-in liveness sweep for `scraped_jobs.is_active`.
3. Wire Forward DNA scoring factors into `freshFitScore.ts` (additive breakdown keys).
4. Add a member-facing "Submit a Job" entry point (paste URL or description) that runs
   through the existing FreshFit pipeline and lands as a `job_matches` row (or directly as
   an `opportunities` row, `status = 'needs_review'`).

This closes the two biggest gaps found (legal risk + unused Forward DNA data) and adds the
one clearly-missing member-facing capability, without importing any of the heavier
architecture that doesn't fit FreshlyForward's model.

---

## K. Proposed Architecture (no code)

```
[Greenhouse/Lever/Ashby public APIs]      [Member-submitted URL/text]
              │                                       │
              ▼                                       ▼
   scrapeCompanies.ts (new,                   new "Submit a Job" UI
   replaces scrapeIndeed.ts)                  (member dashboard)
              │                                       │
              └───────────────────┬───────────────────┘
                                   ▼
                          scraped_jobs table
                (existing, source-agnostic, unique on
                 source+external_id; member-submitted
                    rows tagged source='member-submitted')
                                   │
                       (optional) liveness sweep
                    marks stale rows is_active = false
                                   │
                                   ▼
                    syncFreshFitScores.ts (existing,
                  extended with Forward DNA factors:
                 career_skills state-weighting + career_scope
                 fit, alongside existing skills/role/location/
                                keyword factors)
                                   │
                                   ▼
                            job_matches table
               (existing; member reads own, strategist reads
                          assigned members')
                                   │
                    strategist reviews in Opportunity
                          Engine page (existing)
                                   │
                    promoteMatchToOpportunity() (existing,
                  now quotes Forward DNA evidence in
                             why_it_matches)
                                   │
                                   ▼
                            opportunities table
                (existing hand-curated pipeline, unchanged —
                strategist still gates everything a member
                              actually sees)
```

**Notes:**
- Everything marked "(existing)" is unchanged — this is deliberately additive, not a
  rearchitecture.
- No new services, no new hosting, no new auth model — same Supabase Postgres + RLS +
  service-role-script pattern already in place.
- No LLM in the discovery path unless/until JD extraction from non-ATS pages is needed
  later — and even then, the tiered-escalation idea (C-1) should gate that cost.

---

*Investigation only. No code was written or modified in FreshlyForward as part of this
audit. Scratch clones of the 6 external repos live outside this repo, in
`_audit-job-finder/` under the workspace root, and can be deleted at any time.*
