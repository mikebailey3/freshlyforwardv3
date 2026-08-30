# FreshlyForward Career Compass — Design Spec

## 1. Purpose

Career Compass is a free, standalone career assessment that becomes a
native FreshlyForward feature (not a bolted-on quiz). It answers four
things for a visitor or member:

1. How are you naturally wired to work? (**Part A — Archetype**)
2. What kind of environments will you likely thrive in?
3. What's currently holding your job search back? (**Part B — Forward
   Readiness**)
4. Which existing FreshlyForward service, if any, actually fits your
   needs?

A user's *personality* (Part A) must never determine how much they
should pay. Their *actual career needs* (Part B) drive the service
recommendation. It must be possible for the result to be "you don't
need to pay us anything right now" — this is a trust requirement, not
an edge case.

## 2. Existing-System Audit

| Existing capability | What it actually measures | Disposition |
|---|---|---|
| `OnboardingQuestionnaire` / `data/questionnaire.ts` | Factual profile data (employment history, skills, salary, preferences). No psychometric content. | **Reuse, untouched.** Different purpose from Career Compass. |
| `SearchReadinessWidget` / `lib/profile.ts:calculateSearchReadiness()` | Profile *completeness* percentage (are 19 fields filled in). | **Reuse the visual pattern** (0–100 score, `CircularProgress`, missing-items list, fix-it CTA). **Do not merge the logic** — Forward Readiness measures something different (career-search confidence, not form completion). Keep the two clearly distinct in copy to avoid member confusion. |
| `membership_plans` table, seeded plans | Real plans: `career-kickstart` ($49 one-time, resume-focused), `founding-member` ($39/mo), `career-growth` ($99/mo, adds mock interviews), `career-concierge` ($199/mo, top tier). | **Reuse verbatim.** These are the only plans the recommendation engine may output. No new plan names. |
| `FeatureKey`, `useEntitlements`, `ProtectedRoute` (`feature`/`requiredPlan`) | Data-driven feature gating. | **Reuse directly.** No new gating mechanism. |
| `AuthContext` + `ProtectedRoute` | Every member route redirects unauthenticated users straight to `/signin`. No anonymous/logged-out flow exists anywhere today. | **Gap.** Career Compass requires a full assessment + results experience before signup. This is new plumbing. |
| `lib/freshFitScore.ts` | Deterministic, weighted, explainable scoring with a documented breakdown, no LLM calls. | **Pattern to copy** for all Career Compass scoring modules. |
| `localStorage` usage in `src/` | None found. | Anonymous session persistence is a new pattern for this codebase — flagged as a risk, not a blocker. |
| "compass" / "archetype" anywhere in `src/` | None found (grep confirmed). | Part A is genuinely new build, not a duplicate. |
| Third-party analytics infra | None found. `career_timeline` table + `addTimelineEvent()` is the only existing lifecycle-event mechanism. | V1 reuses `career_timeline` for authenticated completion milestones. No new analytics pipeline (YAGNI). |

**Conclusion:** Part A (Archetype) = build. Part B (Forward Readiness)
= build, modeled visually/architecturally on `SearchReadinessWidget`.
Recommendation engine = build, targeting the 4 real existing plans.
Dashboard/nav integration = modify, additive only.

## 3. Architecture

New namespaced module, mirroring the existing flat `lib/` style:

```
src/data/careerCompassQuestions.ts       - 24 archetype items
src/data/forwardReadinessQuestions.ts    - 9 readiness items
src/lib/careerCompass/scoring.ts         - reverse-scoring + normalization
src/lib/careerCompass/archetypeEngine.ts - 6 weighted formulas -> primary/secondary
src/lib/careerCompass/readinessEngine.ts - readiness dimensions + barrier detection
src/lib/careerCompass/recommendationEngine.ts - plan rules vs. real 4 plans
src/lib/careerCompass/interpretation.ts  - deterministic copy templates (AI optional)
src/lib/careerCompass/session.ts         - anonymous session + claim-on-signup
src/lib/careerCompass/index.ts           - typed barrel export
```

