# Sub-Project 7: Career Success Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modernize `src/pages/CareerSuccessPage.tsx` into the approved
three-teaser Hybrid "Coaching & Growth Hub" — real existing catalog content,
re-chromed to the Sub-Project 3–6 visual language, plus three real-data-only
teasers (Next Steps, Roadmap link-out, Achievement Vault/evidence) — with
zero new business logic, zero fabricated data, and zero regressions to
existing feature-gating or navigation.

**Spec:** `docs/superpowers/specs/2026-09-06-redesign-subproject7-career-success-design.md`

**Tech stack:** React 18 + TypeScript + Vite + Tailwind CSS v4 + Vitest +
React Testing Library + `lucide-react` + `react-router-dom` + Supabase JS
client.

## Global Constraints

- Locked and not to be reopened: Homepage (`d970705`), Opportunity Engine
  (`32d9e07`), ForwardOS Home (`ad26230`), Achievement Vault (`ca81baf`),
  Career Profile (`296206d`).
- Do not fix `/roadmap`'s backend event-writing gap. Do not fabricate
  progress. Do not alter Forward Score. Do not change global typography or
  global nav/footer. No unrelated cleanup. No temporary preview files left
  tracked/committed.
- Every teaser is a read-only consumer of an existing hook/query
  (`getFridayReports`, `getTimeline`, `useBadges`) — no new Supabase tables,
  functions, or mutations anywhere in this plan.
- After every task: `npx tsc --noEmit`, `npm test -- --run`, and
  `npm run build` must all pass before moving to the next task.
- Preserve the pre-existing global `h1`/`h2` CSS-override workaround
  convention (`!text-2xl`/`!text-3xl` important-utility fix) exactly as used
  in Sub-Projects 3–6 — do not touch the global rule itself.

---

## Task 1: Baseline protection

**Files:**
- Create: `src/pages/CareerSuccessPage.test.tsx`

**Goal:** Lock down current behavior with tests *before* any structural
change, so every later task has a regression tripwire.

- [ ] **Step 1:** Write tests against the page as it exists on `main` today:
  - Renders `career_success_items` (mock 2–3 items: one unlocked/no
    `featureKey`, one locked via `canAccess` returning `false`, one
    `is_coming_soon`).
  - Locked item renders `LockedFeatureCard`, not the plain content card.
  - Clicking a locked item opens `UpgradeModal` with the correct
    `featureKey`/`requiredPlan` (from the existing `itemFeatureMap`/
    `featureRequiredPlan` dictionaries — assert against real dictionary
    values, e.g. `'Promotion Planning'` → `promotion_planning` →
    `career-concierge`).
  - `is_coming_soon` ribbon + notice box render for flagged items.
  - Bottom CTA banner copy renders unchanged.
  - Loading spinner shows before the `career_success_items` fetch resolves.
- [ ] **Step 2:** Use the generic chainable/thenable Supabase mock pattern
  established in Sub-Projects 5–6 (this page also renders real
  `MemberLayout` + `useEntitlements`, each with differently-shaped query
  chains).
- [ ] **Step 3:** Run the suite, confirm all pass against the *current*
  (unmodified) `CareerSuccessPage.tsx`. This file is the regression harness
  for every subsequent task — do not weaken or delete these assertions
  later, only add to them.

---

## Task 2: Page shell and hierarchy

**Files:**
- Modify: `src/pages/CareerSuccessPage.tsx`

**Goal:** Re-chrome the page shell and lay out the five approved sections
(header → Next Steps → coaching catalog → Roadmap → Vault → CTA banner) as
empty/placeholder section containers, with **zero change to the existing
`career_success_items` fetch, gating logic, or dictionaries.**

- [ ] **Step 1:** Switch the `h1` to `font-display` with the
  `!text-2xl sm:!text-3xl` important-utility fix (matching Sub-Projects
  3–6).
- [ ] **Step 2:** Introduce the shared `CARD_CLASS` convention from
  `AchievementVaultPage.tsx`: `'rounded-2xl border border-border
  bg-surface-card p-6 shadow-sm'`. Apply it to the existing coaching-catalog
  cards' container styling (replacing the current flat
  `border border-border bg-surface-card p-6`).
- [ ] **Step 3:** Reorder JSX into the five IA sections from the spec,
  leaving Sections 2 (Next Steps), 4 (Roadmap), and 5 (Vault) as stubbed
  containers (to be filled in Tasks 3–5). Section 3 (coaching catalog)
  keeps its exact existing map/render logic, just re-styled.
