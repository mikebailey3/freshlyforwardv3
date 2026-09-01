# ForwardOS Project 3 — ForwardOS Home + Forward Score — Implementation Plan

**Status: Awaiting approval. No implementation code written yet.**
Companion to `docs/superpowers/specs/2026-09-01-forwardos-home-forward-score-design.md`
(design LOCKED, approved 2026-09-01). This plan breaks that spec into
independently reviewable, TDD'd tasks — same discipline as the Forward
DNA and Career Vault plans before it: red test, green implementation,
commit, independent code-review pass, then the next task.

## Global Constraints

- **Deterministic only.** No AI/LLM anywhere in this project.
- **No new database migration.** Every input already exists in an
  already-queryable shape (confirmed in the spec's §9 self-review).
- **Zero changes** to `calculateSearchReadiness()`, `member_profiles
  .search_readiness_score`, its badge trigger, any admin/strategist
  consumer, any database view, any threshold. Read-only, display-only.
- **Zero references** to `career_wins`, `career_win_capabilities`, or
  any Career Vault module/type/route. This branch does not merge or
  cherry-pick `career-vault-capability-engine`.
- **No score persistence.** No history table, no trigger, no cron, no
  stored column for Forward Score. Computed fresh on every read.
- **Upgrade `DashboardPage.tsx` in place.** No second dashboard route
  or page. Route stays `/dashboard`; only user-facing copy changes to
  "ForwardOS Home."
- **Reuse existing tokens/components before inventing new ones.** The
  "deep navy + focused green" visual direction is not new — it's
  already defined (`--navy: #071a31`, `--green: #078a58` — the exact
  same hex as `--color-primary-600`, `--shadow`, `--radius: 22px` in
  `src/index.css`) and already used elsewhere in the app (marketing
  pages, Concierge Editorial Dashboard pass). No new color tokens are
  introduced by this plan.
- **Desktop sidebar nav and mobile bottom nav already exist** in
  `MemberLayout.tsx` and require no changes — ForwardOS Home renders
  inside the same shell every other member page already uses.
- Node PATH prefix for every shell command in this worktree:
  `set PATH=C:\Users\c0b0sty.s02638\tools\node-v22.19.0-win-x64;%PATH% &&`
- Every task: write the failing test(s) first, implement, run the full
  suite + `tsc --noEmit`, commit, then an independent code-review pass
  before starting the next task. No task starts implementation before
  its own tests exist and fail for the right reason.

---

## Task 1: Types

**Files:** `src/types/forwardScore.ts` (new)

No tests needed (pure type definitions, nothing to assert against at
runtime) — matches the precedent set by `src/types/forwardDna.ts` and
`src/types/careerVault.ts`, neither of which has its own test file.

```ts
export type ForwardScorePillarKey =
  | 'forwardDnaDepth' | 'evidenceQuality' | 'careerMomentum' | 'goalAlignment'

export interface ForwardScorePillarResult {
  key: ForwardScorePillarKey
  label: string                // e.g. "Evidence Quality"
  score: number                 // 0-100, this pillar only
  weight: number                 // 0-1, e.g. 0.30
  explanation: string            // plain-language "why this number"
  improvementLink: { label: string; to: string } | null
}

export interface ForwardScoreResult {
  total: number                  // 0-100, weighted composite
  pillars: ForwardScorePillarResult[]
}

export type NextBestMoveKey =
  | 'add_career_win' | 'complete_forward_dna' | 'review_direction' | 'review_activity'

export interface NextBestMove {
  key: NextBestMoveKey
  headline: string
  detail: string
  cta: { label: string; to: string }
}
```

**Review emphasis:** confirm this file imports nothing from
`@/lib/careerVault` or any Career Vault type (there is no such module
on this branch — this is a structural impossibility check, not a
style note).

---

## Task 2: Pillar Calculators (TDD)

**Files:** `src/lib/forwardScore/pillars.ts` (new),
`src/lib/forwardScore/pillars.test.ts` (new)

Four pure functions, each taking already-fetched plain data (no
Supabase calls inside — same DI-free, pure-function discipline as
`calculateForwardDnaCompleteness` and `calculateSearchReadiness`).

```ts
export function forwardDnaDepthPillar(completenessScore: number): ForwardScorePillarResult

export function evidenceQualityPillar(
  careerSkills: CareerSkill[],
  flatSkills: string[]
): ForwardScorePillarResult

export function careerMomentumPillar(input: {
  hasActiveApplication: boolean
  submittedInLast30Days: boolean
  hasRecentOrUpcomingInterview: boolean
  hasRespondedToMessages: boolean
}): ForwardScorePillarResult

export function goalAlignmentPillar(
  careerDirectionScore: number | null   // null = no current Career Compass result
): ForwardScorePillarResult
```

**Test cases required (per pillar, TDD — write these before the
implementation):**

*forwardDnaDepthPillar*
- Passes the input score straight through as `score`.
- `explanation` mentions Forward DNA sections, `improvementLink`
  points to `/forward-dna`.

*evidenceQualityPillar*
- Empty `career_skills` + empty flat skills → score 0, explanation
  says no skills tracked yet, link to `/forward-dna`.
- A skill present in flat `skills[]` but **absent** from
  `career_skills` (member has never opened Forward DNA) is treated as
  an implicit `claimed` (weight 0.5) — **not** scored as 0 and **not**
  written to the database as a side effect of this pure function.
  Explicit test: calling this function twice with the same input
  produces the same result and triggers zero Supabase calls (it's
  pure — verified by construction, since the function signature takes
  no client).
- A skill present in **both** lists uses the `career_skills` row's
  real state (`career_skills` wins — it's the more specific, more
  current source of truth), not the implicit-claimed fallback.
- Mix of `claimed`/`demonstrated`/`supported` produces the correct
  weighted average using the *existing* `0.5/0.8/1.0` weights from
  `forwardDna/matching.ts`'s `scoreSkillEvidence` — reused, not
  reinvented. Regression test: assert these three literal weight
  constants match `matching.ts`'s exported constants (or import them
  directly, if `matching.ts` exports them — confirm during
  implementation whether they're currently inlined or exported, and
  export them from `matching.ts` if inlined, rather than
  copy-pasting three magic numbers into a second file).