UI:

```
src/pages/CareerCompassIntroPage.tsx
src/pages/CareerCompassAssessmentPage.tsx
src/pages/CareerCompassResultsPage.tsx
src/components/careerCompass/QuestionCard.tsx
src/components/careerCompass/CareerCompassDashboardCard.tsx
```

No new charting library. The six-dimension visualization reuses the
existing horizontal-bar / `CircularProgress` visual language already
in the app rather than introducing an SVG radar chart dependency.

Each module communicates through typed interfaces exported from
`lib/careerCompass/index.ts`; the UI layer never reaches into engine
internals directly. Code calculates (scoring/archetype/readiness/
recommendation engines are pure, deterministic, and unit-testable
without a browser or network). AI, if used at all, only rewords
already-calculated results and has a deterministic fallback — it is
never required for the feature to function.

## 4. UX Flow

```
LandingPage "Take the Free Career Compass" CTA (new)
  -> /career-compass                (intro, PUBLIC)
  -> /career-compass/assessment     (one question per screen, PUBLIC,
                                      autosaves to localStorage + a
                                      Supabase row keyed by an
                                      anonymous session id)
  -> /career-compass/results        (full report, PUBLIC — shown
                                      BEFORE any signup wall)
  -> "Save My Career Compass" CTA
  -> /signup                        (existing page, unmodified)
  -> AuthContext claims the anonymous assessment on successful auth:
       attaches user_id, KEEPS the anonymous_session_id for audit
       trail, never deletes answers
  -> /dashboard, new Career Compass card appears
  -> full report reachable anytime from a member nav item
```

Existing signed-in members can also start Career Compass directly from
the dashboard/nav without going through the anonymous path at all.

## 5. Question Bank

### Part A — Archetype (24 items, 4 per dimension)

Structured as:

```ts
interface ArchetypeQuestion {
  id: string
  text: string
  dimension: DimensionKey
  reverseScored: boolean
  weight: number
}
```

Dimensions and their 4 items each (N = normal, R = reverse-scored):

- **People Focus** — energy from working closely with others (N) ·
  prefer independent work most of the day (R) · rather build
  relationships than work solo on a task (N) · being around people all
  day drains rather than excites me (R)
- **Leadership Drive** — like being accountable for outcomes (N) ·
  comfortable directing others' work (N) · rather do great individual
  work than manage a team (R) · naturally step up when a group can't
  decide (N)
- **Structure Preference** — best work needs clearly defined
  expectations (N) · like knowing my day before it starts (N) · get
  bored by identical daily routines (R) · clear rules feel
  confidence-building, not restrictive (N)
- **Ambiguity/Risk Tolerance** — comfortable deciding without full
  information (N) · enjoy work where the path isn't fully mapped (N) ·
  sudden changes stress me more than excite me (R) · I'd rather take a
  calculated risk than wait for certainty (N)
- **Analytical ↔ Creative Orientation** — trust reasoned analysis over
  a hunch (N, analytical pole) · would rather invent a new approach
  than follow a proven process (R, creative pole) · numbers convince
  me more than a good story (N, analytical pole) · enjoy brainstorming
  new ideas more than optimizing existing systems (R, creative pole)
- **Work Pace/Energy** — thrive juggling multiple priorities (N) ·
  like environments with visible, immediate progress (N) · prefer a
  slower, deep-focus pace (R) · healthy competition motivates me (N)

Exact final question copy is written during implementation (Task 2)
against this structure; wording may be refined for 8th-grade
readability but dimension/scoring assignment above is fixed.

### Part B — Forward Readiness (9 multiple-choice items)

1. Career direction clarity (4 options)
2. Resume representation quality (5 options)
3. Confidence in search strategy / where-to-look (4 options)
4. Recent application results — also flags a corroborating barrier
   signal (5 options)
