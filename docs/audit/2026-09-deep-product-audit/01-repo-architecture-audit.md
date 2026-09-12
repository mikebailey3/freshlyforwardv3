# FreshlyForward — Deep Repository & Architecture Audit
**Phases 1, 2, 3, 17** · Auditor: John Carter (CTO) · Date: 2026-09-12
**Commit audited:** `ec22a4b` (main) · Tree clean except untracked `_pin_models.py` (ignored per scope)

> **Method note.** This audit treats *repository reality* as authoritative. Where a
> doc claims a status the code contradicts, the code wins and the doc is logged as
> drift. Every "verified" claim below is backed by a command I actually ran; where I
> could not verify something (notably live database state) I say so explicitly rather
> than inferring.

---

## 0. Verification baseline (real output)

```
$ npm run build
tsc && vite build
2395 modules transformed.
dist/index.html                     1.80 kB │ gzip:     0.95 kB
dist/assets/index-pYXkEnMA.css     96.31 kB │ gzip:    17.62 kB
dist/assets/pdfjs-OHSPhjXw.js   1,600.73 kB │ gzip:   492.53 kB
dist/assets/index-D8HuvZaE.js   3,614.81 kB │ gzip: 1,085.79 kB
 built in 8.16s
(!) Some chunks are larger than 500 kB after minification.
```
**TypeScript: clean. Production build: clean.** One warning: no code-splitting (see §17.9).

```
$ npm run test -- --run
 Test Files  219 passed (219)
      Tests  1429 passed (1429)
   Duration  45.39s
```
**Full Vitest suite green.**

```
$ git status --porcelain=1
?? _pin_models.py
```

**Scale:** 65 files in `src/pages` · 49 files in `src/components` (+7 feature subdirs) ·
~250 files in `src/lib` · 46 Supabase migrations · 46 files in `scripts/`.

---

## 1. Inventory

### 1.1 Routing / surface map (`src/App.tsx`, single flat route table)

| Zone | Routes | Guard |
|---|---|---|
| Public marketing | `/`, `/pricing`, `/how-it-works`, `/services`, `/why-freshlyforward`, `/about`, `/contact`, `/faq`, `/privacy`, `/terms`, `/authorization` | none |
| Public content | `/forward-feed`, `/forward-feed/:slug`, `/u/:username` | none |
| Auth | `/signin`, `/signup` | none |
| Career Compass (anonymous-first) | `/career-compass`, `/career-compass/assessment`, `/career-compass/results` | none (deliberate) |
| Commerce | `/checkout/:planSlug` | `ProtectedRoute` |
| Member core | `/onboarding`, `/dashboard`, `/profile`, `/forward-dna`, `/career-vault`, `/timeline`, `/membership`, `/messages`, `/notifications`, `/settings/communication`, `/activity`, `/calendar`, `/tools`, `/founding-member`, `/friday-reports` | `ProtectedRoute` |
| Opportunity | `/opportunities`, `/opportunity-engine`, `/applications`, `/why-we-applied/:applicationId`, `/interviews` | `ProtectedRoute` |
| Resume | `/resume-intelligence`, `/resume-intelligence/builder/:resumeVersionId`, `/resume-intelligence/tailor/:opportunityId` | `ProtectedRoute` |
| Entitlement-gated | `/career-success` (career-concierge), `/mock-interviews` (career-growth), `/achievement-vault` (career-concierge), `/roadmap` (career-concierge) | `ProtectedRoute` + `feature` + `requiredPlan` |
| Other member | `/linkedin-optimizer` | `ProtectedRoute` |
| Strategist | `/strategist`, `/strategist/members`, `/strategist/members/:memberId`, `/strategist/opportunities`, `/strategist/opportunity-engine`, `/strategist/applications`, `/strategist/friday-reports`, `/strategist/blog-posts`, `/strategist/blog-posts/:postId` | roles `['strategist','admin']` |
| Admin | `/admin`, `/admin/members`, `/admin/members/:memberId`, `/admin/report-review`, `/master-admin/feature-entitlements` | roles `['admin']` |
| Internal | `/internal/design-system` | **none — see §3 D-09** |
| Fallback | `*` → redirect `/` | — |

### 1.2 Domain libraries (`src/lib`)

Cleanly decomposed by domain, each with colocated tests:

- **`freshFitScore/`** — 10 scoring modules (`skillMatching`, `roleRelevance`,
  `careerDirection`, `compensation`, `location`, `seniority`, `qualifications`,
  `exclusions`, `confidence`, `recommendation`, `tiers`, `score`,
  `jobMatchPersistence`) + barrel `index.ts`.
- **`opportunityEngine/`** — `memberOpportunityProfile`, `ranking`,
  `jobNormalization`, `jobDeduplication`, `exclusionRules`, `recurringGaps`,
  `marketIntelligence`, `qualityMetrics`, `dismissalReasons`.
- **`resumeIntelligence/`** — largest subsystem: `parsing/` (7 field extractors,
  pdf/docx/plaintext extractors, section detector, field mapper, provenance,
  anti-fabrication), `masterResume/` (13 modules), `import/`, `confirmation/`,
  `tailoring/`, `export/` (pdf + docx), `presentation/`, `templates/`, `ai/`,
  `workflow/`, plus `alignment`, `evidenceCoverage`, `contentStrength`,
  `structuralQuality`, `atsReadability`, `quantification`.
- **`forwardDna/`** — `skills`, `scope`, `responsibilities`, `matching`,
  `completeness`, `employmentEntryIds`.
- **`careerVault/`** — `capabilities`, `capabilityEngine`, `careerWins`,
  `interpreter` (interface), `deterministicInterpreter`.
- **`careerCompass/`** — `scoring`, `archetypeEngine`, `readinessEngine`,
  `recommendationEngine`, `session`.
- **`forwardScore/`** — `score`, `pillars`, `nextBestMove`.
- **`notifications/`** — `provider` (interface + NoOp), `eligibility`,
  `digestCandidates`, `digestPayload`, `digestPlanning`, `schedule`.
- **Flat/cross-cutting** — `operations.ts` (16KB), `communication.ts`,
  `fridayReports.ts`, `roadmap.ts`, `publicProfile.ts`, `linkedinOptimizer.ts`,
  `blog.ts`, `profile.ts`, `jobSubmission.ts`, `textQuality/`, `url.ts`, `utils.ts`.

### 1.3 State management

No Redux/Zustand/React Query. Exactly one React context (`AuthContext`) exposing
`{user, profile, role, loading, refreshProfile}`. Everything else is per-page
`useState` + `useEffect` with direct Supabase calls. Custom hooks:
`useForwardScore`, `useEntitlements`, `useResumeWorkflow`, `useResumeEditorState`,
`useAIResumeSuggestions`, `useBadges`, `usePageMeta`, `useScrollReveal`.

### 1.4 Provider adapters (`scripts/jobSources/`)

`greenhouse.ts`, `lever.ts`, `ashby.ts`, `adzuna.ts` — all pure
`(slug) => Promise<ScrapedJobInput[]>` mappers, fixture-tested, no network in tests.
Plus `liveness.ts` (miss-count/staleness) and `upsertCounts.ts`. Consumed by two
separate entrypoints: `scrapeCompanies.ts` (ATS, 3 providers) and `scrapeJobs.ts`
(Adzuna only).

### 1.5 Migrations — the critical inventory finding

46 migration files. **22 of them carry an explicit `NOT APPLIED` / `PREPARED FOR
REVIEW` / `REVIEW-ONLY DRAFT` / `AUTHORED, NOT APPLIED` header**, including:

