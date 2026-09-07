# FreshlyForward Redesign — Sub-Project 7: Career Success

## Context

This follows the assessment performed against `main` at commit `296206d`
(Sub-Project 6, Career Profile, complete and locked). The assessment
inspected `CareerSuccessPage.tsx`, its route, nav placement, feature-gate
config, and every cross-system connection (or lack thereof) to Career
Compass, Opportunity Engine, Forward Score/DNA, Achievement Vault, Career
Profile, Timeline, Activity Feed, Friday Reports, and Roadmap. The owner
reviewed that assessment and approved two explicit decisions, both binding
on this spec:

1. **Scope decision:** Career Success becomes a **Hybrid "Coaching & Growth
   Hub"** — not another ForwardOS dashboard, not a full Roadmap/Action
   Center rebuild. Modernize the real existing catalog and add compact,
   **real-data-only** teasers for: next steps, roadmap, and Achievement
   Vault/evidence. No fake progress, milestones, or placeholder
   intelligence.
2. **`/roadmap` decision:** `/roadmap` stays an honest link-out/teaser only
   in this sub-project. The underlying data-gap (nothing in the codebase
   ever writes a `career_timeline` row with `event_type: 'career_roadmap'`
   or `'promotion_coaching'`, so `RoadmapPage.tsx` is permanently empty for
   every real member today) is a real product/data-flow issue, **not** a
   visual redesign concern, and is explicitly deferred — see
   [Deferred issue](#deferred-issue-roadmap-data-gap-not-fixed-here) below.

**Locked and untouched by this sub-project (per owner instruction, do not
reopen):** Homepage (`d970705`), Opportunity Engine (`32d9e07`), ForwardOS
Home (`ad26230`), Achievement Vault (`ca81baf`), Career Profile (`296206d`).

## Product boundary (restated, binding)

- **ForwardOS Home** = member command center. "Where am I and what needs
  attention?" Owns Forward Score, pillars, Next Best Move, recommendations.
- **Career Success** = coaching, development, and growth workspace. Owns the
  real coaching-services catalog plus compact links into the member's
  current strategist guidance and evidence — it does **not** recompute or
  re-render Forward Score, pillars, or Dashboard's stat cards.
- **Roadmap** = deeper milestone/journey surface, to be repaired or expanded
  in a separate future project. Career Success only *points* at it.

Any content added to Career Success that risks duplicating ForwardOS Home's
job (a second momentum/progress score, a second "Next Best Move") is out of
scope for this sub-project and should be flagged, not built.

## Goals

- Modernize `CareerSuccessPage.tsx`'s real, existing content (the
  `career_success_items` catalog, the locked/unlocked card pattern, the
  bottom CTA banner) to the shared `rounded-2xl`/`shadow-sm`/`font-display`
  visual language used by Sub-Projects 3–6.