- [ ] **Step 4:** Re-run Task 1's tests — they must still pass unmodified
  (structural/visual reorder only, no logic change yet).

---

## Task 3: Next Steps teaser

**Files:**
- Create: `src/components/CareerSuccessNextStepsTeaser.tsx` (page-specific,
  lives directly under `src/components/`, matching the `FridayReportCard`
  convention — not `ui/`).
- Create: `src/components/CareerSuccessNextStepsTeaser.test.tsx`
- Modify: `src/pages/CareerSuccessPage.tsx` (mount the teaser)

**Data contract (from spec):** `getFridayReports(profile.id)` from
`src/lib/communication.ts`, filtered to `approval_status === 'approved' ||
approval_status === 'sent'` (identical rule to `FridayReportsPage.tsx`),
most recent by `report_date`.

- [ ] **Step 1:** Write failing tests for:
  - Populated state: mock a qualifying report, assert title, date, and a
    truncated `next_steps` preview render, reusing `FridayReportCard`'s
    existing `next_steps.split('\n')` convention for the preview lines.
  - Draft/pending-review exclusion: mock only a `draft` report, assert the
    teaser falls back to the empty state (never surfaces unapproved
    strategist drafts to the member).
  - True empty state: no qualifying reports → "Your strategist hasn't
    published a progress report yet." with a link to `/friday-reports`.
  - Loading state: spinner/skeleton while the fetch is pending.
  - Error state: `getFridayReports` rejects/throws → falls back to empty-
    state copy, logs the error, does not crash the page.
  - CTA: "View full report" link points to `/friday-reports`.
- [ ] **Step 2:** Confirm tests fail (component doesn't exist yet).
- [ ] **Step 3:** Implement `CareerSuccessNextStepsTeaser.tsx` against the
  contract above, using the `CARD_CLASS` convention from Task 2.
- [ ] **Step 4:** Mount it in `CareerSuccessPage.tsx`'s Section 2 stub.
- [ ] **Step 5:** All tests pass; full suite + `tsc` + build still clean.

---

## Task 4: Roadmap teaser

**Files:**
- Create: `src/components/CareerSuccessRoadmapTeaser.tsx`
- Create: `src/components/CareerSuccessRoadmapTeaser.test.tsx`
- Modify: `src/pages/CareerSuccessPage.tsx` (mount the teaser)

**Data contract (from spec):** `getTimeline(user.id)` from
`src/lib/profile.ts`, filtered to `event_type === 'career_roadmap' ||
event_type === 'promotion_coaching'` — **the exact filter
`RoadmapPage.tsx` already uses, copied verbatim, not reimplemented.**

- [ ] **Step 1:** Write failing tests for:
  - Populated state: mock ≥1 matching event, assert "You have N roadmap
    milestone(s)" + the most recent `event_title` render.
  - True empty state (the expected common case): mock zero matching
    events → "Your roadmap hasn't been built yet. Ask your Career
    Strategist to build one." — assert this copy does **not** duplicate
    `RoadmapPage.tsx`'s own "Ask your Strategist" messaging link (single
    honest sentence + one link to `/roadmap` only).
  - CTA: "View your roadmap" link points to `/roadmap`.
  - Confirm no messaging/CTA to `/messages` is rendered from this
    component (that responsibility stays on `RoadmapPage.tsx`).
- [ ] **Step 2:** Confirm tests fail.
- [ ] **Step 3:** Implement against the contract, reusing `getTimeline` and
  the `CARD_CLASS` convention. **No new Supabase query, no new filter
  logic beyond copying Roadmap's own.**
- [ ] **Step 4:** Mount it in `CareerSuccessPage.tsx`'s Section 4 stub.
- [ ] **Step 5:** All tests pass; full suite + `tsc` + build still clean.

---

## Task 5: Achievement Vault / Evidence teaser

**Files:**
- Create: `src/components/CareerSuccessVaultTeaser.tsx`
- Create: `src/components/CareerSuccessVaultTeaser.test.tsx`
- Modify: `src/pages/CareerSuccessPage.tsx` (mount the teaser)

**Data contract (from spec):** `useBadges(user?.id)` from
`src/hooks/useBadges.ts` — reuse `earnedBadges.length` and `earnedBadges[0]`
(hook already orders by `awarded_at` descending). **No second query against
the `badges` table** — the earned-of-total fraction is `AchievementVaultPage.tsx`'s
job, not this teaser's.

