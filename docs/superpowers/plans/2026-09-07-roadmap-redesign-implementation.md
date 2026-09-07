# Roadmap Redesign (Direction B) — Implementation Plan

**Status:** Awaiting approval. No code written yet.
**Baseline:** `main` @ `dca2eb3` (roadmap write-path repair, repo-audited clean).
**Approved direction:** Direction B from the 2026-09-07 audit — a real product
pass on `/roadmap`'s presentation, chronology, and target-date entry, staying
entirely on the existing `career_timeline` model. No new table, no schema
change, no live migration. This plan only prepares repo-side code; nothing
here touches the live Supabase project.

## Hard constraints (carried over verbatim from the approval)

1. **No dedicated roadmap table.** Stay on `career_timeline`. A dedicated
   model is a later, separate architecture project, only if this redesign
   proves the generic model insufficient in real use.
2. **No live migration.** The existing `add_roadmap_milestone` RPC
   (`supabase/migrations/20260907000000_add_roadmap_milestone_rpc.sql`) is
   NOT modified by this plan and is not re-applied to any live project.
   `p_event_date` is already a parameter on that RPC and already threaded
   through `addRoadmapMilestone()` in `src/lib/roadmap.ts` — confirmed by
   reading the current file before writing this plan. Task 2 below needs
   zero changes to that function.
3. **Locked surfaces, not touched, no exceptions:** `LandingPage.tsx` +
   `src/components/homepage/**` (Homepage), `OpportunityEnginePage.tsx` +
   `src/components/opportunityEngine/**` + `StrategistOpportunityEnginePage.tsx`
   (Opportunity Engine), `DashboardPage.tsx` + `src/components/forwardScore/**`
   + `src/hooks/useForwardScore.ts` (ForwardOS Home), `AchievementVaultPage.tsx`
   + `src/components/Badges.tsx` (Achievement Vault), `CareerProfilePage.tsx`
   + `src/components/forwardDna/**` (Career Profile), `CareerSuccessPage.tsx`
   + `CareerSuccessNextStepsTeaser.tsx` + `CareerSuccessVaultTeaser.tsx` +
   **`CareerSuccessRoadmapTeaser.tsx`** (Career Success, including its
   Roadmap teaser specifically — see the parity-test note below for why this
   file stays untouched even though it reads the same underlying data).
4. **No fabricated attribution.** Read the migration and every write path
   again for this plan: `add_roadmap_milestone` inserts `user_id, event_type,
   event_title, event_description, event_date, metadata` — it does **not**
   persist who called it (no `created_by`, nothing in `metadata` beyond
   `idempotency_key`). There is currently no truthful way to know, from a
   `career_timeline` row alone, whether a strategist or the member logged
   it. **The redesigned UI will not show any "added by strategist" /
   "self-logged" label or icon.** This is called out again explicitly in
   Task 3 and in Deferred Follow-ups below — adding real attribution
   requires a future migration to persist a `created_by` value, which is
   out of scope here.
5. **No fabricated "completed" state.** `career_timeline` has no
   `completed_at` / `status` column. A milestone's `event_date` being in
   the past means only that it is **overdue / past-due** — never that it
   was completed. The redesigned UI has exactly two derived temporal
   states: `upcoming` (event_date is today or later) and `overdue`
   (event_date is before today). No third "completed" bucket exists in
   this phase. See Deferred Follow-ups for what a truthful completed state
   would require.
6. **Follow-up entry points, not built now.** Any future "jump into
   Roadmap" link from ForwardOS Home, Career Compass, or Friday Reports is
   documented as a follow-up opportunity only (see bottom of this plan).
   Nothing on those pages is touched.

## Current-state recap (from the 2026-09-07 audit, unchanged since)

- `RoadmapPage.tsx` fetches via `getTimeline(user.id)` (in `src/lib/profile.ts`),
  which **swallows fetch errors internally and resolves to `[]`** — meaning
  an actual fetch failure is today indistinguishable from a true empty
  state. This is a real gap the user asked to be fixed (an honest error
  state is a required deliverable), and it's fixed in Task 1 without
  touching `getTimeline()` itself (see Task 1 rationale).
- `getTimeline()` sorts `event_date DESC` (newest-created-first) — backwards
  from a forward-looking roadmap. Fixed by client-side grouping/sorting in
  Task 1, not by changing the query.
- `AddRoadmapMilestoneForm.tsx` has no date input; every strategist-created
  milestone today gets `event_date = now()` via the RPC's
  `COALESCE(p_event_date, now())` fallback. Fixed in Task 2.