- All skills at `supported` → score 100.

*careerMomentumPillar*
- All four flags false → score 0.
- Each flag true in isolation produces exactly its documented point
  value (30/25/25/20 — sums to 100 when all true).
- All four true → score 100.
- Weighted checklist shape matches `calculateSearchReadiness`'s own
  `{ score, missing }`-style pattern for internal consistency, but
  returns the full `ForwardScorePillarResult` shape at this layer
  (the `missing`-equivalent detail folds into `explanation`).

*goalAlignmentPillar*
- `null` input (no current Career Compass result) → score 0,
  explanation "Take the Career Compass assessment," link to
  `/career-compass`.
- A numeric input (0–100) passes through directly as `score` — no
  rescaling, since `readiness_scores.careerDirection` is already
  0–100 (confirmed against `readinessEngine.ts` and the migration).
- Explanation text uses the term **"Goal Alignment"**, never
  "Career Direction Readiness" and never exposes the words "readiness
  score" — per the locked terminology requirement. Regression test:
  assert `goalAlignmentPillar(...).label` and `.explanation` never
  contain the substring `"readiness"` (case-insensitive) or the exact
  phrase `"Career Direction Readiness"`.

**Regression test (whole file):** assert `pillars.ts` never imports
`calculateSearchReadiness`, never imports anything from a `careerVault`
path, and never imports `search_readiness_score` as a literal string
anywhere in the file (same "cheap regression test over the import
graph" technique Task 12 of the Career Vault project used for its own
Search Readiness field-list lock-down).

---

## Task 3: Composite Scorer (TDD)

**Files:** `src/lib/forwardScore/score.ts` (new),
`src/lib/forwardScore/score.test.ts` (new),
`src/lib/forwardScore/index.ts` (new, typed barrel export)