`20260907120000_resume_intelligence_phase2_foundation.sql` (35KB — the entire Resume
Intelligence data foundation), `20260908010000_career_timeline_reserved_event_type_rls`,
`20260909020000_forward_profiles_public_view`, `20260911000000_scraped_jobs_dedup`,
`20260912000000_market_intelligence_snapshots`, `20260913000000_scraped_jobs_stale_detection`,
`20260914000000_member_feedback_and_exclusion_rules`, `20260915000000_harden_job_matches_update_policies`,
`20260916000000_match_digest_log`, `20260917000000_harden_get_job_match_snapshot`,
`20260918000000_job_matches_column_security_and_rls_perf`, `20260919000000_oe_rls_performance_auth_uid`,
`20260920000000_oe_fk_indexes`, `20260921000000_oe_table_grants_hardening`,
`20260922000000_fix_market_intelligence_admin_jwt_claim`, `20260923000000_fix_market_intelligence_admin_jwt_initplan_lint`.

**I cannot verify live database state from this repo** (and per charter rule 9 must
not touch it). See §17.5 — this is the single most important finding in the audit.

### 1.6 Agent configs, docs, plans

12 AI employee agent configs generated via `scripts/generateTeamAgents.mjs` +
`scripts/agents/{charter,buildAgent,roster.leadership,roster.delivery}.mjs`, verified
by `scripts/agents/verify_agents.py`. Docs: 5 canonical charter docs, 10 specs,
13 plans, 3 reviews, 1 prior audit (`docs/audit/2026-job-search-oss-audit.md`),
1 competitive registry, ~45 visual-review PNGs (~30MB).

### 1.7 Recent git history signal

Last 25 commits: OE 2.0 phases 5–11 + Final Gate + a 6-commit non-prod security
hardening sequence, then Adzuna adapter extraction + hardening, then agent roster
work, then competitive registry, then Jordan Lee's agent. **The engineering cadence
is disciplined** — security review rounds are real commits, not claims.

---

## 2. Classification

Legend: **A** COMPLETE · **B** COMPLETE BUT NEEDS POLISH · **C** PARTIAL ·
**D** PLANNED ONLY · **E** NOT STARTED · **F** LEGACY/SUPERSEDED

### 2.1 Career Intelligence

| System | Cls | Evidence | Primary files | Routes | Missing / debt | Security (→Ethan) | Recommendation |
|---|---|---|---|---|---|---|---|
| Forward DNA | **B** | `skills/scope/responsibilities/matching/completeness` all implemented + tested; `STATE_WEIGHT` state machine (claimed→demonstrated→supported) is shared and respected by Forward Score & FreshFit | `src/lib/forwardDna/*`, `src/components/forwardDna/`, `ForwardDnaPage.tsx` | `/forward-dna` | Skill identity is a case-insensitive **string**, not an entity — no skill taxonomy/aliasing table | Member-scoped RLS assumed on `career_skills`/`career_scope`; verify applied | Keep. Consider skill-entity promotion only when a real need appears (YAGNI) |
| Career Vault (wins + capabilities) | **B** | `careerWins`, `capabilities`, `capabilityEngine`, `deterministicInterpreter` implemented; genuinely careful concurrency work in `upgradeSkillToDemonstratedIfWeaker` (two atomic statements, documented race analysis) | `src/lib/careerVault/*`, `src/components/careerVault/`, `CareerVaultPage.tsx` | `/career-vault` | AI interpreter is interface-only (`CareerWinInterpreter`); only deterministic impl exists | Vault evidence explicitly firewalled from public profile — documented in `memberOpportunityProfile.ts` | Keep. Ship AI interpreter behind the existing interface when AI is wired |
| Capability Intelligence | **B** | `capabilityEngine.ts` + `career_win_capabilities` with confirmed/pending/rejected states; feeds OE scoring | `src/lib/careerVault/capabilities.ts` | via `/career-vault` | Batch upgrade loop is sequential (N round-trips per confirm) | — | Keep; batch the skill upgrades if confirm sets grow |
| Career Compass | **A** | Full assessment → scoring → archetype → readiness → recommendation chain, all tested; anonymous-first design deliberately unguarded | `src/lib/careerCompass/*`, 3 pages, `src/data/careerCompassQuestions.ts` | `/career-compass{,/assessment,/results}` | — | Anonymous session write path — confirm rate-limiting/abuse posture | Keep as-is |
| Forward Score | **B** | 4 weighted pillars (evidenceQuality .30, forwardDnaDepth .25, goalAlignment .25, careerMomentum .20) + `nextBestMove`; regression test forbids importing `calculateSearchReadiness` | `src/lib/forwardScore/*`, `useForwardScore.ts` | `/dashboard` | **Coexists with `calculateSearchReadiness` — see D-01** | — | Resolve the two-readiness-scores question (§3 D-01) |
| Career Profile / canonical model | **A** | `member_profiles` is unambiguously canonical; `src/lib/profile/entryIds.ts` backfills durable ids onto jsonb arrays so resumes can reference canonical entries | `src/lib/profile.ts`, `profile/entryIds.ts`, `CareerProfilePage.tsx`, `types/index.ts` | `/profile` | `types/index.ts` is 854 lines (over the 600 guideline) | `protect_member_profiles_privileged_fields()` trigger guards privileged columns | Keep. Split `types/index.ts` by domain |
| Goals / preferences | **B** | 19-field weighted questionnaire in `src/data/questionnaire.ts`, driving both onboarding and profile edit | `data/questionnaire.ts`, `QuestionnaireFields.tsx` (544 lines) | `/onboarding`, `/profile` | Goals live as free-text `career_goals` — not structured, so nothing can reason over them | — | Structure goals **only** if Career Compass can't already serve that need |

### 2.2 Opportunity Intelligence

| System | Cls | Evidence | Primary files | Routes | Missing / debt | Security (→Ethan) | Recommendation |
|---|---|---|---|---|---|---|---|
| FreshFit scoring engine | **A** | v2 explainable engine: 6 dimensions + hard constraints + confidence + "Unknown ≠ Missing" principle; `score.endToEnd.test.ts` + per-module tests; tier reconciliation documented | `src/lib/freshFitScore/*` | consumed everywhere | Root shim `freshFitScore.ts` still present (§3 D-02) | — | Excellent. Delete the shim |
| Opportunity Engine 2.0 | **C** | Phases 0–11 all have code (`ranking`, `recurringGaps`, `marketIntelligence`, `exclusionRules`, `qualityMetrics`, digests) — **but several depend on NOT-APPLIED migrations** | `src/lib/opportunityEngine/*`, `opportunityEngine.ts` | `/opportunity-engine` | `member_feedback`, `member_job_exclusion_rules`, `market_intelligence_snapshots`, `match_digest_log` tables unconfirmed in live DB | OE security hardening migrations (6) all NOT APPLIED | **Reconcile schema before any new OE work** |
| Provider ingestion | **B** | 4 fixture-tested adapters; source-agnostic `scraped_jobs` | `scripts/jobSources/*` | n/a (CLI) | **Two entrypoints** (§3 D-03); Adzuna excluded from liveness sweep | Adzuna licensing/attribution unresolved (owner-deferred, on record) | Fold `scrapeJobs` into `scrapeCompanies` as a provider-kind |
| Normalization / dedup | **A** | `jobNormalization.ts` (canonical employment-type enum, date canonicalization, never-invent-today rule) + `jobDeduplication.ts`, both heavily tested (13KB + 5KB of tests) | `src/lib/opportunityEngine/{jobNormalization,jobDeduplication}.ts` | n/a | dedup migration NOT APPLIED | — | Keep |
| Ranking / recommendations | **B** | `ranking.ts` + `buildRankHighlight`; noise floor 20, Top-N 25, prune only engine_v2 un-acted rows | `ranking.ts`, `jobMatchPersistence.ts` | `/opportunity-engine` | — | — | Keep |
| Exclusions | **C** | `exclusionRules.ts` implemented and wired into `buildMemberOpportunityProfile` | `opportunityEngine/exclusionRules.ts` | — | Backing table in a NOT-APPLIED migration | — | Gate on schema reconciliation |
| Gap intelligence | **B** | `recurringGaps.ts` + `RecurringGapCard`, read-only aggregation over member's own scored history | `recurringGaps.ts` | `/opportunity-engine` | — | — | Keep |
| Saved / dismissed | **C** | `dismissJobMatch` + `dismissalReasons` taxonomy; dismissal commits independently of feedback (good design) | `opportunityEngine.ts` | `/opportunity-engine` | **No "saved" concept at all** — only dismiss | — | Saved-opportunities is a real product gap |
| Strategist opportunity tools | **B** | Two distinct strategist surfaces, both substantial | `StrategistOpportunitiesPage.tsx` (645L), `StrategistOpportunityEnginePage.tsx` | `/strategist/opportunities`, `/strategist/opportunity-engine` | Two surfaces, two data models (§3 D-04) | — | Clarify the two-surface model |

