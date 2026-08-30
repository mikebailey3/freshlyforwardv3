# Career Compass UI & Signup Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the actual user-facing Career Compass assessment: an
intro page, a 33-question wizard (24 archetype + 9 readiness) reusing
the existing onboarding wizard's chrome, a public results page shown
before any signup wall, a results-aware signup redirect, a public nav
entry point, and a dashboard card for members. This is the third and
final plan in the Career Compass sequence (core engines -> persistence
-> this).

**Depends on (already merged):** `src/types/careerCompass.ts`,
`src/data/{careerCompassQuestions,forwardReadinessQuestions}.ts`,
`src/lib/careerCompass/{scoring,archetypeEngine,readinessEngine,
recommendationEngine,session}.ts`, `AuthContext.signUp`'s anonymous
conversion branch.

**Spec:** `docs/superpowers/specs/2026-08-29-career-compass-design.md`.

**Confirmed design decisions (this session, not re-litigated):**
1. The assessment wizard reuses the existing onboarding wizard's visual
   shell (own minimal header + progress bar + sticky bottom nav, no site
   nav) — extracted into a new shared `WizardShell` component so
   `OnboardingPage` and this feature don't duplicate ~100 lines of
   near-identical chrome.
2. `SignUpPage` gets a new redirect branch specifically for visitors
   completing signup from the Career Compass results page.
3. Discovery is both a public nav link (`SiteHeader`) and a dashboard
   card for existing members.

## Global Constraints

- No new npm dependencies.
- No emojis in code, comments, or commit messages.
- WCAG 2.2 AA: every question screen's radio/scale options must be
  keyboard-navigable with visible focus states, correct `role`/`aria-*`
  on the progress bar (already established in `OnboardingPage`, reuse
  that pattern verbatim), and every image/icon-only control needs an
  `aria-label`.
- The assessment wizard is **public** (no `ProtectedRoute` wrapper) —
  it must work with zero Supabase session at all until the visitor
  answers their first question, at which point `ensureAuthenticatedSession()`
  (already built) silently establishes the anonymous session. Never call
  it eagerly on page load before any interaction — only on first answer,
  so a visitor who bounces immediately never creates a throwaway anonymous
  auth user.
- Reuse the pure engines exactly as they are (`runArchetypeAssessment`,
  `calculateReadiness`, `recommendPlan`) — this plan does not touch
  `src/lib/careerCompass/{scoring,archetypeEngine,readinessEngine,
  recommendationEngine}.ts` or their tests at all.
- Follow existing page conventions exactly: Operate-mode pages (anything
  inside `MemberLayout`, and this new wizard which mirrors `OnboardingPage`)
  use Tailwind utility classes and `font-display` headings; Persuade-mode
  public pages (the intro/landing page for Career Compass, since it's
  reached from the public nav before the wizard starts) use the existing
  plain-class global-CSS convention (`.shell`, `.button`, `.eyebrow`,
  etc. — see `SignUpPage.tsx` or `LandingPage.tsx` for the pattern).
- `completeAssessment` is not yet atomic (documented, deferred prerequisite
  from the persistence plan). This plan's results page must handle that
  gracefully: if `completeAssessment` returns an error, show a clear
  "something went wrong, your answers are saved, try again" message and
  a retry button — never silently show a blank/broken results page.

---

## Task 1: Extract `WizardShell` from `OnboardingPage` (pure refactor)

**Files:**
- Create: `src/components/WizardShell.tsx`
- Modify: `src/pages/OnboardingPage.tsx` (use the new component, remove
  the now-duplicated chrome)

**Why first:** every other task in this plan depends on this component
existing. Doing it as an isolated refactor first, verified to not change
`OnboardingPage`'s behavior at all, means Task 2 builds on a stable,
already-reviewed foundation instead of a moving target.

**Interface (`WizardShell` props):**
```ts
interface WizardStep { key: string; label: string }
interface WizardShellProps {
  steps: WizardStep[]
  currentStep: number
  completedSteps: string[]
  onStepClick?: (index: number) => void   // OnboardingPage passes handleSkipToStep; Career Compass passes undefined (no free navigation between questions)
  onBack: () => void
  onNext: () => void
  backDisabled: boolean
  nextLabel: string
  saving?: boolean
  savedIndicator?: boolean
  brandLabel?: string   // defaults to "FreshlyForward" -- OnboardingPage keeps default, Career Compass may override to "Career Compass"
  children: ReactNode
}
```

- [ ] Extract the header (logo/wordmark + saving/saved indicator), progress
  bar, step-indicator row, main content wrapper (`animate-fade-in` on
  `children`), and sticky bottom nav exactly as they exist today in
  `OnboardingPage.tsx` into `WizardShell`, parameterized by the props above.
- [ ] `OnboardingPage.tsx` is rewritten to pass its existing `onboardingSteps`,
  state, and handlers into `<WizardShell>`, keeping every existing behavior
  (skip-to-step via step-indicator click, saving/saved indicator timing,
  progress bar percentage math, "Go to Dashboard" label on the last step)
  byte-identical from a user's perspective.