```ts
export interface ForwardScoreInputs {
  forwardDnaCompletenessScore: number
  careerSkills: CareerSkill[]
  flatSkills: string[]
  momentum: { hasActiveApplication: boolean; submittedInLast30Days: boolean; hasRecentOrUpcomingInterview: boolean; hasRespondedToMessages: boolean }
  careerDirectionScore: number | null
}

export function computeForwardScore(inputs: ForwardScoreInputs): ForwardScoreResult
```

Weighted sum: `0.25 * forwardDnaDepth + 0.30 * evidenceQuality + 0.20 *
careerMomentum + 0.25 * goalAlignment`, rounded to the nearest integer,
clamped 0–100 (defensive clamp only — every pillar already produces
0–100, so this should never actually trigger, but matches the
defensive-clamping style already used in `freshFitScore.ts`'s `Math
.min(100, ...)`).

**Test cases required:**
- All four pillar inputs at their respective 0 states → total 0.
- All four at 100 → total 100.
- A known mixed case computed by hand (e.g. DNA=80, Evidence=60,
  Momentum=40, Goal=20 → `0.25*80 + 0.30*60 + 0.20*40 + 0.25*20 =
  20+18+8+5 = 51`) asserted exactly, not just "in range."
- `pillars` array always has exactly 4 entries, in the fixed order
  Forward DNA Depth, Evidence Quality, Career Momentum, Goal
  Alignment (fixed order matches the spec's hierarchy and avoids
  nondeterministic UI ordering).
- **Explicit non-dependency regression tests** (the two named in the
  spec's §7 acceptance criteria, written now, not deferred):
  1. `score.ts` (and transitively `pillars.ts`) never imports
     `calculateSearchReadiness` or references the string
     `search_readiness_score`.
  2. `score.ts` (and transitively `pillars.ts`) never imports from a
     path containing `careerVault`, and never references the strings
     `career_wins` or `career_win_capabilities`.
     (Same regex-over-source-text characterization-test technique as
     Career Vault's Task 12 Search Readiness lock-down — deliberately
     brittle-by-design as a tripwire, not a smart static analyzer.)

**Review emphasis:** this is the single highest-value task to review
carefully — it's the one place all four locked weights meet. Reviewer
should hand-verify the weighted-sum test case's arithmetic
independently rather than trusting the assertion was copy-pasted
correctly from the implementation.

---

## Task 4: Next Best Move Rules Engine (TDD)

**Files:** `src/lib/forwardScore/nextBestMove.ts` (new),
`src/lib/forwardScore/nextBestMove.test.ts` (new)

```ts
export function getNextBestMove(
  result: ForwardScoreResult,
  context: { hasActiveApplication: boolean }
): NextBestMove
```

Deterministic rule table, evaluated in a fixed priority order (not
"lowest score wins" blindly — ties and context matter, same
tie-break-by-fixed-order discipline as `readinessEngine.ts`'s
`BARRIER_PRIORITY`):

1. If Evidence Quality is the lowest-scoring pillar (or below a fixed
   threshold, e.g. 40) → `add_career_win`: "Add a Career Win" pointing
   to `/forward-dna` (**not** `/career-vault` — that route doesn't
   exist on this branch/base; see Task 7's graceful-degradation
   handling for the same constraint applied to the UI card).
2. Else if Forward DNA Depth is lowest/below threshold →
   `complete_forward_dna`: "Complete a missing Forward DNA section,"
   linking to `/forward-dna`.
3. Else if Goal Alignment is lowest/below threshold →
   `review_direction`: "Review your Career Compass / career
   direction," linking to `/career-compass`.
4. Else if Career Momentum is lowest/below threshold **and**
   `context.hasActiveApplication` is true (the "while actively
   searching" qualifier from the instruction) →
   `review_activity`: "Review your opportunities or application
   activity," linking to `/applications`.
5. Fallback (nothing below threshold, or Momentum is low but the
   member isn't actively searching) → a neutral "keep going"
   recommendation, not a fabricated urgent one — explicitly test that
   this fallback exists and is reachable, since it's the case most
   likely to be forgotten.

**Test cases required:**
- Each of the four rule branches individually, with a fixture where
  exactly that pillar is clearly the lowest.
- A tie between two pillars at the same score resolves via the fixed
  priority order above, deterministically (assert the same fixture
  produces the same result on repeated calls).
- Career Momentum low **but** `hasActiveApplication: false` → does
  **not** trigger `review_activity` (falls through to the neutral
  fallback) — this is the one rule with a context-dependent qualifier
  and the one most likely to be implemented wrong.
- Every `NextBestMove.cta.to` value is one of the routes that actually
  exist on this branch (`/forward-dna`, `/career-compass`,
  `/applications`) — regression test asserting the literal string set,
  so a future edit can't silently introduce a dead link.

---

## Task 5: Data-Fetching Hook (TDD, fake-client harness)

**Files:** `src/hooks/useForwardScore.ts` (new),
`src/hooks/useForwardScore.test.ts` (new)

Follows the same fake-Supabase-client DI pattern already established
throughout `lib/careerVault/` and `lib/forwardDna/` — `client:
SupabaseClient = defaultClient` parameter, tested with a hand-built
fake, not a mocked network layer.

Fetches, in parallel where independent:
- `career_skills` for the user (existing `getSkillStates` from
  `forwardDna/skills.ts` — **reused, not reimplemented**).
- `member_profiles.skills` (already available via `useAuth()`'s
  `profile` — no extra fetch needed if the hook is given `profile` as
  an argument rather than fetching it itself).
- The six raw booleans `calculateForwardDnaCompleteness` needs (scope,
  responsibilities, education, target role/timeframe — **reuse
  whatever helper `ForwardDnaPage.tsx` already uses to assemble this
  input**, don't duplicate that assembly logic a second time).
- `applications` (active count, submitted-in-30-days) and
  `mock_interviews`/real interview dates — **reuse the exact same
  Supabase queries `DashboardPage.tsx` already performs today**; this
  hook should replace those inline queries in `DashboardPage.tsx`
  (Task 7), not duplicate them alongside.
- `messages` read/unread state (already fetched by `DashboardPage.tsx`
  today).
- `career_compass_results.readiness_scores` where `is_current = true`
  (a new one-column read alongside the existing `career_compass
  _results` query `DashboardPage.tsx` already performs for its Career
  Compass card — extend the existing `.select()` column list, don't
  add a second query against the same table).

Returns `{ forwardScore: ForwardScoreResult | null, nextBestMove:
NextBestMove | null, loading: boolean }`.

**Test cases required:**
- Happy path: all fake data present → correct `ForwardScoreResult`
  and `NextBestMove` returned.
- No Career Compass result at all → `goalAlignmentPillar` receives
  `null`, not a thrown error or an undefined crash.
- No `career_skills` rows and empty flat skills → Evidence Quality
  pillar is 0, hook doesn't throw.
- A failed sub-query (simulated via the fake client returning an
  error) degrades that one pillar to its documented zero/empty state
  rather than crashing the whole hook — same fail-closed discipline as
  `useEntitlements`'s own try/catch.

---

## Task 6: Presentational Components (TDD where logic exists, snapshot-free for pure layout)

**Files:**
`src/components/forwardScore/ForwardScoreWidget.tsx` (new)
`src/components/forwardScore/PillarCard.tsx` (new)
`src/components/forwardScore/NextBestMoveCard.tsx` (new)
`src/components/forwardScore/ForwardScoreWidget.test.tsx` (new)

- `ForwardScoreWidget` — the primary hero. Big number, navy background
  (`bg-[var(--navy)]` or equivalent Tailwind arbitrary-value class,
  matching how `--cream`/`--navy` are already referenced elsewhere in
  this codebase via `bg-[var(--cream)]`), green accent for the score
  ring/number (`--color-primary-*` scale, already the app's green),
  `rounded-[var(--radius)]` / `shadow-[var(--shadow)]` reusing the
  exact existing tokens rather than new arbitrary shadow/radius
  values. Contains the required disclaimer line from spec §5 (exact
  wording is a copy-review detail; the *presence* of an equivalent
  sentence is what's tested).
- `PillarCard` — one per pillar, renders `label`, `score`,
  `explanation`, and `improvementLink` (if present) as a real link,
  not just text. Four pillar cards render inside a responsive grid
  (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`, matching the existing
  stat-card grid pattern already used at the top of `DashboardPage
  .tsx`).