### 2.3 Resume System

| System | Cls | Evidence | Primary files | Routes | Missing / debt | Security (→Ethan) | Recommendation |
|---|---|---|---|---|---|---|---|
| Resume parsing / import | **A** | pdf/docx/plaintext extractors, section detector, 7 field extractors, field mapper, **anti-fabrication test suite**, provenance tracking | `resumeIntelligence/parsing/*`, `import/*` | `/resume-intelligence` | — | Anti-fabrication guard is a genuine safety control — preserve it | Exemplary. Keep |
| Canonical identity / confirmation | **A** | `applyConfirmedProposals`, `applyCanonicalArrayWrite`; 5 distinguishable member decisions, `reject` ≠ `keep_existing_canonical` preserved | `confirmation/*`, `types/resume.ts` | `/resume-intelligence` | — | Writes to canonical profile — RLS-critical path | Keep |
| Master Resume + versions | **B** | 13 modules: create, duplicate, archive, list, promote-to-master, overrides, layout, entry validation, analyze | `masterResume/*` | `/resume-intelligence/builder/:id` | Depends on the 35KB NOT-APPLIED Phase 2 migration | `resumeVersionRpcNullAuthzRegression.test.ts` guards a null-authz RPC hole | Gate on schema reconciliation |
| Tailoring | **B** | `analyzeTailoringFit`, `createTailoredResumeVersion`, `fetchTailoringContext` | `tailoring/*` | `/resume-intelligence/tailor/:opportunityId` | — | — | Keep |
| AI suggestions | **D** | Interface + `NullResumeAIContentProvider` only; `validateGroundedProposal` enforces evidence traceability | `ai/*`, `useAIResumeSuggestions.ts` | — | **No real AI provider wired** (deliberate) | Grounding validator must stay mandatory when a real provider lands | Correct posture. Don't wire AI without the validator |
| Export / rendering | **A** | PDF (react-pdf) + DOCX exporters, template registry, `TemplateRenderer`, view model | `export/*`, `presentation/*`, `templates/` | builder | pdfjs = 1.6MB of the bundle | — | Lazy-load pdfjs (§17.9) |
| Vault→Resume relationship | **B** | Resume skills feed FreshFit as *explanation-grounding only*, explicitly "never a second evidence tier" | `getMasterResumeSkills.ts`, `memberOpportunityProfile.ts` | — | — | — | Well-drawn boundary. Keep |

### 2.4 Member Experience

| System | Cls | Evidence | Primary files | Routes | Missing / debt | Recommendation |
|---|---|---|---|---|---|---|
| Onboarding | **B** | `WizardShell` + questionnaire sections | `OnboardingPage.tsx`, `WizardShell.tsx` | `/onboarding` | No resume-upload-first path despite parsing being excellent | Consider import-first onboarding |
| Dashboard / ForwardOS Home | **C** | 627 lines, Forward Score + Search Readiness + previews | `DashboardPage.tsx` | `/dashboard` | **Ships a stale "Career Vault — coming soon" placeholder** (§3 D-05) | Fix immediately — trivial, high-visibility |
| Nav / layout | **A** | `MemberLayout` (14.8KB) used consistently by every member page I checked; `StrategistLayout` for staff | `MemberLayout.tsx`, `StrategistLayout.tsx` | all | Some routes wrap in `App.tsx`, some self-wrap — cosmetic inconsistency | Pick one convention |
| Settings | **C** | Only `/settings/communication` exists | `CommunicationPreferencesPage.tsx` | `/settings/communication` | No general settings home; privacy toggles live on profile | Consolidate a settings hub |
| Public Forward Profile | **A** | `/u/:username` reads a dedicated `public_forward_profiles` VIEW with an explicit column allow-list; test asserts it never touches `member_profiles` | `publicProfile.ts`, `PublicProfilePage.tsx` | `/u/:username` | Backing view migration NOT APPLIED | Exemplary privacy design |
| Progress / next actions | **B** | `nextBestMove.ts` priority ladder | `forwardScore/nextBestMove.ts` | `/dashboard` | — | Keep |
| Subscription / upgrade | **B** | Stripe checkout, server-side activation, pause/resume, entitlement gating | `CheckoutPage.tsx`, `MembershipPage.tsx`, `useEntitlements.ts` | `/checkout/:planSlug`, `/membership` | `useEntitlements` refetches all features per mount | Cache entitlements |

### 2.5 Career Management (Career CRM)

| System | Cls | Evidence | Routes | Missing | Recommendation |
|---|---|---|---|---|---|
| Applications | **B** | `applications` table + `operations.ts` lifecycle + member/strategist views | `/applications`, `/strategist/applications` | — | Keep |
| Interviews | **C** | `InterviewsPage` is a **filtered view of `applications`** by status, not its own entity; `set_application_interview_date` RPC | `/interviews` | One interview per application max; no rounds, panel, prep notes | Real interview entity needed for any interview-depth product work |
| Follow-ups | **C** | Single `follow_up_date` column | `/applications` | No follow-up history or reminder engine | — |
| Offers | **C** | Single `offer_details` free-text column | — | No structured offer comparison | Product gap |
| Rejections | **C** | Status value only | — | No rejection reason capture → no learning loop | Product gap; would feed gap intelligence |
| Contacts | **E** | No table, no route, no type | — | Entirely absent | Genuine CRM gap |
| Notes | **B** | `internal_notes` / `member_notes` / `member_visible_notes` split is well-considered | — | Free-text only | Keep |
| Reminders | **C** | Calendar events exist | `/calendar` | No reminder/notification engine tied to CRM state | — |
| Outcomes | **C** | Status field | — | No outcome analytics | — |

**Verdict: "Career CRM" is an application tracker, not a CRM.** Contacts absent;
interviews/offers/rejections are columns on `applications`, not entities.

### 2.6 Human Services

| System | Cls | Evidence | Routes | Notes |
|---|---|---|---|---|
| Strategist dashboard | **B** | `StrategistDashboardPage` (16.9KB) | `/strategist` | Queries `opportunities` + `applications` directly |
| Member intelligence view | **B** | `StrategistMemberWorkspacePage` — **1071 lines, largest file in repo** | `/strategist/members/:memberId` | Needs decomposition (§17.10) |
| Communication | **B** | `communication.ts`, `MessagesPage` | `/messages` | — |
| Notes / recommendations | **B** | Internal notes + `why_it_matches` / `potential_concerns` | `/strategist/opportunities` | — |
| Oversight / approval | **A** | `authorization_mode` + `awaiting_member_approval` status + `/admin/report-review` | multiple | Genuinely good human-in-the-loop design |
| Friday Reports | **A** | `fridayReports.ts`, member + strategist + admin-review surfaces | `/friday-reports`, `/strategist/friday-reports`, `/admin/report-review` | Central trust ritual, properly built |

### 2.7 Platform