- [ ] Manual verification (no existing `OnboardingPage` test file exists):
  run `npx vitest run` for regressions elsewhere, then read the diff
  side-by-side against the original to confirm no behavior changed, only
  which file the JSX lives in.
- [ ] Commit: `refactor(onboarding): extract shared WizardShell from OnboardingPage`

---

## Task 2: Career Compass Assessment Wizard

**Files:**
- Create: `src/pages/CareerCompassIntroPage.tsx` (Persuade-mode, public,
  reached from nav — explains the two-part assessment, has a "Start My
  Career Compass" button)
- Create: `src/pages/CareerCompassAssessmentPage.tsx` (Operate-mode,
  uses `WizardShell`, one question per screen)
- Create: `src/components/careerCompass/ArchetypeQuestionScreen.tsx`
  (1-5 agree/disagree scale, radio-group semantics)
- Create: `src/components/careerCompass/ReadinessQuestionScreen.tsx`
  (single-select option list, radio-group semantics)

**Behavior contract for `CareerCompassAssessmentPage`:**
- On mount: does NOT call `ensureAuthenticatedSession()` yet (per Global
  Constraints). Renders the first unanswered question immediately from
  local component state.
- On the visitor's first answer: calls `ensureAuthenticatedSession()`,
  then `startOrResumeAssessment(userId)` to get an `assessmentId` (and
  resume any in-progress answers if this is a repeat visit — pre-fill
  local state from `archetypeAnswers`/`readinessAnswers` if present).
- On every subsequent answer: updates local state immediately (no
  perceptible lag advancing to the next question), then fires
  `saveAssessmentAnswers(assessmentId, archetypeAnswers, readinessAnswers)`
  in the background (don't block navigation on the network call — errors
  here are non-fatal, answers still exist in local state and will be
  retried on the next answer).
- Question order: all 24 archetype questions first (in
  `archetypeQuestions` array order), then all 9 readiness questions (in
  `forwardReadinessQuestions` array order) — matches the spec's Part
  A-then-B structure.
- On the final question answered: runs `runArchetypeAssessment`,
  `calculateReadiness`, `recommendPlan` locally, calls
  `completeAssessment(...)`, then navigates to `/career-compass/results`
  passing the computed result via `location.state` (avoid a redundant
  re-fetch — the results page can fall back to reading from the database
  by `assessmentId` in a query param if `location.state` is empty, e.g.
  after a page refresh).
- Back button: goes to the previous question, never past question 1
  (first question's Back button should be disabled, matching
  `WizardShell`'s `backDisabled` prop wired to `currentQuestionIndex === 0`).

- [ ] Write `CareerCompassIntroPage` (Persuade-mode, public route
  `/career-compass`): explains Part A (Career Archetype) and Part B
  (Forward Readiness), sets expectation ("free, ~5 minutes, no signup
  required to see your results"), single CTA to `/career-compass/assessment`.
- [ ] Write `ArchetypeQuestionScreen` and `ReadinessQuestionScreen` as
  small, focused presentational components (question text + options +
  an `onAnswer(value)` callback) — no data-fetching inside either, all
  state lives in the parent page.
- [ ] Write `CareerCompassAssessmentPage` implementing the behavior
  contract above, using `WizardShell` with `steps` derived from the
  combined 33-question list (or a coarser 2-phase step list — Archetype /
  Readiness — mirroring how the spec describes "Part A then Part B"
  rather than 33 individual step dots, which would be visually
  overwhelming; use your judgment on the granularity of the step
  indicator specifically, everything else in the behavior contract is
  fixed).
- [ ] Add a basic component test for the resume-in-progress path: given
  a fake `startOrResumeAssessment` return with existing partial answers,
  the page renders starting from the first *unanswered* question, not
  question 1.
- [ ] Run `npx vitest run` — zero regressions, new tests passing.
- [ ] Commit: `feat(career-compass): add assessment intro and wizard pages`

---

## Task 3: Results Page + Signup-Aware Redirect

**Files:**
- Create: `src/pages/CareerCompassResultsPage.tsx` (Persuade-mode,
  public route `/career-compass/results`)
- Modify: `src/pages/SignUpPage.tsx`

**`CareerCompassResultsPage` behavior:**
- Reads the computed result from `location.state` if present (fast
  path, no network call); otherwise falls back to reading
  `assessmentId` from a query param and querying `career_compass_results`
  directly for the row where `is_current = true` (slow path, handles a
  page refresh or a shared/bookmarked link).
- Shows: primary + secondary archetype (with a short description per
  archetype — plain descriptive copy, not AI-generated, per spec's
  deterministic-first design), the Forward Readiness score and primary
  barrier, and the plan recommendation (or a clear "no purchase
  needed right now" message when `planSlug` is `null`, worded
  positively, not as a rejection).
- Primary CTA: **"Save My Career Compass"** — links to
  `/signup?compass=1` (query param signals the redirect branch below).
  Secondary, lower-emphasis link: **"Already have an account? Sign in
  instead"** to `/signin?redirect=%2Fdashboard%3Fcompass%3Dsaved`
  (confirmed by reading `SignInPage.tsx`: it already supports a
  `redirect` query param via a plain `useEffect`, no code change needed
  there).

  **Known, deliberately scoped-out limitation (document in the UI copy,
  do not silently omit):** the in-place anonymous-to-permanent
  conversion built in the persistence plan only works for the **signup**
  path (`updateUser` keeps the same `auth.uid()`). Signing in to an
  **existing** account discards the anonymous session entirely in favor
  of that account's own session — there is no safe way to reconcile the
  two without new server-side JWT-verification infrastructure (an Edge
  Function or RPC that verifies both the old anonymous token and the new
  session's token before migrating rows), which is out of scope here.
  Concretely: a visitor who takes the assessment anonymously and then
  chooses "sign in" instead of "sign up" will lose that specific
  anonymous assessment (not corrupted or leaked — just unreachable,
  since nothing will ever authenticate as that anonymous uid again once
  its session is discarded). The secondary link's copy must say something
  like "Signing in won't keep this specific result — sign up instead to
  save it" rather than implying seamless continuity it can't deliver.
- If `completeAssessment` had errored (surfaced via `location.state.error`
  or a failed slow-path fetch), render the retry state described in
  Global Constraints instead of a partial/broken results view.

**`SignUpPage` change:**
- [ ] Add a `compass = searchParams.get('compass')` read alongside the
  existing `planSlug` read.
- [ ] After a successful `signUp` call, the post-signup navigation
  becomes: `compass ? '/dashboard?compass=saved' : planSlug ? `/checkout/${planSlug}` : '/onboarding'`
  — Career Compass takes priority over the plan/onboarding branches
  since a visitor who did both (selected a plan AND took the assessment)
  is a rare edge case where showing them their now-permanently-saved
  results context on the dashboard is more valuable than silently
  dropping them into checkout with no acknowledgment of what they just
  did. Do not remove or reorder the existing two branches otherwise.
- [ ] `DashboardPage` (Task 4) reads `?compass=saved` to show a one-time
  confirmation banner ("Your Career Compass results have been saved to
  your account") — small, dismissible, not a modal.

- [ ] Run `npx vitest run` — zero regressions.
- [ ] Commit: `feat(career-compass): add public results page and signup-aware redirect`

---

## Task 4: Routing, Public Nav Link, Dashboard Card

**Files:**
- Modify: `src/App.tsx` (new routes)
- Modify: `src/components/PublicLayout.tsx` (nav link)
- Modify: `src/pages/DashboardPage.tsx` (new card + `?compass=saved` banner)

- [ ] Add three routes to `App.tsx`: `/career-compass` (Intro, public),
  `/career-compass/assessment` (Assessment, public), `/career-compass/results`
  (Results, public). Add all three to the `publicRoutes` array so
  `isPublicRoute` doesn't misclassify them — but note `WizardShell`
  itself renders its own header, so confirm visually whether
  `SiteHeader`/`SiteFooter` double up with `WizardShell`'s chrome on the
  Assessment page; if so, the Assessment route should NOT be in
  `publicRoutes` (matching `OnboardingPage`'s existing precedent of not
  needing `SiteHeader`/`SiteFooter` despite technically being reachable
  without checkout). The Intro and Results pages, being Persuade-mode,
  SHOULD be in `publicRoutes` for the normal site chrome.
- [ ] Add one nav link to `PublicLayout.tsx`'s `navigation` array, e.g.
  `['/career-compass', 'Free Career Assessment']` — placement in the
  array is a judgment call, but put it somewhere that doesn't bury it
  (not last) given it's meant to be a real acquisition entry point per
  the confirmed design decision.
- [ ] Add one new card to `DashboardPage.tsx` following the existing
  card conventions (`rounded-xl border border-neutral-200 bg-white p-6
  shadow-sm`, `font-display` section heading) — for a member who has
  never taken the assessment: "Discover your Career Compass" CTA to
  `/career-compass`; for a member who has: show their primary archetype
  + a "Retake" link. Query `career_compass_results` for the
  `is_current = true` row scoped to `user_id = auth.uid()` (already
  correctly enforced by the existing RLS policy — no new access pattern
  needed).
- [ ] Add the one-time `?compass=saved` confirmation banner described in
  Task 3, dismissible, not persisted (fine to reappear on a hard refresh
  of that exact URL — it's a one-shot query param, not app state).
- [ ] Run `npx vitest run` — zero regressions.
- [ ] Commit: `feat(career-compass): wire routing, public nav entry point, dashboard card`

---

## Suggested Review Emphasis (for whoever reviews each task)

Unlike the two prior Career Compass plans, this one is UI-heavy and
lower-risk on the "silent security defect" axis (no new tables, no new
RLS) — the two things most worth scrutinizing here instead are:
1. **The anonymous-session-creation timing constraint** (never call
  `ensureAuthenticatedSession()` before the first answer) — verify this
  by reading the actual mount-time code path, not just trusting a
  comment saying it's deferred.
2. **The `WizardShell` extraction in Task 1 actually being behavior-
  preserving** — since `OnboardingPage` is real, already-shipped,
  authenticated member-facing code, a regression there is a real user
  -facing bug, not a hypothetical.