- Visual chrome on `RoadmapPage.tsx` predates the Sub-Project 3–7 redesign
  (`border border-border bg-surface-card p-4`, no `rounded-2xl`/`shadow-sm`).
  Fixed in Task 3.
- `CareerSuccessRoadmapTeaser.tsx` has its **own, separately-implemented**
  `isRoadmapEvent()` predicate (`career_roadmap` / `promotion_coaching`),
  explicitly commented "copied verbatim rather than reimplemented" — a
  deliberate prior design decision to avoid cross-file coupling between a
  locked Sub-Project 7 surface and `/roadmap`. This plan does not change
  that decision or that file. Instead, Task 4 adds a parity test that
  proves both filters agree on the same fixture data, so silent divergence
  is caught without coupling the two files together.

## UX / component structure

`RoadmapPage.tsx`, top to bottom, unchanged sections marked `(unchanged)`:

```
Header: Map icon + "Career Roadmap" + subtitle          (unchanged copy)
Career Builder badge banner (conditional)                (unchanged)
---
[Loading]  -> centered spinner, role="status", visually-hidden "Loading your roadmap…"
[Error]    -> role="alert" card, "We couldn't load your roadmap right now."
              + a "Try again" button that re-runs the fetch (no page reload)
[Empty]    -> existing empty-state copy/CTA, restyled to rounded-2xl/shadow-sm chrome
[Populated]:
  "Next milestone" hero card (only rendered if at least one upcoming
     milestone exists) -- visually primary, larger, distinct from the list
     items below it. Earliest-dated upcoming (non-overdue) milestone.
  "Upcoming" section (h2 heading) -- remaining upcoming milestones,
     ascending by event_date, soonest first. Omitted entirely if there
     are none beyond the hero.
  "Overdue" section (h2 heading, warning-toned but not color-only) --
     all overdue milestones, ascending by event_date (oldest/most
     overdue first). Omitted entirely if there are none.
  All-overdue edge case (no upcoming milestones at all, but 1+ overdue
     exist): no "Next milestone" hero; instead an honest inline notice
     ("You have no upcoming milestones. Your most recent one is past
     due -- check in with your Career Strategist.") directly above the
     Overdue section.
---
goal-achieved badge banner (conditional)                 (unchanged)
```

Each milestone item (hero and list rows) shows: title, optional
description, formatted target date, and (for overdue items only) a
text-plus-icon "Overdue" badge -- never color-only, per WCAG 2.2 1.4.1.
No attribution, no status pill beyond upcoming/overdue framing, no
progress bar (nothing to compute one from truthfully).

## Files expected to change

| File | Change |
|---|---|
| `src/lib/roadmap.ts` | Add `ROADMAP_EVENT_TYPES`, `isRoadmapMilestoneEvent()`, `getRoadmapMilestones()`, `groupRoadmapMilestones()`. No changes to existing `addRoadmapMilestone()`/its types. |
| `src/lib/roadmap.test.ts` | New tests for all four additions above. |
| `src/components/AddRoadmapMilestoneForm.tsx` | Add an optional target-date `<input type="date">`, wire to existing `eventDate` field, validation. |
| `src/components/AddRoadmapMilestoneForm.test.tsx` | New tests for date entry/validation/passthrough. |
| `src/pages/RoadmapPage.tsx` | Full presentational rebuild: chrome, sections, loading/error/empty states, accessibility. Uses the new `roadmap.ts` functions. |
| `src/pages/RoadmapPage.test.tsx` | Rewritten/extended regression suite (see matrix below) — supersedes the existing baseline regression file from the write-path repair, keeping its intent (filter correctness) and adding the new states. |
| `src/components/RoadmapTeaserParity.test.tsx` *(new file)* | Cross-file parity test: proves `isRoadmapMilestoneEvent()` (new, in `roadmap.ts`) and `CareerSuccessRoadmapTeaser.tsx`'s own internal `isRoadmapEvent()` classify an identical fixture set identically. Does **not** import or modify the teaser's rendering, only its exported/local filter behavior is exercised indirectly by rendering the untouched component with mocked data and asserting on its output — see Task 4 for the exact mechanism, since `isRoadmapEvent` is not currently exported. |

**Not touched, anywhere in this plan:** `CareerSuccessRoadmapTeaser.tsx`,
`CareerSuccessPage.tsx`, `CareerSuccessNextStepsTeaser.tsx`,
`CareerSuccessVaultTeaser.tsx`, `LandingPage.tsx`, any
`src/components/homepage/**` file, `OpportunityEnginePage.tsx`,
`StrategistOpportunityEnginePage.tsx`, any `src/components/opportunityEngine/**`
file, `DashboardPage.tsx`, any `src/components/forwardScore/**` file,
`useForwardScore.ts`, `AchievementVaultPage.tsx`, `Badges.tsx`,
`CareerProfilePage.tsx`, any `src/components/forwardDna/**` file, the
`add_roadmap_milestone` migration/RPC, `getTimeline()` in `src/lib/profile.ts`,
`MemberLayout.tsx`, `App.tsx`.