| System | Cls | Evidence | Missing / risk | Recommendation |
|---|---|---|---|---|
| Auth | **A** | Supabase auth + `AuthContext`; regression test guards against unbounded profile refetch loop | — | Keep |
| Authz / roles | **B** | `ProtectedRoute` composes role + entitlement + account-status checks in one place | Client-side only — **all real enforcement must be RLS** | Verify RLS parity for every route |
| RLS expectations | **C** | 9+ dedicated RLS/hardening migrations, several static text-based regression guards | **Most hardening migrations NOT APPLIED** | §17.5 — top priority |
| Privacy controls | **A** | Public-profile allow-list view + section toggles + privileged-field trigger | Backing view NOT APPLIED | Excellent design |
| Integrations | **C** | Stripe (live), Supabase (live), Adzuna/Greenhouse/Lever/Ashby (CLI) | No calendar, no email, no ATS write-back | — |
| Notifications | **C** | Full pipeline: eligibility→candidates→payload→scheduling→dedupe; `NoOpNotificationProvider` default | **No real email provider chosen** (deliberate, gated) | Provider choice is an owner decision |
| Emails | **D** | Interface only | Same as above | — |
| Uploads | **B** | `storage_member_documents_policies.sql` + resume ingestion | — | Keep |
| Analytics | **E** | **Zero. No gtag/posthog/segment/mixpanel/custom events anywhere** | Total absence | See §17.14 |
| Subscription / billing | **B** | Stripe + webhook events table + plan/feature tables | — | Keep |
| SEO | **E** | `usePageMeta` sets title + one meta description. **No sitemap, no robots.txt, no OG/Twitter tags, no structured data, no SSR/prerender** — and it's a client-only SPA | Public marketing + `/u/:username` profiles + blog are effectively invisible to crawlers | See §17.15 — blocks Jordan Lee entirely |
| Public pages | **B** | 11 marketing pages + blog | Mid-rollout between two design languages (documented in `index.html`) | Sarah's call |
| Mobile / responsive | **B** | Tailwind breakpoints 1024/860/600/360; extensive mobile visual-review screenshots | — | Sarah's call |
| Accessibility | **B** | Skip link, `:focus-visible`, `aria-label`s, `prefers-reduced-motion`, `sr-only` usage | No confirmed WCAG target | Sarah's call |
| Error handling | **C** | Consistent `console.error` + empty-state fallbacks; `useEntitlements` fails closed | **No React error boundary anywhere**; no user-facing error reporting | Add a root error boundary |

---

## 3. Duplication & Drift Detection

| ID | Finding | Canonical | Legacy / duplicate | Severity | Action |
|---|---|---|---|---|---|
| **D-01** | **Two member-readiness scores.** `computeForwardScore` (4 weighted pillars) and `calculateSearchReadiness` (19-field weighted checklist) both produce a 0–100 "how ready are you" number. Both render on `/dashboard`. A regression test (`searchReadinessRegression.test.ts`) deliberately pins BOTH in place and asserts Forward Score never imports the other. | Forward Score (richer, evidence-aware) | `calculateSearchReadiness` — but it's load-bearing in 5 surfaces (Dashboard, CareerProfile, AdminMemberDetail, StrategistMemberWorkspace, SearchReadinessWidget) and writes `search_readiness_score` | **High (product coherence)** | Not a bug — a deliberate, tested coexistence. But two "readiness" numbers on one dashboard is a member-facing coherence problem. **Decide: is Search Readiness a profile-completeness meter (rename it) or a competing score (absorb it)?** My recommendation: rename to "Profile Completeness" — it is literally a completeness checklist — and let Forward Score own "readiness." Cheap, no logic change. |
| **D-02** | **FreshFit dual module path.** `src/lib/freshFitScore.ts` (shim) + `src/lib/freshFitScore/` (real). Node resolves the `.ts` file first, so the shim MUST forward or every importer silently misses v2. File header documents that deletion was tool-blocked twice. | `src/lib/freshFitScore/` | the root shim | Medium (footgun) | **Delete `src/lib/freshFitScore.ts`.** Also move its orphaned `freshFitScore.test.ts` (tests the shim path) into the folder. Pure cleanup, zero behavior change. |
| **D-03** | **Two job-ingestion entrypoints.** `scrapeCompanies.ts` (Greenhouse/Lever/Ashby, has liveness sweep + dedup grouping) and `scrapeJobs.ts` (Adzuna only, no liveness participation). Adzuna postings can therefore live ~45 days stale vs ~18h for ATS sources. | `scrapeCompanies.ts` (richer pipeline) | `scrapeJobs.ts` as a separate entrypoint | Medium | Fold Adzuna in as a fourth provider-kind. Already logged in kennel as D12. Not urgent, but it's the reason for a real data-quality asymmetry. |
| **D-04** | **Two parallel opportunity models.** `scraped_jobs` + `job_matches` (automated, FreshFit-scored, `/opportunity-engine`) vs `opportunities` (strategist-researched, 10-state workflow, `/opportunities`). Different tables, different types, different vocabularies, different pages. Bridged **one-way** by `job_matches.promoted_opportunity_id` + `createOpportunity`. | Both — legitimately | neither | **High (conceptual)** | This is **not** accidental duplication: machine-discovered candidates and human-curated opportunities genuinely differ. But the member sees "Opportunities" at `/opportunities` and "Opportunity Engine" at `/opportunity-engine` with no explanation of the difference. **Unify the member-facing vocabulary and surface, keep the two tables.** Do not merge the schemas. |
| **D-05** | **Stale "coming soon" placeholder shipping in production.** `DashboardPage.tsx:248-253,552-568` renders `CareerVaultPlaceholderCard` with the text *"Career Vault — coming soon"* and a comment claiming *"This branch has no `career_wins` table, no `/career-vault` route, and no Career Vault component."* **All three exist.** Route is live, `20260908000000_career_vault.sql` exists, `src/components/careerVault/` exists. A test actively pins this wrong state in place. | `/career-vault` (shipped) | the placeholder card + its test | **High (member-visible, trivially fixable)** | **Fix now.** Replace with a real Career Vault preview card; update `DashboardPage.test.tsx`. This is the clearest doc-vs-reality drift in the repo and exactly what this audit was asked to catch. |
| **D-06** | **Four referenced plan docs do not exist**, including `2026-09-10-opportunity-engine-2.0-plan.md` — cited by `freshFitScore/tiers.ts` as the authority for the *locked tier thresholds*. Also missing: `2026-09-09-forward-profiles-implementation.md` (cited in `App.tsx`), `2026-09-04-career-timeline-event-type-hardening-proposal.md`, `2026-09-04-roadmap-cross-surface-integration-wave1-plan.md`. | code comments | the missing docs | **High (governance)** | The single largest workstream's plan is unrecoverable. Either restore from history or write a consolidating "OE 2.0 as-built" doc. Locked product decisions must not live only in a code comment referencing a missing file. |
| **D-07** | **Conflicting scoring thresholds — already resolved, correctly.** FreshFit 2.0 (2026-09-05) defined 4 tiers (Strong≥80/Good≥60/Fair≥40/Weak<40); OE 2.0 superseded it with 3 (Excellent≥75/Good≥50/Fair<50). `tiers.ts` documents the supersession and explains why persisted rows are safe (tier always recomputed from the numeric score, never read from the stale `score_breakdown.v2.tier` snapshot). | 3-tier OE 2.0 scheme | 4-tier FreshFit 2.0 scheme | Low | **No action** — this is how supersession should be handled. The spec doc `2026-09-05-freshfit-2.0-explainable-scoring-design.md` still describes the old tiers; add a superseded banner. |
| **D-08** | **Duplicate skills sources — reconciled, not duplicated.** `member_profiles.skills` (flat `string[]`), `career_skills` (Forward DNA state machine), `career_win_capabilities` (Vault-confirmed), resume skills. `forwardScore/pillars.ts::reconcileSkills` explicitly merges flat + career_skills (career_skills wins, flat = implicit 'claimed'); `memberOpportunityProfile.ts` documents resume skills as grounding-only. | `career_skills` for evidence; `member_profiles.skills` for the flat list | none | Low | **No action.** The precedence rules are written down and tested. This is the system working. |
| **D-09** | **`/internal/design-system` is routed with no guard whatsoever** — not in `publicRoutes`, not in `ProtectedRoute`. Publicly reachable in production. | — | — | Medium (→Ethan) | Guard behind admin role or strip from production builds. Low exploit value, but it's an unintended public surface. |
| **D-10** | Duplicate visual-review PNGs — `reviews/screenshots/subproject1-final/` and `visual-review/2026-09-06-*/` contain byte-identical files (e.g. `about-desktop.png` 899910 B in both). ~30MB of PNGs in git. | — | duplicates | Low | Dedupe when convenient. Not worth a dedicated PR. |
| **D-11** | Abandoned experiment scripts: `scripts/tmpCheckOtherPages.mjs`, `tmpTabletOverflow.mjs`, `tmpFindOverflow.mjs`, `overflowCheck2.mjs`. Plus repo-root `tmp_github_search.py`, `tmp_github_search2.py`, `tmp_repo_details.py`, `tmp_site_sniff.py`, `dev-server.log`. | — | all of them | Low | Delete — **requires owner approval per charter rule 7.** Batch into one cleanup request. |
| **D-12** | No stale feature flags found. Entitlements are DB-driven (`features` / `plan_features`), not hardcoded booleans. | — | — | — | **Clean.** Noted as a positive. |
| **D-13** | No redundant dashboards. Member `/dashboard`, strategist `/strategist`, admin `/admin` serve genuinely different roles with different queries. | — | — | — | **Clean.** |
| **D-14** | No disconnected strategist systems. Strategist surfaces read the same `applications`/`opportunities`/`member_profiles` the member surfaces do; `calculateSearchReadiness` is shared. | — | — | — | **Clean.** |