5. Interview confidence (4 options)
6. Resume recency/tailoring — second angle on resume quality, averaged
   with #2 to reduce single-item measurement noise (4 options)
7. Support preference — DIY → recommendations → alongside-me →
   fully-managed (4 options)
8. Urgency — how fast they want to move (4 options; informs
   prioritization/plan tier, not the readiness average)
9. Transition type — categorical: first job / industry change / career
   change / advancement / returning after time away (used as a
   complexity flag, not a numeric score)

## 6. Scoring Model

**Reverse scoring:** `score = reverseScored ? 6 - answer : answer`.

**Dimension normalization:** `(sum of item scores / (item count * 5)) * 100`,
producing 0–100 per dimension. Missing answers are excluded from both
numerator and denominator (never treated as zero).

**Archetype formulas** — all weights sum to 1.0, all inputs are 0–100
dimension scores, so outputs land naturally in 0–100:

```ts
Driver      = LeadershipDrive*0.35 + WorkPace*0.25 + PeopleFocus*0.15 + AmbiguityTolerance*0.25
Connector   = PeopleFocus*0.45 + LeadershipDrive*0.20 + AmbiguityTolerance*0.15 + WorkPace*0.20
Strategist  = Analytical*0.40 + Structure*0.30 + (100-PeopleFocus)*0.15 + (100-WorkPace)*0.15
Builder     = Structure*0.45 + (100-AmbiguityTolerance)*0.30 + LeadershipDrive*0.15 + PeopleFocus*0.10
Explorer    = AmbiguityTolerance*0.40 + (100-Structure)*0.30 + WorkPace*0.15 + PeopleFocus*0.15
Creator     = (100-Analytical)*0.40 + AmbiguityTolerance*0.25 + (100-PeopleFocus)*0.20 + (100-Structure)*0.15
```

Primary/secondary archetype = top two scores. **Tie-break:** fixed
priority order `[Driver, Connector, Strategist, Builder, Explorer,
Creator]` — never random, always reproducible from identical input.

**Forward Readiness overall score:**

```
Readiness = CareerDirection*0.25 + ResumePositioning*0.25
          + SearchStrategy*0.20 + ApplicationResults*0.15
          + InterviewConfidence*0.15
```

Urgency and Support Need are tracked as separate signals — they
describe preference/pace, not "how ready" someone is, and are
deliberately excluded from this average.

**Primary/Secondary Barrier:** the lowest (and second-lowest) of
`{CareerDirection, ResumePositioning, SearchStrategy,
ApplicationConversion, InterviewPerformance}`, ties broken by that
fixed left-to-right priority order.

## 7. Plan Recommendation Rules

Targets the 4 real, existing plans only:

| Condition | Recommendation |
|---|---|
| Support need ≤33 **and** readiness ≥75 **and** resume is not the barrier | No paid plan — free action plan only |
| Support need ≤33 **and** resume positioning is primary/secondary barrier **and** career direction ≥60 | `career-kickstart` ($49 one-time) |
| Support need 34–66, moderate overall readiness | `founding-member` ($39/mo) |
| Interview confidence is primary/secondary barrier, **or** support need ≥67 without a complex transition, **or** high urgency | `career-growth` ($99/mo) |
| Support need ≥80 **and** transition flagged complex (career change / re-entry / first job) | `career-concierge` ($199/mo) |

**Service-fit %:** deterministic, `70 + up to 27 bonus points` for
matched criteria (support-need band match, barrier addressed by plan
features, urgency alignment, transition-complexity alignment), capped
at **97%** — never claims 100% fit, matching the explainability
philosophy already established in `freshFitScore.ts`. "Compare All
Plans" is always shown; the user can always choose a different plan
than the recommendation.

Validated against the required test scenarios:

- Clear direction + poor resume + low support need → Kickstarter 
- Unclear direction + moderate search needs + wants guidance →
  Founding Member 