---

## Task 1 — Shared roadmap data/grouping logic (`src/lib/roadmap.ts`)

**TDD order:** write `src/lib/roadmap.test.ts` additions first (failing),
then implement.

**Additions:**
```ts
export const ROADMAP_EVENT_TYPES = ['career_roadmap', 'promotion_coaching'] as const

export function isRoadmapMilestoneEvent(event: CareerTimelineEvent): boolean {
  return ROADMAP_EVENT_TYPES.includes(event.event_type as typeof ROADMAP_EVENT_TYPES[number])
}

export interface GetRoadmapMilestonesResult {
  milestones: CareerTimelineEvent[]
  error: string | null
}

// Unlike getTimeline() (src/lib/profile.ts), this does NOT swallow the
// Supabase error into an empty array. RoadmapPage needs to tell a genuine
// fetch failure apart from a genuine empty state, and getTimeline()'s
// existing swallow-everything contract is relied on by its other callers
// (CalendarPage, CareerSuccessRoadmapTeaser) -- changing it is out of
// scope and risks a locked-surface regression. This is a small, deliberate
// duplication of one query shape, not a refactor of getTimeline().
export async function getRoadmapMilestones(userId: string): Promise<GetRoadmapMilestonesResult> {
  const { data, error } = await supabase
    .from('career_timeline')
    .select('*')
    .eq('user_id', userId)

  if (error) {
    console.error('Error fetching roadmap milestones:', error)
    return { milestones: [], error: error.message }
  }

  return { milestones: ((data ?? []) as CareerTimelineEvent[]).filter(isRoadmapMilestoneEvent), error: null }
}

export interface GroupedRoadmapMilestones {
  next: CareerTimelineEvent | null
  upcoming: CareerTimelineEvent[]   // excludes `next`
  overdue: CareerTimelineEvent[]
}

// Pure function, no I/O, `now` injected for deterministic testing.
// "Overdue" = event_date's calendar day is strictly before `now`'s
// calendar day (a milestone dated today is NOT overdue). Both buckets
// sorted ascending by event_date; `next` is the earliest upcoming item,
// removed from the `upcoming` array it's drawn from.
export function groupRoadmapMilestones(events: CareerTimelineEvent[], now: Date): GroupedRoadmapMilestones { ... }
```

**Acceptance criteria / test cases (all in `roadmap.test.ts`):**
- `isRoadmapMilestoneEvent`: true for `career_roadmap`/`promotion_coaching`, false for `application_submitted` etc.
- `getRoadmapMilestones`: success case filters correctly; Supabase error case returns `{ milestones: [], error: <message> }` (not swallowed); empty-data case returns `{ milestones: [], error: null }`.
- `groupRoadmapMilestones`:
  - Empty input → `{ next: null, upcoming: [], overdue: [] }`.
  - Single upcoming item → it becomes `next`, both arrays empty.
  - Single overdue item → `next: null`, `overdue: [that item]`.
  - Item dated exactly "today" → treated as upcoming, not overdue (boundary test).
  - Many mixed items → correct partition, correct ascending order in both buckets, `next` is strictly the earliest upcoming (not just array[0] pre-sort).
  - All-overdue, multiple items → `next: null`, `overdue` sorted oldest-first.

## Task 2 — Target-date field in `AddRoadmapMilestoneForm.tsx`

**TDD order:** extend `AddRoadmapMilestoneForm.test.tsx` first.

- Add `<input type="date" id="roadmap-milestone-date">` with a `<label>`,
  positioned between Title and Description. Optional field — blank is
  valid and means "no target date," matching today's behavior
  (`p_event_date: null` → RPC's `COALESCE(..., now())` fallback stays
  exactly as-is; this plan does not change what happens when no date is
  given).
- **Validation:** rely on the native `<input type="date">` contract (browser
  rejects malformed text input at the DOM level) — no extra regex/parsing
  needed. No "must be in the future" restriction: a strategist may
  legitimately backdate a milestone that already occurred, and the
  read-side overdue/upcoming grouping already handles a past date
  gracefully and honestly. This is a deliberate assumption, called out
  again in Risks below.
- On save, convert the date input's value (`YYYY-MM-DD`) to an ISO string
  and pass as `eventDate` to `addRoadmapMilestone()` — the existing field,
  zero changes needed to `roadmap.ts` or the RPC call shape.