- `NextBestMoveCard` — single, prominent card rendering `headline`,
  `detail`, and a real CTA link.

**Test cases required:**
- `ForwardScoreWidget` renders the total score and all 4 pillar
  labels; asserts the disclaimer text is present (regression-testable
  as "contains a sentence including the words 'snapshot' or
  'directional'", not brittle exact-string matching against future
  copy tweaks).
- `ForwardScoreWidget` **never renders any of the 5 banned framing
  words/phrases** — explicit test asserting the rendered output does
  not contain (case-insensitive) "hiring probability", "salary
  potential", "employer", "human worth", "objective prediction". This
  is the concrete, automatable enforcement of the spec's §5 banned-
  framings requirement — not just a copy-review reminder that can be
  silently violated by a future edit.
- `PillarCard` renders a working `<Link>` when `improvementLink` is
  present, and renders no link (not a broken one) when it's `null`.
- `NextBestMoveCard` renders the CTA as a real `react-router-dom`
  `<Link>`, not a `<button>` with no destination.

---

## Task 7: ForwardOS Home Integration (upgrade `DashboardPage.tsx` in place)

**Files:** `src/pages/DashboardPage.tsx` (edited, not replaced),
`src/pages/DashboardPage.test.tsx` (edited — existing tests must still
pass, new ones added), `src/components/MemberLayout.tsx` (one-line nav
label edit)