### 3.1 Where systems fail to share canonical intelligence

1. **Career CRM outcomes never feed the scoring loop.** Rejections, offers, and
   interview results are dead-end columns. FreshFit learns nothing from whether an
   application actually succeeded. This is the biggest missed intelligence loop in
   the product — the data is *right there*.
2. **Career Compass output is under-consumed.** `readiness_scores.careerDirection`
   feeds exactly two things (FreshFit's careerDirection dimension, Forward Score's
   goalAlignment pillar). Archetype and recommendation-engine output feed nothing
   downstream.
3. **LinkedIn Optimizer is an island.** `linkedinOptimizer.ts` reads profile skills
   but writes nothing back and shares no scoring with FreshFit.
4. **Mock interviews are an island.** No connection to `applications`, interviews,
   or gap intelligence — despite gap intelligence knowing exactly which skills a
   member keeps missing.

**Overall Phase 3 verdict:** FreshlyForward is **substantially one Career Operating
System, not scattered tools.** The canonical spine (`member_profiles` → Forward DNA →
Career Vault → FreshFit → Opportunity Engine) is real, documented, and enforced by
tests. The genuine coherence problems are D-01 (two readiness numbers), D-04 (two
opportunity vocabularies), and D-05 (a lie on the dashboard) — plus the four
unclosed intelligence loops above.

---

## 17. Architecture Review

### 17.1 Canonical data ownership — **Strong**
`member_profiles` is unambiguously the identity record. `memberOpportunityProfile.ts`
is a model composition root: it names every canonical source, explains why it does
*not* refetch the profile, and documents the trust boundary. `types/resume.ts`
enforces "content is selected/overridden from `member_profiles`, never duplicated."
This is better than most production codebases.