- Date value must be cleared by `reset()` (both success and Cancel paths),
  same lifecycle as `title`/`description`.

**New/updated tests:** renders the date input; leaving it blank sends
`eventDate: undefined`; picking a date sends the correct ISO value;
`reset()` clears the date field on both success and Cancel.

## Task 3 — `RoadmapPage.tsx` rebuild

**TDD order:** rewrite `RoadmapPage.test.tsx` first with the full new
state matrix (below), confirm it fails against the current implementation,
then rebuild the component to pass.

- Chrome: adopt `rounded-2xl border border-border bg-surface-card p-6 shadow-sm`
  (the exact class string already used verbatim across Sub-Projects 3–7 —
  copied as a literal, not imported from those files, so this stays a
  read-only visual-convention match, not a dependency on a locked surface).
- Loading: `role="status"` wrapper, visually-hidden "Loading your roadmap…"
  text alongside the existing spinner icon.
- Error: new branch, `role="alert"`, message + a "Try again" button that
  re-invokes the fetch function (component-local retry, no navigation).
- Empty: existing copy/CTA, new chrome only.
- Populated: renders the section structure from "UX / component structure"
  above, using `getRoadmapMilestones()` + `groupRoadmapMilestones()` from
  Task 1.
- No attribution UI anywhere (constraint #4). No third "completed" bucket
  anywhere (constraint #5).
- Accessibility: `aria-live="polite"` region wrapping the
  loading/error/empty/populated swap so a screen reader announces the
  transition; `h2` headings for "Upcoming"/"Overdue" (proper landmark
  structure, not just visual weight); overdue badge is icon + text, not
  color-only.
- Responsive: single-column flow at all breakpoints (this page has never
  been a card-grid layout and doesn't need to become one) — verify
  spacing/wrapping at mobile/tablet/desktop widths in the visual pass, no
  new `sm:`/`md:` breakpoint logic anticipated beyond what already exists
  in the surrounding `MemberLayout` shell.

## Task 4 — Cross-file parity regression test (Career Success stays untouched)

New file `src/components/RoadmapTeaserParity.test.tsx`. Since
`CareerSuccessRoadmapTeaser.tsx`'s `isRoadmapEvent()` is a local,
unexported function, the test can't call it directly without modifying
that file (not allowed). Instead: render the real, unmodified
`CareerSuccessRoadmapTeaser` component with a mocked `getTimeline()`
fixture containing a mix of roadmap and non-roadmap event types, and
separately run the same fixture through the new, exported
`isRoadmapMilestoneEvent()` from `roadmap.ts`. Assert the teaser's
rendered milestone count (parsed from its "You have N roadmap
milestone(s)" text) equals `fixture.filter(isRoadmapMilestoneEvent).length`.
This proves the two independently-implemented filters agree on the same
data without importing one into the other or editing the teaser file.

## Data transformation / sorting / grouping rules (exact)

1. Fetch all `career_timeline` rows for the user (unfiltered by type at the query level, same as today).
2. Filter to `ROADMAP_EVENT_TYPES` via `isRoadmapMilestoneEvent`.
3. Partition by calendar-day comparison of `event_date` against "today" (local browser date, day-granularity — a milestone dated today is upcoming, never overdue).
4. Sort both partitions ascending by `event_date`.
5. `next` = `upcoming[0]` (if any), removed from the `upcoming` list rendered below it.
6. Both `upcoming` and `overdue` section headings render only when their array is non-empty.

## TDD plan & regression matrix

| Area | New/changed tests | File |
|---|---|---|
| Filter predicate | true/false classification | `roadmap.test.ts` |
| Honest fetch errors | success / Supabase error / empty | `roadmap.test.ts` |
| Grouping/sorting | empty, single-upcoming, single-overdue, today-boundary, mixed-many, all-overdue | `roadmap.test.ts` |
| Date entry | renders, blank-is-valid, value passthrough, reset clears it (success + Cancel) | `AddRoadmapMilestoneForm.test.tsx` |
| Page: 0 milestones | empty state renders, unchanged copy/link | `RoadmapPage.test.tsx` |
| Page: 1 milestone (upcoming) | renders as `next` hero, no Upcoming/Overdue headings | `RoadmapPage.test.tsx` |
| Page: 1 milestone (overdue) | no hero, honest all-overdue notice, Overdue section only | `RoadmapPage.test.tsx` |
| Page: many, mixed | hero + Upcoming + Overdue all present, correct order in each | `RoadmapPage.test.tsx` |
| Page: fetch error | `role="alert"`, Try again re-fetches | `RoadmapPage.test.tsx` |
| Page: no attribution | asserts no strategist/member label anywhere in rendered output, for any fixture | `RoadmapPage.test.tsx` |
| Page: no fabricated completed state | asserts no "Completed" text/badge anywhere, for any fixture including past-dated ones | `RoadmapPage.test.tsx` |
| Career Success parity | teaser count matches `isRoadmapMilestoneEvent` count on the same fixture | `RoadmapTeaserParity.test.tsx` |
| Full-suite regression | 0 failures across the entire existing suite, not just new/changed files | final task |

## Responsive & accessibility verification

- Manual/automated checks at 375px (mobile), 768px (tablet), 1440px (desktop) widths for: empty state, single-upcoming state, many-mixed state, error state.
- `aria-live="polite"` transition announced (verified via RTL's accessible-name/role queries in tests, not just visual).
- Overdue marker uses icon + text (contrast-independent), checked against WCAG 2.2 1.4.1 (Use of Color).
- Keyboard: date input reachable and operable via keyboard alone; "Try again" button focusable and activatable via keyboard.
- Spinner: `role="status"` + visually-hidden label, not just a bare animated icon.

## Visual screenshot / Playwright verification plan

Same throwaway-preview-harness + Playwright convention used in
Sub-Projects 4–6 and referenced in Sub-Project 7's own plan: a temporary,
untracked preview route/harness renders `RoadmapPage` against three fixed
mock data sets (empty / single-upcoming / many-mixed-with-overdue), each
captured at mobile/tablet/desktop widths via
`scripts/visualReviewScreenshots.mjs`, saved under
`docs/superpowers/visual-review/2026-09-07-roadmap-redesign/`. Harness
files are left untracked or neutralized after capture, per the established
convention from Sub-Project 7 and this session's own prior work — never
committed as permanent test/production code.

## Scope guardrails (proving locked surfaces stay untouched)

Final task runs `git diff --stat <pre-task-1-sha>..HEAD` and confirms the
changed-file list is **exactly**: `src/lib/roadmap.ts`,
`src/lib/roadmap.test.ts`, `src/components/AddRoadmapMilestoneForm.tsx`,
`src/components/AddRoadmapMilestoneForm.test.tsx`, `src/pages/RoadmapPage.tsx`,
`src/pages/RoadmapPage.test.tsx`, `src/components/RoadmapTeaserParity.test.tsx`
— nothing else. Any additional file in that diff is a stop-and-report
condition, not something to explain away.

## Risks / assumptions / deferred follow-ups

**Risks/assumptions:**
- Backdating is allowed with no "future date only" validation (Task 2) — a
  deliberate choice, flagged in case the product intent was actually to
  restrict target dates to the future.
- "Today" is computed from the browser's local clock, not a server
  timestamp — acceptable for a UI-only overdue/upcoming distinction, but
  worth knowing if a member's device clock is wrong, their own view could
  disagree with a strategist's view of the same data for a few hours
  around a date boundary.
- `getRoadmapMilestones()` duplicates `getTimeline()`'s query shape rather
  than refactoring it — intentional, to avoid touching a function three
  other call sites (including a locked surface) depend on for its current
  error-swallowing behavior.

**Deferred follow-ups (not part of this phase):**
- Real creator attribution (strategist vs. member vs. admin) requires a
  future migration adding a persisted `created_by` (or similar) value to
  new `career_timeline` rows — not retroactive for existing rows, and not
  built here.
- A truthful "completed" state requires a future persisted signal (e.g. a
  `metadata.completed_at` write path with a real "mark complete" UI
  action) — not built here; today's model can only honestly say
  upcoming/overdue.
- Entry points into Roadmap from ForwardOS Home, Career Compass results,
  or Friday Reports are product opportunities worth pursuing later, as
  read-only links pointing at `/roadmap` — explicitly not built in this
  phase, and would need their own review since they touch locked surfaces.
- A dedicated `career_roadmap_milestones` table (Direction C from the
  audit) remains the right move if/when this generic-model redesign turns
  out to be insufficient in real strategist/member use — not scheduled,
  not started.

## Final task — full regression + report

1. `tsc --noEmit`, full `npm test`, `npm run build` — all clean, zero
   regressions anywhere in the existing 486-test baseline.
2. Scope guardrail diff (above).
3. Visual verification captured and saved.
4. Commit(s) with clear, scoped messages (mirroring this session's
   established convention — one commit per task, not one giant commit).
5. Report back with the same shape used for the write-path repair: what
   shipped, test counts before/after, any findings from self-review, and
   an explicit statement that no live Supabase state was touched.