Changes to `DashboardPage.tsx`:
- Replace the inline `applications`/`mock_interviews`/`career_compass
  _results` queries with the `useForwardScore` hook from Task 5 (DRY —
  one fetch, not two competing fetches of the same tables).
- Heading changes from the greeting-only H1 to include "ForwardOS
  Home" as the page's identity (exact copy is a small decision made
  during implementation, not locked here beyond "ForwardOS Home is the
  user-facing name" per the spec).
- New layout order, top to bottom, matching the locked hierarchy
  exactly:
  1. `ForwardScoreWidget` (hero)
  2. `NextBestMoveCard`
  3. Four `PillarCard`s (Forward DNA Depth, Evidence Quality, Career
     Momentum, Goal Alignment — labeled "Goal Alignment" consistently,
     not "Your Direction" elsewhere, to avoid the exact terminology-
     drift risk the spec's own §9 self-review flagged; see Task 10's
     final self-review for confirmation this stays consistent)
  4. Existing Forward DNA summary card (unchanged component, just
     repositioned)
  5. **New: Career Vault graceful-placeholder card** (see below)
  6. Existing Career Compass summary card (unchanged component, just
     repositioned)
  7. Search Readiness — **existing stat card**, repositioned to this
     lower tier, **contents and calculation completely untouched**.
     Contextual-prominence rule from the spec (proposed, not locked):
     apply a visually-elevated treatment (border/shadow emphasis, not
     a data change) when `hasActiveApplication || hasRecentOrUpcoming
     Interview` is true — the exact same two booleans already computed
     for the Career Momentum pillar, reused for a UI decision only.
  8. Remaining existing sections (Recommended for You, Your Progress
     This Week, Forward Feed, Quick Access Tools) — unchanged,
     repositioned below the fold as "supporting career tools" per the
     locked hierarchy.