- Bring `LockedFeatureCard` (in `src/components/FeatureEntitlements.tsx`) up
  to the same `rounded-2xl` treatment already applied to its sibling
  `UpgradeModal` in an earlier pass — closing a known inconsistency found
  during assessment. **Caution:** `LockedFeatureCard` and `FeatureGate` are
  shared across the app (confirmed used by `CareerSuccessPage.tsx` and
  `FeatureGate`'s default render path) — verify all consumers after this
  change, not just Career Success.
- Add exactly three real-data teasers, each backed by an existing
  hook/query already used elsewhere in the codebase (no new tables, no new
  Supabase functions, no new business logic):
  1. **Next Steps** teaser (from Friday Reports).
  2. **Roadmap** teaser (honest link-out, reusing Roadmap's own filter).
  3. **Achievement Vault / evidence** teaser (from badges).
- Add page-level test coverage (none currently exists for this page).
- Preserve every existing behavior listed in
  [Functional preservation map](#functional-preservation-map-nothing-here-may-regress).

## Non-goals (explicitly deferred or out of scope)

- No changes to `RoadmapPage.tsx`, `career_timeline` schema, or any
  Supabase function, solely to populate the roadmap teaser. If roadmap data
  is empty for a member (true for 100% of members today), the teaser must
  say so honestly.
- No new "tasks" or "action items" data model. `FridayReport.next_steps` is
  free-text prose written by a strategist — the teaser surfaces it as-is,
  it does not attempt to parse it into checkable line items or track
  completion state (no such state exists in the schema).
- No fourth "other connected systems" teaser. During the assessment, no
  additional real data source was identified that would add value here
  without either (a) duplicating ForwardOS Home's Forward Score/pillars, or
  (b) requiring new backend work. Rather than force a fourth card, this
  spec intentionally ships three. If the owner has a specific system in
  mind, it needs its own real-data contract defined before it's added.
- No consolidation of Career Success and Roadmap into one page/nav item.
  Both remain separate nav entries under "Career Growth" in `MemberLayout`.
- No change to the route-level `ProtectedRoute` gate
  (`workplace_success_coaching` / `career-concierge`), to `useEntitlements`,
  or to the `career_success_items` table/query shape.
- No change to `ProfileEditForm.tsx`-style editing flows — this page has no
  edit mode at all, and none is being added.

## Functional preservation map (nothing here may regress)

From `CareerSuccessPage.tsx` as it exists on `main` today:

- `supabase.from('career_success_items').select('*').eq('is_active', true).order('sort_order')`
  query, shape, and result handling.
- The `itemFeatureMap` (title → `FeatureKey`) and `featureRequiredPlan`
  (`FeatureKey` → `'career-concierge'`) dictionaries — values and keys
  unchanged.
- `canAccess(featureKey)` gating: locked items render `LockedFeatureCard`,
  unlocked items render the real content card.
- `is_coming_soon` ribbon + the in-card "in development" notice box.
- `UpgradeModal` open/close via local `upgradeModal` state, with the same
  `featureKey`/`requiredPlan` payload shape.
- The bottom `border-dashed` CTA banner's copy, unchanged.
- Loading spinner while `items` fetch is in flight.
- Route-level `ProtectedRoute feature="workplace_success_coaching"
  requiredPlan="career-concierge"` gate in `App.tsx` — untouched.
- Zero Supabase mutations exist on this page today; this redesign
  introduces zero as well (all three new teasers are read-only fetches of
  data other pages already read).

## New teaser data contracts (real data only)

Each teaser below states: source, exact query/hook to reuse, loading state,
populated state, and empty/error state. No teaser invents a number, a
status, or a milestone that isn't actually in the database.

### 1. Next Steps teaser

- **Source:** `getFridayReports(profile.id)` from `src/lib/communication.ts`
  — the exact function `FridayReportsPage.tsx` already calls.
- **Filter (reuse, don't reinvent):** same visibility rule as
  `FridayReportsPage.tsx` — only `approval_status === 'approved' ||
  approval_status === 'sent'`. Sort by `report_date` descending (reports
  already come back in a usable order per `getFridayReports`; verify sort
  direction during implementation rather than assuming).
- **Populated state:** show the most recent qualifying report's `title`,
  `report_date`, and `next_steps` (truncated — reuse `FridayReportCard`'s
  existing next-steps splitting convention: `next_steps.split('\n')`,
  first 2–3 lines, "+N more" if truncated). CTA: "View full report" →
  `/friday-reports`.
- **Empty state (no qualifying report exists):** "Your strategist hasn't
  published a progress report yet." — no CTA to a page with nothing to
  show beyond the link to `/friday-reports` itself.
- **Loading state:** skeleton/spinner consistent with the rest of the page,
  not a separate pattern.
- **Error state:** if the fetch fails, degrade to the empty-state copy
  (same fail-safe pattern `useEntitlements` already uses — log the error,
  don't crash the page over one optional widget).

### 2. Roadmap teaser

- **Source:** `getTimeline(user.id)` from `src/lib/profile.ts` — the exact
  function `RoadmapPage.tsx` already calls.
- **Filter (reuse verbatim from `RoadmapPage.tsx`):**
  `event_type === 'career_roadmap' || event_type === 'promotion_coaching'`.
- **Populated state:** "You have N roadmap milestone(s)." + the single most
  recent milestone's `event_title`. CTA: "View your roadmap" → `/roadmap`.
- **Empty state (true for every real member today):** "Your roadmap hasn't
  been built yet. Ask your Career Strategist to build one." CTA still
  routes to `/roadmap` (which itself already offers the "Ask your
  Strategist" messaging link) — **do not duplicate that CTA's messaging
  link here**; one honest sentence plus a single link to `/roadmap` is
  enough.
- **This teaser must not silently look broken.** Because it will show the
  empty state for 100% of members until the deferred data-gap issue is
  fixed, the empty copy must read as a normal, expected state of an
  in-progress relationship with a strategist — not as an error.

### 3. Achievement Vault / evidence teaser

- **Source:** `useBadges(user?.id)` from `src/hooks/useBadges.ts` — the
  exact hook `AchievementVaultPage.tsx` already uses.
- **Data used:** `earnedBadges.length` (total earned — no second query
  against the full `badges` table; this page does not need the "earned of
  total" fraction `AchievementVaultPage.tsx` shows, since that's Vault's
  job, not this page's) and `earnedBadges[0]` (most recent, since the hook
  already orders by `awarded_at` descending) for a "Most recent: {badge
  name}" line.
- **Populated state:** "{earnedBadges.length} badge(s) earned. Most recent:
  {badge name}." CTA: "View Achievement Vault" → `/achievement-vault`.
- **Empty state:** "No badges earned yet. Complete your Career Profile and
  land your first interview to start earning." (mirrors
  `AchievementVaultPage.tsx`'s own existing empty-state copy — do not
  invent new guidance).
- **Loading state:** respect `useBadges`'s own `loading` flag.

## Information architecture (top to bottom)

1. Page header — "Career Success" title, `font-display`, existing intro
   copy, unchanged.
2. **Your current focus** — Next Steps teaser (read first: most
   time-sensitive/strategist-authored).
3. **Ongoing coaching & growth services** — the existing real catalog
   (Workplace Success Coaching, Promotion Planning, Salary Coaching,
   Leadership Development, plus the existing `is_coming_soon` items),
   visually modernized, gating logic untouched. This remains the dominant
   section by content volume, per the Hybrid decision.
4. **Your roadmap** — Roadmap teaser.
5. **Your evidence** — Achievement Vault teaser.
6. Existing bottom CTA banner, re-chromed only.

Roadmap and Vault teasers may sit side-by-side on desktop (two-column) since
neither needs the full width a strategist's prose does.

## Visual treatment (reuse only, no new style system)

- Section containers: `rounded-2xl border border-border bg-surface-card
  shadow-sm` — the Sub-Project 3–6 standard, replacing today's flat
  `border border-border bg-surface-card p-6`.
- Headings: `font-display` + the established `!text-2xl`/`!text-3xl`
  important-utility fix for the pre-existing global `h1`/`h2` CSS override
  (same fix applied in Sub-Projects 3–6).
- `LockedFeatureCard`: `rounded-2xl` (bringing it in line with
  `UpgradeModal`, which already has it).
- New teaser cards: same `CARD_CLASS` convention `AchievementVaultPage.tsx`
  already established (`'rounded-2xl border border-border bg-surface-card
  p-6 shadow-sm'`) — reuse that literal pattern rather than inventing a
  fourth card style.
- Coaching-service cards keep their existing icon-emoji treatment
  (`iconMap`) — out of scope to redesign the icon system itself here.
- Plan-required pills: `rounded-full`, matching Career Profile's skill-chip
  convention from Sub-Project 6.

## Responsive strategy

- **Mobile:** page opens with the header, then the Next Steps teaser
  (current focus) as the first real content block — matches "what should I
  focus on next" being the highest-priority question per the assessment.
  Coaching catalog grid drops to a single column.
- **Tablet:** coaching catalog moves from `lg:grid-cols-3` behavior at the
  `sm:` breakpoint (currently cramped at `sm:grid-cols-2`) — confirm during
  implementation whether the grid should hold at 1 column longer
  (`md:grid-cols-2` instead of `sm:grid-cols-2`) to avoid card squeeze,
  consistent with the tablet guidance from the original assessment.
- **Desktop:** Roadmap and Vault teasers sit side-by-side; coaching catalog
  keeps 2–3 columns depending on final content count.

## Accessibility

- All teaser CTAs are real `<Link>`/`<a>` elements (not `onClick`-only
  `div`s).
- `LockedFeatureCard`'s clickable area should become a real `<button>` (it
  is currently an `onClick`-bearing `div` — a pre-existing gap, worth
  closing while this component is touched anyway, but verify no other
  consumer relies on div-specific styling before changing the element type).
- Every new teaser section uses a real heading (`h2`) in document order.
- "Coming Soon" ribbon needs a non-visual-only label (e.g. `aria-label` or
  visually-hidden text) so screen reader users don't just get a floating
  span with no context.
- Status/plan-required pills must meet WCAG 2.2 AA contrast, verified the
  same way Sub-Projects 3–6 were.
- Touch targets ≥44px on mobile for all card taps, including locked cards.

## Deferred issue: roadmap data-gap (not fixed here)

**Recorded explicitly so it is not lost:** there is currently no code path
anywhere in the application — member-facing or strategist-facing — that
writes a `career_timeline` row with `event_type: 'career_roadmap'` or
`'promotion_coaching'`. Every real `addTimelineEvent(...)` call site in the
codebase (`src/lib/profile.ts`, `src/lib/operations.ts`,
`OnboardingQuestionnaire.tsx`, `OnboardingDocumentUpload.tsx`,
`OnboardingPage.tsx`) writes one of: `joined`, `opportunity_approved`,
`application_submitted`, `interview_scheduled`, `offer_received`,
`feedback_updated`, `questionnaire_completed`, `resume_uploaded`,
`onboarding_completed`. `StrategistMemberWorkspacePage.tsx`'s Timeline tab
is also read-only against `career_timeline`. As a result, `RoadmapPage.tsx`
is permanently in its empty state for every real member today, and no
strategist-facing UI exists to change that.

This is a **product/data-flow gap**, not a visual defect, and is explicitly
**out of scope** for Sub-Project 7. Suggested framing for a future,
separate project: give strategists a way (likely inside
`StrategistMemberWorkspacePage.tsx`) to create roadmap milestones against a
specific member, which would make both `RoadmapPage.tsx` and this
sub-project's Roadmap teaser meaningfully populated for the first time.

## Test plan

- New `CareerSuccessPage.test.tsx` (none exists today):
  - Existing catalog renders items, respects `is_active`/`sort_order`.
  - Locked vs. unlocked card rendering per `canAccess`.
  - `is_coming_soon` ribbon/notice rendering.
  - `UpgradeModal` opens with correct `featureKey`/`requiredPlan` on a
    locked-card click.
  - Next Steps teaser: populated state (mocked qualifying report), empty
    state (no qualifying report), and confirms `pending_review`/`draft`
    reports are excluded (same visibility rule as `FridayReportsPage`).
  - Roadmap teaser: populated state (mocked `career_roadmap` event), empty
    state (no matching events) — confirm the copy reads as a normal,
    expected state, not an error.
  - Vault teaser: populated state (mocked earned badge), empty state (no
    earned badges).
  - Generic chainable/thenable Supabase mock pattern (established in
    Sub-Projects 5–6) since this page also renders real `MemberLayout` +
    `useEntitlements`.
- No changes expected to `searchReadinessRegression.test.ts` or any other
  existing suite — verify after implementation that all currently-passing
  suites still pass.

## Verification plan (unchanged process from prior sub-projects)

- `npx tsc --noEmit`, full Vitest suite, `npm run build` after
  implementation.
- Real authenticated-shell screenshots (desktop + mobile) via the same
  throwaway-preview-harness + Playwright pattern used in Sub-Projects 4–6,
  covering: populated state, Next Steps empty state, Roadmap empty state
  (the common case), Vault empty state, and locked-card/upgrade-modal
  interaction. `AuthContext.tsx`/`App.tsx` reverted afterward, confirmed via
  `git status --porcelain` zero diff before commit.
- Screenshots saved under
  `docs/superpowers/visual-review/<date>-subproject7-career-success/`.

## Stop-gate

This spec requires owner approval before an implementation plan is written,
per the established two-checkpoint process (spec review → plan →
implementation). No code changes, including to `CareerSuccessPage.tsx` or
`FeatureEntitlements.tsx`, happen until this spec is explicitly approved.