### 17.2 Service boundaries — **Good, with one seam**
Domain libs are cleanly separated with explicit one-directional import rules
(`types/index.ts` imports from `freshFitScore/types.ts` and documents "that file must
never import back from here, or the two would cycle"). The seam: **pages call
Supabase directly** (`.from('applications')` appears in 8+ page components). There is
no repository/data-access layer. Acceptable at current size; it will hurt when RLS or
table shapes change, because the blast radius is UI files.

### 17.3 Provider adapters — **Strong**
Uniform `(slug) => Promise<ScrapedJobInput[]>` signature, fixture-tested, no
credentials in tests. Adding a provider is a genuinely additive change. The only flaw
is D-03 (two entrypoints).

### 17.4 Scoring boundaries — **Strong**
Scoring is pure functions operating on injected data. `jobMatchPersistence.ts` keeps
persistence *policy* (noise floor, Top-N, prune rules) separate from scoring *math*
and separate from DB I/O. Scripts do I/O; libs do math. Correct layering.

### 17.5 Database dependencies — **CRITICAL WEAKNESS**
**22 of 46 migrations are marked NOT APPLIED**, and application code already imports
tables from them. The codebase has compensated with an unusual pattern: *static,
text-based regression tests that parse migration SQL as text*
(`forwardProfilesPublicViewMigration.test.ts`,
`careerTimelineReservedEventTypeRlsMigration.test.ts`,
`marketIntelligenceAdminPolicyRegression.test.ts`). That is clever and shows real
discipline — **but a test that greps SQL cannot tell you whether that SQL ever ran.**

Consequences:
- Nobody can state with confidence what the live schema is.
- Six OE security-hardening migrations (RLS perf, column security, grants, FK
  indexes, JWT claim fixes) may be unapplied → **the hardening may be theoretical.**
- Features classified **C** above are C *only* because of this uncertainty; several
  may actually be A.

**This gates everything.** Per charter rule 9 only ChatGPT (Supabase/DB Lead) may
touch migrations — so the required action is a **schema reconciliation report from
the DB Lead**: diff live schema against the 46 files, produce a definitive
applied/not-applied ledger. Until that exists, every OE/Resume completion claim is
unverifiable, and I will not sign off on them.

### 17.6 State management — **Adequate now, will not scale**
One context, per-page `useState`/`useEffect`, no cache. `useEntitlements` refetches
the full features table on every mount of every gated route. `AuthContext` needed a
dedicated regression test to prevent an unbounded refetch loop — a smell. No request
deduplication, no stale-while-revalidate. **Recommendation: adopt TanStack Query
only when a concrete pain appears** (it nearly has, with entitlements). Do not
refactor state management preemptively — YAGNI.

### 17.7 Feature flags — **Good**
DB-driven entitlements, no hardcoded flags, no stale flag debt. `ProtectedRoute`
composes role + feature + plan + account-status in one auditable place.

### 17.8 Testability — **Excellent**
1429 tests across 219 files. Pure-function cores everywhere. Dependency injection via
default parameters (`client: SupabaseClient = defaultClient`) is used consistently,
making DB code unit-testable without a database. Null-object providers for AI and
email let full pipelines be exercised offline. **This is the strongest dimension of
the codebase.** Gap: no Playwright E2E specs found despite the stated stack, so no
test covers a real browser journey.

### 17.9 Scalability — **Two concrete issues**
- **Bundle:** single 3.6MB JS chunk (1.09MB gzipped) + 1.6MB pdfjs, no code
  splitting. Every visitor to the *marketing homepage* downloads the resume PDF
  parser. Direct SEO/conversion cost. **Route-level lazy loading + lazy pdfjs is the
  single highest-ROI technical fix in this audit.**
- **N+1 patterns:** `confirmCapabilities` upgrades skills in a sequential loop;
  several pages issue serial dependent queries.

### 17.10 File-size / cohesion — **Six files over 600 lines**
`StrategistMemberWorkspacePage.tsx` (1071), `types/index.ts` (854),
`StrategistOpportunitiesPage.tsx` (645), `DashboardPage.tsx` (627),
`AdminDashboardPage.tsx` (616), `QuestionnaireFields.tsx` (544, approaching).
Split by cohesion — the workspace page and `types/index.ts` are the urgent two.

### 17.11 AI-provider boundaries — **Exemplary**
Three AI boundaries (`CareerWinInterpreter`, `ResumeAIContentProvider`,
`EvidenceCoverageProvider`) all follow the same pattern: interface + honest
null-object that reports unavailability + a grounding validator
(`validateGroundedProposal`) that must pass before persistence + an anti-fabrication
test suite. **Nothing silently calls an unconfigured AI.** When AI is wired, it drops
in behind existing interfaces. This is the right architecture and it should not
change.

### 17.12 API boundaries — **Thin**
No backend API layer; the client talks to Supabase directly, so **RLS *is* the API
contract.** That makes §17.5 a security issue, not just a hygiene one. A few
server-side operations exist (Stripe checkout, membership pause/resume) and correctly
refuse to let the client write privileged fields — tests assert this.

### 17.13 Data provenance — **Strong**
`parsing/provenance.ts`, `resume_content_suggestions.evidence_reference`,
`career_win_capabilities.inference_reason`, `engine_version` on `job_matches`,
`source`/`external_id` on `scraped_jobs`. The product can explain where almost any
derived fact came from. Rare and valuable — protect it.

### 17.14 Event / activity / analytics architecture — **Weakest area**
`career_timeline` is an append-only member-visible event log with reserved event
types and RLS immutability guards — genuinely good. But there is **no product
analytics whatsoever**: no instrumentation, no funnel data, no feature-usage
telemetry. `/activity` shows the member their own timeline; nobody can answer "do
members use the Opportunity Engine?" **You are about to plan major product expansion
with zero usage data.** That is the strategic risk behind an otherwise-technical gap.

### 17.15 SEO architecture — **Not started, and structurally blocked**
Client-only SPA. `usePageMeta` sets `document.title` + one meta description *after*
JS executes. No sitemap, no `robots.txt`, no canonical tags, no OG/Twitter cards, no
JSON-LD, no SSR or prerender. Public marketing pages, the Forward Feed blog, and
every `/u/:username` Forward Profile are effectively invisible to crawlers and render
as blank cards when shared socially. **Jordan Lee (SEO Lead) cannot deliver anything
meaningful against this stack** — prerendering or SSR for public routes is a
prerequisite, not an optimization.

### 17.16 Background work — **Manual only**
`scrapeCompanies`, `scrapeJobs`, `syncFreshFitScores`, `sendDigests`,
`computeMarketIntelligence`, `reportFreshFitQuality` are all manual CLI invocations.
No scheduler. Per the standing owner decision, `scrape:jobs` must **not** be added to
CI. Result: matches only refresh when a human runs a script. Fine for pre-launch,
untenable at scale — and scheduling Adzuna specifically is blocked on the unresolved
licensing question.

### 17.17 Notification architecture — **Well-designed, deliberately unplugged**
Clean pipeline with a provider seam. One real hazard, already documented in the
source: `NoOpNotificationProvider` returns `success: true`, so running the pipeline
writes `match_digest_log` rows marking matches as "sent" when nothing was delivered.
The code warns about this explicitly. Keep that warning load-bearing.

---

## Technical work that must PRECEDE major product expansion

Ordered. Items 1–3 are blocking; 4–6 are strongly advised.

1. **Schema reconciliation (BLOCKING).** DB Lead (ChatGPT) produces a definitive
   applied/not-applied ledger for all 46 migrations, and an explicit confirmation of
   whether the 6 OE security-hardening migrations are live. *Nothing built on
   `member_feedback`, `member_job_exclusion_rules`, `market_intelligence_snapshots`,
   `match_digest_log`, or the Resume Phase 2 foundation can be called done until
   this exists.* Every **C** classification above is C because of this.
2. **Fix D-05 (BLOCKING, trivial).** Remove the false "Career Vault — coming soon"
   placeholder from the dashboard and update its test. Members are currently told a
   shipped feature doesn't exist.
3. **Restore/replace the OE 2.0 plan doc (D-06).** The largest workstream's plan is
   missing while code cites it as the authority for locked thresholds.
4. **Bundle code-splitting.** Route-level lazy loading + lazy pdfjs. 3.6MB single
   chunk is a real cost on every public page and undermines any SEO work.
5. **Decide D-01 and D-04.** Two readiness scores and two opportunity vocabularies
   are *product coherence* decisions I can implement in a day once decided — but
   they must be decided before more surfaces are built on either.
6. **Minimum analytics instrumentation.** Expanding a product with zero usage data is
   guessing. A thin event layer (respecting the existing privacy posture) before the
   next major build.

**Explicitly NOT recommended (YAGNI):** no state-management library, no backend API
layer, no microservices, no schema merge of `opportunities`/`job_matches`, no
rewrite of any domain lib. The architecture is sound; these would be motion, not
progress.

---

## Overall assessment

**Repo health: B+ / strong.** This is a disciplined, well-tested, coherently
architected codebase with unusually good provenance, evidence, and AI-safety
practices. The gap between "what's built" and "what's *verifiably* live" — driven
entirely by the unapplied-migration backlog — is the dominant risk, and it is a
process gap rather than an engineering-quality gap.

### Flagged for Ethan (security/privacy — not resolved here)
- 6 OE security-hardening migrations possibly unapplied (§17.5)
- `/internal/design-system` publicly routed and unguarded (D-09)
- RLS is the de-facto API contract; client-side `ProtectedRoute` is UX, not enforcement (§17.12)
- `NoOpNotificationProvider` false-positive "sent" records (§17.17)
- Anonymous Career Compass write path — abuse/rate-limit posture unconfirmed

### Flagged for Sarah (UX — technical angle only, noted not resolved)
- Two readiness numbers on one dashboard (D-01)
- "Opportunities" vs "Opportunity Engine" naming (D-04)
- Mid-rollout between two design languages
- No root error boundary → unhandled errors blank the page

---

## 18. Phase 16 — Missing feedback loops (does FreshlyForward learn from outcomes?)

**Author:** John Carter (CTO). **Mode:** read-only audit, no product code changed.
**Method:** traced each loop from the emitting surface through the service layer
to the persisted table, then back out to whatever consumes it. Every claim below
cites a file/line or a migration. Where I found no consumer, I say "no consumer
found" rather than implying one exists.

### Executive summary

| Loop | Exists? | Breaks at | Table/service to change | Effort |
|---|---|---|---|---|
| 1. Opportunity to view/save/dismiss to apply to interview to offer/reject to FreshFit | **Partial (~35%)** | View/save never captured; apply/interview/offer outcomes never re-enter scoring; `qualityMetrics` terminates in a human-read CLI | `job_matches`, `applications`, `member_feedback`, `src/lib/freshFitScore/score.ts` WEIGHTS | **Large** |
| 2. Resume version to applications to responses to interviews to future resume advice | **No (~5%)** | `applications.resume_version_id` is written and then only ever used to render a title string | `applications`, `resume_versions`, `src/lib/resumeIntelligence/*` | **Medium** |
| 3. Interview prep to actual questions to member reflection to Career Vault / interview intelligence | **No** | Schema exists, service layer exists, **zero UI consumers**; no question capture and no interview-intelligence system at all | `interview_prep`, `interview_feedback`, new question/reflection capture | **Medium-Large** |

---

### Loop 1 — Opportunity recommended -> viewed -> saved/dismissed -> applied -> interview -> offer/rejection -> FreshFit

#### What exists

- **Recommendation:** `scripts/syncFreshFitScores.ts` computes matches; `job_matches`
  (`supabase/migrations/20260821000000_opportunity_engine.sql:87-99`) persists
  `fresh_fit_score`, `matched_skills`, `missing_skills`, `score_breakdown`,
  `dismissed_at`, `promoted_opportunity_id`.
- **Dismiss with reason — the one genuinely closed leg.**
  `src/lib/opportunityEngine.ts:38-66` (`dismissJobMatch`) sets `dismissed_at`,
  then best-effort inserts `{ job_match_id, feedback_type: reason, comment }` into
  `member_feedback`. Backed by
  `supabase/migrations/20260914000000_member_feedback_and_exclusion_rules.sql`
  (adds `member_feedback.job_match_id` + hardened `insert_own_feedback` policy).
  UI: `src/components/opportunityEngine/DismissReasonMenu.tsx`,
  `src/pages/OpportunityEnginePage.tsx:41`.
- **Exclusion rules do feed back into scoring.**
  `member_job_exclusion_rules` -> `src/lib/opportunityEngine/exclusionRules.ts::getExclusionRules`
  -> `memberOpportunityProfile.ts:164` -> consumed as a pre-filter in
  `scripts/syncFreshFitScores.ts:97,136-137,167,176-183`. This is a real,
  end-to-end closed loop.
- **Recurring-gap insight.** `src/lib/opportunityEngine/recurringGaps.ts:108-118`
  aggregates `score_breakdown.v2.dimensions[skillsEvidence].gaps` across a member's
  matches and surfaces it via `RecurringGapCard` on `OpportunityEnginePage.tsx:33`.
  This is member-facing learning, not engine learning.
- **Outcome correlation exists — but only as a report.**
  `src/lib/opportunityEngine/qualityMetrics.ts` + `scripts/reportFreshFitQuality.ts`
  join `job_matches -> opportunities -> applications` and print tier-level
  promotion/application rates to stdout.

#### Where it breaks

1. **"Viewed" and "saved" do not exist as concepts.** Grep for
   `viewed_at|saved_at|is_saved|saveJobMatch` across `src/` returns **zero hits**.
   `job_matches` has no impression, open, or save column; `match_digest_log`
   (`20260916000000_match_digest_log.sql:52-59`) records only `sent_at` — no open,
   no click. So the funnel's first two steps are unobserved. There is also no
   product analytics layer at all (no PostHog/Amplitude/telemetry in `src/`).
2. **Dismiss reasons are write-only.** Nothing reads
   `member_feedback.job_match_id` back. `syncFreshFitScores.ts` never queries
   `member_feedback`; `getFeedback` (`src/lib/operations.ts:431`) has no caller
   anywhere in `src/`. Members tell us *why* they rejected a match and the engine
   never hears it.
3. **The dismiss -> exclusion-rule bridge is not wired in the UI.**
   `addExclusionRule`/`removeExclusionRule` (`exclusionRules.ts:81,105`) have
   **no callers outside their own test file** — grep across `src/pages` and
   `src/components` for `ExclusionRule` returns nothing. The only closed
   learning leg in Loop 1 can therefore only be populated by a script, never by
   a member repeatedly dismissing the same company.
4. **Apply / interview / offer / rejection never re-enter scoring.**
   `applications.status` carries the full outcome vocabulary
   (`StrategistMemberWorkspacePage.tsx:464`: `interview_requested`,
   `interview_scheduled`, `rejected`, `offer_received`, `offer_accepted`) and
   `applications.interview_date` exists. The **only** consumers are display
   surfaces (`MemberApplicationsPage`, `InterviewsPage`, `CalendarPage`,
   `fridayReports.ts`) and one boolean in `useForwardScore.ts:163-169`
   (`hasRecentOrUpcomingInterview` -> momentum pillar). Nothing writes back to
   `job_matches` or influences a future match.
5. **FreshFit weights are static constants that nothing validates.**
   `src/lib/freshFitScore/score.ts:14-20` hardcodes
   `skillsEvidence 0.4 / roleRelevance 0.2 / careerDirection 0.15 /
   compensation 0.15 / locationAndLogistics 0.1`, with its own docstring
   (`score.ts:6-12`) admitting: *"Provisional (design spec 5.2, MEDIUM
   CONFIDENCE) ... Validate against real production score distributions before
   treating as final."* `reportFreshFitQuality.ts` is exactly the validation
   instrument — and its output goes to a terminal a human may never run. **This
   is the single largest dead-end in the product: we built the measurement and
   never connected it to the thing it measures.**