**Career Vault graceful-placeholder card — exact behavior (resolves
the explicit dependency instruction):** this branch has no
`career_wins` table, no `/career-vault` route, and no Career Vault
component to reuse. The card renders a muted, clearly-labeled "Career
Vault — coming soon" tile with **no dead link** (Career Vault isn't
merged yet, so there's nothing real to link to) and one sentence of
honest copy (e.g., "Track evidence-backed career wins here once Career
Vault ships."). It performs **zero queries** against any
Career-Vault-shaped table. This is intentionally the least-polished
card on the page — that's the honest reflection of its actual state,
not a bug to fix later.

**`MemberLayout.tsx` change:** the `/dashboard` nav item's `label`
changes from `'Dashboard'` to `'ForwardOS Home'` in both `navGroups`
(desktop sidebar) and the mobile bottom-nav array. This is the only
edit to this file — sidebar/bottom-nav/hamburger structure itself is
unchanged, confirmed unnecessary to touch in the design audit.

**Test cases required (in addition to every existing `DashboardPage
.test.tsx` case, which must still pass unmodified — this is the
Task-7-specific regression gate):**
- Page renders `ForwardScoreWidget`, `NextBestMoveCard`, and all 4
  `PillarCard`s.
- Search Readiness card still renders with the member's real
  `calculateSearchReadiness(profile)` value — assert the exact same
  computation path as before (this is the "existing dashboard
  functionality regression" requirement, made concrete).
- Section order in the rendered DOM matches the locked hierarchy
  (assert relative document position of the hero widget vs. the
  Search Readiness card — hero must come first).
- Career Vault placeholder card renders with no `<a>`/`<Link>` element
  pointing at `/career-vault` anywhere in the page (regression-testable
  proof the graceful-degradation rule was actually followed, not just
  described).
- `MemberLayout`'s nav renders `"ForwardOS Home"` and does **not**
  render the bare string `"Dashboard"` as a nav label anywhere
  (desktop sidebar or mobile bottom nav) — while still linking to
  `/dashboard`.

---

## Task 8: Search Readiness & Existing-Dashboard Regression Suite

**Files:** `src/lib/forwardScore/searchReadinessRegression.test.ts`
(new — same naming/shape convention as Career Vault's own
`profile.searchReadinessRegression.test.ts`)

A dedicated, narrowly-scoped regression file, separate from Task 3's
inline import-graph checks, that:
- Re-asserts (byte-for-byte against the live source, not a copy) that
  `calculateSearchReadiness`'s weighted-checklist field list in
  `src/lib/profile.ts` is unchanged by this entire project — same
  "characterization test as a tripwire" technique as before.
- Asserts `search_readiness_score` (the literal column/string) is
  never referenced anywhere under `src/lib/forwardScore/` or
  `src/components/forwardScore/`.
- Confirms (by direct source read in the test, same technique) that
  `badge_system.sql`'s search-ready trigger and every admin/strategist
  page listed in the spec's §1 audit table still reference
  `calculateSearchReadiness`/`search_readiness_score` exactly as
  before — this project's diff should show zero lines changed in any
  of those files, and this test is the automated proof, not just a
  claim in a commit message.

This task is deliberately its own commit, reviewed on its own, exactly
mirroring how Career Vault's Task 12 treated its Search Readiness
regression test as independently significant enough to isolate rather
than bury inside a larger diff.

---

## Task 9: Responsive/Mobile Implementation & Visual Verification

**No new files** — this task is verification-only, using the same
playbook already proven out during the Career Vault project's own
manual-verification gate: Playwright with full network mocking (no
live Supabase calls — this sandbox can't reach it anyway, confirmed
independently twice during Career Vault's own verification), run
against the local dev server, screenshots reviewed by eye before
anything is called done.

**Checks required, both at iPhone-SE-sized (375×667) and one larger
mobile viewport (412×915), mirroring the exact checklist already used
for Career Vault:**
- ForwardOS Home loads without horizontal scrolling at either
  viewport.
- Forward Score hero widget is the first visible element, readable at
  narrow width (no clipped text, number and label both legible).
- Next Best Move card is visible without excessive scrolling.
- Four pillar cards stack in a single column (not a broken 4-wide
  squeeze) at the narrow viewport, matching the "mobile stacked-card
  layout" requirement.
- Existing mobile bottom nav still renders and its `/dashboard` tab
  still works (this is the concrete proof `MemberLayout.tsx`'s Task 7
  edit didn't break navigation).
- Search Readiness card, now lower on the page, is reachable by
  scrolling and still renders its real score.
- Career Vault placeholder card doesn't visually break the layout
  (no overflow, no oversized empty space suggesting a missing asset).
- No tap target smaller than the existing app's own established
  minimum (spot-check against an existing, already-shipped mobile
  button as the baseline, not an invented new standard).
- Desktop viewport (e.g. 1440px wide) spot-checked once for the
  sidebar-nav-plus-hero-widget layout, confirming the existing sidebar
  from `MemberLayout.tsx` still renders correctly alongside the new
  content — this is the one desktop-specific check, since the mobile
  checklist above is otherwise the primary risk surface (new hero
  content stacking on a narrow screen).

**Any defect found here:** reproduce, add/adjust a test where
possible, fix only the defect, rerun this checklist, report the change
— same discipline as every prior verification gate in this project.

---

## Task 10: Full Regression Pass + Final Self-Review Against the Spec

**Files:** none (verification + a short addendum to this plan
document recording the outcome, same convention as Career Vault's
Task 12 status updates)

Steps:
1. `npx vitest run` — full suite green, including every new test file
   from Tasks 1–8.
2. `npx tsc --noEmit` — clean.
3. `npm run build` — clean production build.
4. **Final self-review against
   `docs/superpowers/specs/2026-09-01-forwardos-home-forward-score-design.md`**,
   checked point by point against the actual shipped code (not just
   re-reading the plan):
   - §8 Locked Decision 1 (Search Readiness excluded from calculation)
     — verified by Task 3's and Task 8's regression tests actually
     passing, not just by absence of an obvious violation.
   - §8 Locked Decision 2 (four pillars, exact weights) — verified by
     Task 3's hand-computed weighted-sum test.
   - §8 Locked Decision 3 (Goal Alignment grounded in `readiness
     _scores.careerDirection`) — verified by Task 2's
     `goalAlignmentPillar` tests and Task 5's hook actually reading
     that column.
   - §8 Locked Decision 4 (no persistence) — verified by grep: zero
     new migration files in this project's diff, zero new tables/
     triggers referenced anywhere in `src/lib/forwardScore/`.
   - §8 Locked Decision 5 (zero Search Readiness modification) —
     verified by `git diff` on `src/lib/profile.ts` and every
     admin/strategist file listed in the spec's audit table showing no
     changes at all.
   - §8 Locked Decision 6 (ForwardOS Home name, `/dashboard` route
     unchanged) — verified by Task 7's nav-label test and confirming
     no new route was added to the router config.
   - §8 Locked Decision 7 (Search Readiness secondary, contextual
     prominence) — verified visually in Task 9's screenshots.
   - §8 Locked Decision 8 (explainability, banned framings) — verified
     by Task 6's explicit banned-word regression test and every pillar
     genuinely carrying an `explanation` field (Task 2/3 tests).
   - Career Vault dependency (§2) — verified by Task 3's explicit
     import-graph regression test.
   - Naming-collision risk flagged in §9 — verified by confirming
     "Goal Alignment" is the only label used in shipped copy (Task 7),
     not "Your Direction" or "Career Direction Readiness" anywhere.
5. Record final file/test counts, `tsc`/build results, and this
   point-by-point confirmation in a short status note appended to this
   plan document (mirrors the Career Vault plan's own running status
   updates).

**No merge to `main` without your explicit approval**, consistent with
every prior guardrail in this whole ForwardOS initiative.

---

## What This Plan Does Not Cover (intentionally)

- Historical Forward Score tracking — explicitly deferred future work
  per the locked spec, contingent on the v1 model being validated.
- A strategist/admin-facing Forward Score view.
- Any FreshFit redesign to consume Forward DNA/career_skills data
  instead of flat fields — a separately-flagged, unpicked-up item from
  two prior specs, not this one's job either.
- Consolidating Search Readiness and Forward Score into one number —
  explicitly rejected by this project's own locked decisions, not
  merely postponed.
- Building or wiring anything that depends on the unmerged Career
  Vault branch. The graceful-placeholder card in Task 7 is this
  project's entire interaction with that concept.