- [ ] **Step 1:** Write failing tests for:
  - Populated state: mock ≥1 earned badge, assert "{count} badge(s) earned.
    Most recent: {badge name}." renders as a **concise summary only** — no
    badge grid, no locked/unearned badge list (must not duplicate
    `AchievementVaultPage.tsx`'s UI).
  - Empty state: zero earned badges → "No badges earned yet. Complete your
    Career Profile and land your first interview to start earning."
    (mirrors `AchievementVaultPage.tsx`'s own existing empty-state copy).
  - Loading state: respects `useBadges`'s `loading` flag.
  - CTA: "View Achievement Vault" link points to `/achievement-vault`.
- [ ] **Step 2:** Confirm tests fail.
- [ ] **Step 3:** Implement against the contract using the `CARD_CLASS`
  convention.
- [ ] **Step 4:** Mount it in `CareerSuccessPage.tsx`'s Section 5 stub.
- [ ] **Step 5:** All tests pass; full suite + `tsc` + build still clean.

---

## Task 6: Existing Career Success content — modernize and reorganize

**Files:**
- Modify: `src/pages/CareerSuccessPage.tsx`

**Goal:** Finish the visual modernization of the real coaching-catalog
section (Section 3) without touching its data/gating logic at all.

- [ ] **Step 1:** Apply `CARD_CLASS` to the unlocked content cards (icon,
  title, description, `is_coming_soon` ribbon/notice) — same treatment as
  Task 2 established, applied consistently across every card variant.
  Section headings (if any are added around the catalog, e.g. "Ongoing
  coaching & growth services") switch to `font-display`.
- [ ] **Step 2:** Confirm the grid breakpoint per the spec's tablet
  guidance — evaluate whether `sm:grid-cols-2` should move to
  `md:grid-cols-2` to avoid cramped tablet cards; decide based on an actual
  tablet-width render check in Task 7/12, not guesswork here.
- [ ] **Step 3:** Re-chrome the bottom CTA banner
  (`border-dashed border-primary-700 bg-surface-subtle`) to
  `rounded-2xl`, copy unchanged.
- [ ] **Step 4:** Confirm the `itemFeatureMap`, `featureRequiredPlan`,
  `canAccess` gating, and `UpgradeModal` wiring are byte-for-byte identical
  to `main` — diff the logic portions of the file against `main` to prove
  it (only JSX/className changes are expected in this task).
- [ ] **Step 5:** Task 1's baseline tests still pass unmodified.

---

## Task 7: Responsive behavior

**Files:**
- Modify: `src/pages/CareerSuccessPage.tsx` and/or the three teaser
  components as needed (className/breakpoint adjustments only).

- [ ] **Step 1: Mobile.** Confirm the first viewport (no scrolling) shows
  the page header and the Next Steps teaser — the member's current
  coaching context and next action — before the coaching catalog grid.
  Coaching catalog drops to a single column on mobile.
- [ ] **Step 2: Tablet.** Confirm the coaching-catalog grid isn't cramped
  at the `sm:` breakpoint; apply the `md:grid-cols-2` adjustment from Task
  6 if the real render confirms it's needed. Roadmap/Vault teasers stack
  single-column at tablet width if two-column reads cramped.
- [ ] **Step 3: Desktop.** Roadmap and Vault teasers sit side-by-side
  (two-column); coaching catalog holds 2–3 columns.
- [ ] **Step 4:** No horizontal overflow at any breakpoint — verified in
  Task 12's browser pass, not just by class inspection.

---

## Task 8: Loading / empty / error polish

**Files:**
- Modify: the three teaser components from Tasks 3–5.

**Goal:** Confirm every data-backed teaser has an intentional, non-jarring
state for all four conditions — loading, populated, true-empty, error —
with no fake content ever substituted for a missing state.

- [ ] **Step 1:** Cross-check each teaser's loading state uses the same
  visual pattern (spinner sizing/placement) as the rest of the page, not a
  one-off pattern per component.
- [ ] **Step 2:** Confirm each empty-state copy reads as a normal, expected
  product state (especially the Roadmap teaser, which will be empty for
  100% of real members today per the documented data-gap) — not as a
  broken-looking error.
- [ ] **Step 3:** Confirm each error path (fetch throws/rejects) degrades
  gracefully to that teaser's empty-state copy and logs to console, mirror-
  ing the existing `useEntitlements` fail-closed convention — never an
  unhandled promise rejection or a blank card.

---

## Task 9: Accessibility

**Files:**
- Modify: `src/pages/CareerSuccessPage.tsx`, the three teaser components,
  and (conditionally) `src/components/FeatureEntitlements.tsx` per Task 10.

- [ ] **Step 1: Heading hierarchy.** Page `h1` → section `h2`s (Next Steps,
  coaching catalog, Roadmap, Vault) in real document order, no skipped
  levels.
- [ ] **Step 2: Keyboard access.** Every teaser CTA is a real `<Link>`; the
  coaching-catalog cards' locked state (see Task 10) must be reachable and
  activatable via keyboard.
- [ ] **Step 3: Focus visibility.** Confirm visible focus rings on all new
  interactive elements (rely on existing global focus-visible styles;
  verify they aren't being overridden by new classNames).
- [ ] **Step 4: Status semantics.** "Coming Soon" ribbon gets a non-visual-
  only label (`aria-label` or visually-hidden text) instead of a bare
  floating span.
- [ ] **Step 5: Card/link semantics.** Teaser cards are not divs pretending
  to be interactive when only their CTA is actionable — the card itself is
  static content, the CTA is the one focusable/activatable element per
  card (avoid nested-interactive-element pitfalls).
- [ ] **Step 6: Touch targets.** ≥44px on mobile for every card CTA and any
  locked-card tap target.
- [ ] **Step 7: Screen-reader treatment for status/progress info.** Badge
  counts, milestone counts, and report dates need to read sensibly linearly
  (e.g. not relying on visual-only iconography to convey "earned" vs. "not
  earned" — text label present alongside every icon, matching
  `AchievementVaultPage.tsx`'s existing convention of a text line under
  each badge).

---

## Task 10: Shared-component verification — `LockedFeatureCard`

**Files (conditional on outcome below):**
- Possibly modify: `src/components/FeatureEntitlements.tsx`

**Consumer enumeration (completed during planning, not deferred to
implementation):**

- `LockedFeatureCard` has **exactly one production consumer**:
  `src/pages/CareerSuccessPage.tsx` (direct import + JSX usage).
- Its only other reference is inside `FeatureEntitlements.tsx` itself, as
  the default fallback rendered by the exported `FeatureGate` wrapper
  component when no `lockedCard` prop is supplied.
- **`FeatureGate` itself has zero consumers anywhere else in the
  codebase** (grepped `FeatureGate` app-wide — only its own definition and
  interface appear; no page or component imports/renders it). Its
  `LockedFeatureCard` fallback path is therefore currently dead code in
  production, not something any locked/completed redesign route depends
  on today.
- The route-level paywall (`ProtectedRoute` → `UpgradeRequiredPage`, used
  by every gated route including the locked Achievement Vault and Roadmap
  pages) does **not** use `LockedFeatureCard` — `UpgradeRequiredPage` has
  its own independent layout. Confirmed by reading `ProtectedRoute.tsx` in
  full.
- No `FeatureEntitlements.test.tsx` exists that would assert `LockedFeatureCard`'s
  exact current class names.

**Conclusion: safe to update.** Exactly one live consumer
(`CareerSuccessPage.tsx`, the page being redesigned in this sub-project),
one dead/unused code path (`FeatureGate`'s default fallback), and zero
overlap with any locked/completed redesign (Homepage, Opportunity Engine,
ForwardOS Home, Achievement Vault, Career Profile) or with the route-level
`UpgradeRequiredPage` paywall.

- [ ] **Step 1:** Add `rounded-2xl` to `LockedFeatureCard`'s container
  className in `FeatureEntitlements.tsx` (bringing it in line with its
  sibling `UpgradeModal`, which already has `rounded-2xl`).
- [ ] **Step 2:** Re-run the full suite — confirm no other test file
  (searched: none exists) breaks on the className change.
- [ ] **Step 3:** Document in the PR/commit message that this was a
  verified single-consumer, zero-regression change per this task's
  enumeration, not an assumed-safe shared-component edit.

**If any of the above enumeration turns out to be stale by the time this
task actually executes (e.g. a new consumer was added to `FeatureGate` in
the interim), stop and re-verify before touching the file — do not treat
this task's earlier findings as permanently valid without a fresh grep at
implementation time.**

---

## Task 11: Focused tests

**Files:**
- `src/pages/CareerSuccessPage.test.tsx` (extend from Task 1)
- `src/components/CareerSuccessNextStepsTeaser.test.tsx`
- `src/components/CareerSuccessRoadmapTeaser.test.tsx`
- `src/components/CareerSuccessVaultTeaser.test.tsx`

- [ ] **Step 1:** Confirm Task 1's baseline suite plus Tasks 3–5's teaser
  suites together give meaningful coverage of: catalog rendering, gating,
  `UpgradeModal` wiring, all three teasers' four states each (loading/
  populated/empty/error), and page-level composition (all sections present
  in the right order).
- [ ] **Step 2:** Add one composition-level test in
  `CareerSuccessPage.test.tsx` asserting section order in the rendered DOM
  (header → Next Steps → catalog → Roadmap → Vault → CTA banner) — the one
  assertion that would catch an accidental reordering regression.
- [ ] **Step 3:** Confirm `searchReadinessRegression.test.ts` and every
  other pre-existing suite is untouched and still passes.

---

## Task 12: Browser visual validation

**Files:** none (verification-only task, using the established throwaway-
preview-harness + Playwright pattern from Sub-Projects 4–6).

- [ ] **Step 1:** Temporarily export `AuthContext` and add a temporary
  preview route, exactly as in prior sub-projects.
- [ ] **Step 2:** Capture screenshots covering:
  - Desktop hierarchy (all five sections, populated states where mockable).
  - Tablet compression (catalog grid, teaser stacking).
  - Mobile stacking (Next Steps teaser visible first, no overflow).
  - Loading state for at least one teaser.
  - True empty state for all three teasers (the realistic common case).
  - Locked-feature state (a locked catalog card + open `UpgradeModal`).
  - No horizontal overflow at any captured width.
- [ ] **Step 3:** Save under
  `docs/superpowers/visual-review/<date>-subproject7-career-success/`.
- [ ] **Step 4:** Revert `AuthContext.tsx`/`App.tsx` exports fully; confirm
  zero diff via `git status --porcelain`. Neutralize the temp preview file
  to `export {}` if `delete_file` is blocked again (established pattern);
  leave it and the screenshot script untracked — never commit temporary
  preview artifacts.

---

## Task 13: Full verification

- [ ] **Step 1:** Run the four new/extended test files in isolation, then
  the complete Vitest suite (`npm test -- --run`).
- [ ] **Step 2:** `npx tsc --noEmit`.
- [ ] **Step 3:** `npm run build`.
- [ ] **Step 4:** All three must be clean before proceeding to Task 14.

---

## Task 14: Final diff review

- [ ] **Step 1:** `git status --porcelain` and `git diff --stat main` —
  confirm the only modified/added files are:
  - `src/pages/CareerSuccessPage.tsx`
  - `src/pages/CareerSuccessPage.test.tsx`
  - `src/components/CareerSuccessNextStepsTeaser.tsx` (+ `.test.tsx`)
  - `src/components/CareerSuccessRoadmapTeaser.tsx` (+ `.test.tsx`)
  - `src/components/CareerSuccessVaultTeaser.tsx` (+ `.test.tsx`)
  - `src/components/FeatureEntitlements.tsx` (only if Task 10 proceeded)
  - Visual-review screenshots under
    `docs/superpowers/visual-review/<date>-subproject7-career-success/`
- [ ] **Step 2:** Confirm none of the five locked redesigns' files
  (`LandingPage.tsx`, `OpportunityEnginePage.tsx`, `DashboardPage.tsx`,
  `AchievementVaultPage.tsx`, `CareerProfilePage.tsx`, `ProfileCard.tsx`,
  `SearchReadinessWidget.tsx`) appear in the diff.
- [ ] **Step 3:** Confirm no temporary preview files
  (`TempCareerSuccessPreview.tsx`-style, screenshot scripts) are staged.
- [ ] **Step 4:** Commit with a message documenting the Task 10 consumer-
  verification outcome explicitly (not just "redesigned Career Success").
  Push, then verify with `git fetch --quiet && git rev-parse HEAD &&
  git rev-parse origin/main` per the established push-verification habit.

---

## Stop-gate

This plan requires owner approval before implementation begins. No task in
this plan is executed until the owner reviews and approves it.