#### What would close it

- Add `viewed_at`, `saved_at` to `job_matches` (or a narrow `job_match_events`
  table) + write path from `OpportunityEnginePage`/`JobMatchCard`.
- Add an `outcome` denormalization from `applications.status` back to the
  originating `job_matches` row (the FK chain
  `job_matches.promoted_opportunity_id -> opportunities.id <- applications.opportunity_id`
  already exists — no new relationship needed, only a read).
- Promote `computeQualityMetrics` from CLI-only into a periodic persisted
  snapshot so weight tuning becomes an evidence-based decision rather than a
  design-spec guess.
- Wire `addExclusionRule` into the dismiss flow (small, and it makes the one
  working loop actually reachable).

**Effort: Large.** Not because any one piece is hard, but because closing it
honestly means a schema change, a scoring-input change, and a decision about
whether weights are hand-tuned-with-evidence or learned. The last of those is a
product decision, not an engineering one — flagging it rather than assuming it.

---

### Loop 2 — Resume version -> applications -> responses -> interviews -> future resume recommendations

#### What exists

- `applications.resume_version_id uuid REFERENCES resume_versions(id)`
  (`20260802180911_phase4_operational_engine.sql:328`). The join is already there.
- Resume Intelligence is substantial: `alignment`, `atsReadability`,
  `contentStrength`, `evidenceCoverage`, `quantification`, `structuralQuality`,
  tailoring, templates, AI suggestions.

#### Where it breaks — immediately, at the first hop

**`applications.resume_version_id` has exactly one consumer in the entire
codebase**: `src/lib/operations.ts:169-170`, which fetches the resume's `title`
to write a timeline event string. That is the whole story. Grep for
`resume_version_id` across `src/` returns hits only in Resume Intelligence's own
internal plumbing (`resume_entries.resume_version_id`) — never joined to
`applications`.

Consequently:

- No "resume version A got 3 interviews, version B got 0" comparison exists
  anywhere.
- **Resume scoring is 100% intrinsic.** `src/lib/resumeIntelligence/score.ts:11-20`
  is a fixed severity-penalty deduction (`error 25 / warning 10 / info 3`) from a
  base of 100. Every recommendation derives from static rules about the document
  itself. Grep of `src/lib/resumeIntelligence/` for
  `applications|outcome|response_rate|interview` returns only prose in comments
  and test fixtures — **no outcome data touches resume advice**.
- There is also no "response" event captured at all. `applications.status` has
  `employer_viewed`, `interview_requested`, `rejected` — but as established in
  Loop 1, nothing aggregates those.

#### What would close it

- A read-side aggregation (`resumePerformance.ts`) joining
  `resume_versions -> applications -> status/interview_date`, following the
  existing `qualityMetrics.ts` pure-function + fetch-wrapper pattern so it stays
  testable and introduces no new table.