- High support need + complex transition + wants managed assistance →
  Career Concierge 
- Strong readiness + low support requirement → free action plan, no
  forced purchase 

## 8. Data Model

Two new tables, one migration, following the existing phase-numbered
migration convention:

**`career_compass_assessments`**
- `id uuid pk`
- `user_id uuid null` (nullable until claimed)
- `anonymous_session_id text null` (unguessable client-generated id;
  kept permanently even after claiming, for audit trail)
- `version text default '1.0'`
- `archetype_answers jsonb`
- `readiness_answers jsonb`
- `status text` (`in_progress` | `completed`)
- `started_at`, `completed_at`, `created_at`, `updated_at`

**`career_compass_results`**
- `id uuid pk`
- `assessment_id uuid fk`
- `user_id uuid null`
- `is_current boolean default true` (supports retakes without deleting
  history — only one `is_current=true` row per user)
- `dimension_scores jsonb`, `archetype_scores jsonb`
- `primary_archetype text`, `secondary_archetype text`
- `readiness_scores jsonb`
- `primary_barrier text`, `secondary_barrier text`
- `recommended_plan_slug text null`, `service_fit_pct int`
- `created_at`

**RLS:** authenticated users may select/insert/update rows where
`user_id = auth.uid()`. Anonymous (anon-key) clients may
select/insert/update rows where `anonymous_session_id` matches a value
they hold client-side. This is inherently weaker than
auth.uid()-scoped RLS (anyone who obtains the id could read that one
row), mitigated by: the id is a random UUID, never placed in a URL,
and never logged. Documented as an accepted risk in section 10.

## 9. AI Usage

Code calculates every score, dimension, archetype, barrier, and plan
recommendation deterministically. AI, if configured, is only ever
invoked *after* calculation completes, to reword the already-computed
result into warmer prose (archetype narrative, work-environment
description, action-plan phrasing). Every AI-touched surface has a
deterministic fallback template so Career Compass functions completely
with the AI provider unavailable or unconfigured. Raw answers are
never sent to an AI provider; only structured, already-scored results
are.

## 10. Risks / Accepted Trade-offs

1. **Anonymous sessions are new to this codebase** — no prior
   `localStorage` usage exists anywhere in `src/`. This adds a new
   testing surface (refresh/interruption/resume, expired session).
2. **Naming collision risk**: "Search Readiness" (profile completeness,
   existing) vs. "Forward Readiness" (career-search confidence, new)
   will appear near each other on the dashboard. Copy must keep them
   unmistakably distinct.
3. **No dedicated analytics pipeline in V1** — lifecycle events reuse
   `career_timeline` for authenticated completion milestones only;
   granular anonymous funnel analytics (started/abandoned per-question)
   are out of scope for V1 per YAGNI. Revisit if funnel data becomes a
   real product need.
4. **Anonymous RLS is weaker than authenticated RLS** by construction
   (a session id substitutes for `auth.uid()`). Accepted given the id
   is unguessable and never exposed in a URL or log.
5. **Dashboard/nav integration is intentionally minimal** — this spec
   does not redesign `DashboardPage.tsx` or `MemberLayout.tsx` beyond
   one new card and one new nav item, per the explicit
   don't-redesign-the-dashboard requirement.

## 11. Acceptance Criteria

Mirrors the product brief's 22 acceptance criteria directly — Career
Compass is complete only when: a logged-out user can start, survive a
refresh, and complete the assessment; all scoring is deterministic and
reproducible; Forward Readiness is calculated separately from
Archetype; a primary barrier is identified; users get real career-path
suggestions and a useful free action plan; the correct existing plan
(or no plan) is recommended per the rules in section 7; results show
before any payment; accounts can save results without losing answers;
results surface in the existing dashboard; AI failure never breaks the
feature; no job-search API is introduced; mobile/accessibility is
production quality; and no duplicate assessment/profile system was
created alongside the existing ones audited in section 2.