- Surface it on the Resume Intelligence page as evidence ("this version has been
  used on N applications, M reached interview") **before** attempting to make it
  influence scoring. Correlation at this sample size will be noise for a long
  while; claiming causal resume advice from it would be exactly the kind of
  fabricated confidence this codebase is otherwise disciplined about avoiding.

**Effort: Medium.** No schema change required — the FK already exists. This is
arguably the **best effort-to-value ratio of the three loops**, because the data
is already being written and is simply never read.

---

### Loop 3 — Interview preparation -> actual questions encountered -> member reflection -> Career Vault / interview intelligence

#### Direct answer to the question asked: **there is no interview intelligence system.** Confirmed, not assumed.

There is no question bank, no captured-question store, no reflection capture, and
nothing that turns a real interview into reusable member or platform knowledge.

#### What exists (and this is the notable part)

The schema and service layer for this loop were **built and then never wired to a UI**:

- **`interview_prep`** (`20260802190429_phase5_founding_member_communication.sql:284-307`)
  — a rich table: `company_overview`, `role_summary`, `important_qualifications`,
  `talking_points`, `star_story_suggestions`, `questions_to_ask`,
  `salary_guidance`, `research_notes`, `checklist jsonb`, `uploaded_notes`, with
  full member + assigned-strategist RLS.
- **`interview_feedback`** (same migration, lines 356-377) — 8 scored dimensions
  (`confidence`, `communication`, `leadership`, `professionalism`, `storytelling`,
  `star_method`, `body_language`, `preparation`) plus `areas_to_improve`,
  `action_plan`, `next_goals`, `member_acknowledged`.
- **Full CRUD service layer**: `src/lib/communication.ts:183-240` —
  `getInterviewPrep`, `createInterviewPrep`, `updateInterviewPrep`,
  `getInterviewFeedback`, `createInterviewFeedback`, `updateInterviewFeedback`.
- **Typed**: `src/types/index.ts:702-745` (`InterviewPrep`, `InterviewFeedback`).

#### Where it breaks

**None of those six functions has a single caller.** Grep across all of `src/`
for `getInterviewPrep|createInterviewPrep|updateInterviewPrep|createInterviewFeedback|updateInterviewFeedback`
returns **only their own definitions in `communication.ts`** — no page, no
component, no hook, no test. The only file importing from `@/lib/communication`
in the interview area is `src/pages/MockInterviewPage.tsx:4-8`, and it imports
only `createCalendarEvent` and `createNotification`.

`MockInterviewPage.tsx` instead reads `mock_interviews.feedback` — a **plain
`text` column** on the booking row (`src/types/index.ts:321`) rendered as
free prose in its `InterviewCard`. So the structured 8-dimension feedback model
is bypassed in favour of an unstructured string.

The other near-miss: `why_we_applied.interview_prep_notes`
(`src/types/index.ts:579`) is displayed read-only at
`WhyWeAppliedPage.tsx:153-155` and is always written as `null`
(`src/lib/operations.ts:198`).

**Net result:** a member is prepped, walks into a real interview, encounters real
questions, and *none of it is ever captured*. Career Vault
(`career_wins`, `career_win_capabilities`) has **no relationship to interviews at
all** — grep of `src/lib/careerVault/` for `applications|opportunity|interview|job_match`
returns zero hits. The single signal that survives an interview is a boolean:
`useForwardScore.ts:167-169` notes that an interview happened, for the momentum
pillar. That is the entire feedback surface of a completed interview.

The **highest-value missed connection** in the whole audit sits here: a real
interview is the single richest source of Career Vault evidence a member will
ever produce ("I was asked to describe a time I led a migration; I told the X
story; it landed"). Today that evaporates.

#### What would close it

- A post-interview reflection capture (questions encountered, what went well,
  what to reuse) — new table, or an `interview_reflections`-shaped extension.
- Wire the **already-built** `interview_prep` / `interview_feedback` service
  layer to real UI (this part is arguably a wiring defect, closer in character to
  the Career Vault defect below than to a missing feature).
- A "promote this interview story into Career Vault" action — the highest-value
  and lowest-schema-risk piece, since `career_wins` already accepts member-authored
  wins and `capabilityEngine` already extracts capabilities from them.

**Effort: Medium-Large.** Medium for wiring the existing prep/feedback tables
(pure UI work over existing schema + services). Large if "interview intelligence"
means aggregated question patterns across members — that crosses a privacy
boundary (cross-member aggregation of interview content) and is a **product
decision for Alex/owner, not an engineering call I should make here.**

---

### Cross-cutting observation

All three loops fail the same way, and it is worth naming precisely because it is
*not* a quality problem: **FreshlyForward is excellent at deterministic,
explainable forward computation and has essentially no backward path.** Every
engine (FreshFit, Forward Score, Resume Intelligence, `capabilityEngine`) is a
pure function of currently-stored profile state. Outcomes are stored faithfully
and are read almost exclusively by display surfaces.

That is a defensible v1 posture — it is why the product never fabricates
confidence, and the "Unknown != Missing" discipline throughout the scoring code
is genuinely good engineering. But it means the product **cannot currently get
better at its core job from use.** Every improvement to recommendation quality
today requires a human editing a constant in `score.ts`.

**Architectural recommendation (not scheduling it here):** if the owner wants any
of these closed, do Loop 2 first. It needs no migration, no privacy decision, and
no product call — only a read of data already being written. Loops 1 and 3 both
require schema plus a genuine product decision, and per the charter those are
escalations, not CTO calls.

---

## 19. Gap Register entry — Career Vault "coming soon" (D-05), re-confirmed

### Framing: I agree. This is a **product/UX integration defect, NOT a missing feature.**

Career Vault is **fully built and shipped**. Recording it as a missing feature
would materially misrepresent the state of the product in the Gap Register.

### Evidence that Career Vault is complete

| Artifact | Path |
|---|---|
| Migration | `supabase/migrations/20260908000000_career_vault.sql` — `career_wins` (line 74), `career_win_capabilities` (line 132), RLS + strategist policies, `updated_at` triggers |
| Domain logic | `src/lib/careerVault/` — `careerWins.ts`, `capabilities.ts`, `capabilityEngine.ts`, `deterministicInterpreter.ts`, `interpreter.ts` (each with a colocated `.test.ts`) |
| Components | `src/components/careerVault/` — `AddCareerWinModal.tsx`, `CareerWinCard.tsx`, `CareerVaultTeaserCard.tsx` (each with tests) |
| Page | `src/pages/CareerVaultPage.tsx` |
| Live route | `src/App.tsx:176` — `path="/career-vault"` |
| Live nav entry | `src/components/MemberLayout.tsx:43` — `{ to: '/career-vault', label: 'Career Vault', icon: Trophy, isNew: true }` |
| Cross-link that works | `src/pages/ForwardDnaPage.tsx:19,192` renders `<CareerVaultTeaserCard />`, which links correctly to `/career-vault` |
| Consumed by scoring | `src/lib/opportunityEngine/memberOpportunityProfile.ts:164` reads `career_win_capabilities` (status `confirmed`) into FreshFit |

### The defect — exact file/line evidence

**1. The false comment at the render site — `src/pages/DashboardPage.tsx:248-253`:**

```tsx
{/* Career Vault (locked layout position 5) -- graceful placeholder.
    No Career Vault table/route/component exists on this branch yet
    (unmerged, separate work), so this is intentionally the
    least-polished card on the page: static, prop-less, zero queries,
    and no link at all (there's nothing real to link to yet). */}
<CareerVaultPlaceholderCard />
```

**2. The false docblock + the shipped placeholder — `src/pages/DashboardPage.tsx:551-574`:**

```tsx
/**
 * Task 7: Career Vault graceful placeholder. This branch has no
 * `career_wins` table, no `/career-vault` route, and no Career Vault
 * component to reuse (that work is unmerged, on a separate branch).
 * ...
 */
function CareerVaultPlaceholderCard() {
  ...
  <h2 className="font-display !text-base font-semibold text-ink-muted">Career Vault — coming soon</h2>   // line 566
  <p className="mt-1 text-xs text-ink-muted">
    Track evidence-backed career wins here once Career Vault ships.                                      // line 568
  </p>
```

Every one of the three claims in that docblock is false as of HEAD: the table
exists, the route exists, the components exist.

**3. A test actively pins the wrong state in place — `src/pages/DashboardPage.test.tsx:172-203`:**

```ts
it('renders the Career Vault placeholder card with no link inside the card itself pointing at /career-vault', async () => {
  ...
  const heading = await screen.findByRole('heading', { name: 'Career Vault \u2014 coming soon' })   // line 184
  const description = screen.getByText('Track evidence-backed career wins here once Career Vault ships.')  // line 185
  ...
  expect(cardLinks.some((a) => a.getAttribute('href') === '/career-vault')).toBe(false)              // line 201
})
```

This test was *updated* on 2026-09-08 to acknowledge that Career Vault now
exists (see its own comment at lines 177-183) — and then deliberately narrowed to
keep asserting the placeholder. It is a green test enforcing a user-visible lie.
Any fix **must** update this test in the same commit or the build goes red.

### Impact

Highest-traffic authenticated surface in the product (`/dashboard`) tells every
member that a fully shipped, nav-linked flagship feature "is coming soon," in the
same viewport as a working nav link to that feature. Cross-referenced with Nina's
QA finding (`05-qa-testing-review.md:124-141`) and Sarah's walkthrough
(`02-ux-product-walkthrough.md`).

### Effort estimate: **Small.**

Concretely: delete `CareerVaultPlaceholderCard` (DashboardPage.tsx:551-574),
replace the call site (line 253) with the existing, already-tested
`CareerVaultTeaserCard` — reused, not rebuilt, and already proven to link
correctly from `ForwardDnaPage` — and rewrite `DashboardPage.test.tsx:172-203` to
assert the real card. Roughly a 3-file, ~40-line diff plus test updates. **No new
functionality, no migration, no schema change, no new component.** Pure UI
wiring.

**Register classification:** `product/UX integration defect` - severity **high**
(user-visible false statement on the primary authenticated surface) - effort
**small** - blocking for release - owner: engineering (not product).

---

*Phase 16 addendum appended by John Carter, CTO. Read-only audit — no product
code was modified. All file/line references verified against HEAD at the time of
writing; no build or test run was performed for this section because no code
changed.*
