# Implementation Plan — N13a: Lifecycle Signal Activation (X8a)

**Status:** IN PROGRESS. **Owner:** John Carter (architecture, design approved below) with
implementation by the Opportunity Intelligence / Career Intelligence specialist. **Security:** Ethan
Cole (mandatory review of lifecycle data reaching a member-visible card). **QA:** Nina Patel.
**Origin:** second-pass Recommendation Duplication Audit — `11-recommendation-duplication-correction.md`
§3, §6 — **split out of the original N13 per ChatGPT/owner review** (see split rationale below).

## Split rationale (why N13 became N13a + N13b)

The original N13 combined two different complexity classes into one ticket:

- **X8a (this doc, N13a):** wiring three signals `useForwardScore.ts` already computes but discards
  before they reach `getNextBestMove`. Pure call-site + rule-table extension, no new queries, no new
  data source, no coupling to another subsystem.
- **X4a (now N13b):** naming a *specific weak skill* in the recommendation copy. This is NOT a
  same-hop threading exercise — the finding (`SKILL_WEAK_VAULT_EVIDENCE`) is generated inside
  Resume Intelligence's `CareerVaultEvidenceCoverageProvider`, which is async, scoped to a specific
  resume version's claimed skills, and returns `status: 'unavailable'` for members with no resume.
  Wiring it naively would couple Forward Score to Resume Intelligence internals and risks a second,
  competing definition of "weak evidence." **N13b requires its own architecture ruling on the
  canonical data path before implementation — see that document. Do not implement N13b as part of
  this ticket.**

N13a remains the immediate, tightly-scoped, high-value fix. It does not wait on N13b's data-path
question.

## Architecture design (John Carter, approved 2026-09-12 — see full review in session history)

### Corrected signal semantics — do not wire the raw pillar inputs as-is

Three defects were found in what a naive "just thread the existing values through" wiring would
have shipped — all independently confirmed by both John's own review and a second ChatGPT pass:

1. **Mock-interview poisoning.** `hasRecentOrUpcomingInterview` is `true` forever after a member
   completes even one mock interview (`status === 'completed'` never becomes false again). Wiring
   this straight through as an urgency trigger would pin "prepare for your interview" permanently
   for any member who ever did one mock session, with no real interview scheduled. **Fix:** derive a
   new, narrower `hasUpcomingInterview` signal from `applications.interview_date >= now` only —
   excludes mock interviews entirely. Same definition `DashboardPage.tsx`'s existing
   `upcomingInterviewApps` filter already uses.
2. **30-day window too coarse for a CTA.** `submittedInLast30Days` is true for nearly the entire
   membership of any active member, which would make the pillar rules almost unreachable if used as
   a tier-2 trigger. **Fix:** derive a new `submittedRecently` signal on a 7-day window from the same
   already-fetched `date_submitted` rows. The 30-day pillar input is untouched.
3. **Own-message counting.** `hasRespondedToMessages` (`unreadMessages.length === 0`) counts the
   member's own outbound messages as "unread" because the query has no `sender_type` filter — a
   member who messages their strategist instantly looks like they have unread messages. **Fix:**
   derive `hasUnreadInboundMessages` from `unreadMessages.some(m => m.sender_type !== 'member')`
   (requires widening the existing query's `.select('id')` to `.select('id, sender_type')` — same
   query, one extra column, not a new round trip). Also: **name the field in the affirmative** —
   `hasUnreadInboundMessages`, never an ambiguous inverse like `hasRespondedToMessages`.

**Known, deliberately deferred:** the pillar-side `hasRespondedToMessages` computation has the same
own-message-counting bug today, feeding the Career Momentum pillar score. **Not fixed in N13a** —
fixing it would shift every member's Forward Score as a side effect of a wiring ticket, which is out
of scope here. Filed as a separate defect (see gap register note below); `MemberLayout.tsx`'s unread
badge shares the same root cause and should be checked in that same follow-up.

### Widened context shape

New named, exported interface in `src/types/forwardScore.ts` (not an inline object literal):

```ts
export interface NextBestMoveContext {
  hasActiveApplication: boolean       // unchanged
  hasUpcomingInterview: boolean       // NEW — real interview only, excludes mock interviews
  submittedRecently: boolean          // NEW — 7-day window, distinct from the 30-day pillar input
  hasUnreadInboundMessages: boolean   // NEW — excludes the member's own outbound messages
}
```

All four fields required (no optional signals — that would silently reintroduce exactly the bug
this ticket exists to fix). No `Date`/timestamp fields — `nextBestMove.ts` stays pure and
time-free; all time evaluation happens once in the hook.

### New `NextBestMoveKey` values (extend the existing union, do not replace it)

| New key | `cta.to` | Why this route |
|---|---|---|
| `prepare_for_interview` | `/interviews` | Only surface showing which interview and when; not gated by any plan/feature flag |
| `follow_up_on_application` | `/applications` | Canonical application list; already renders `status`/`follow_up_date` |
| `reply_to_strategist` | `/messages` | Only surface with the thread; opening it marks messages read, so the CTA self-clears on next load |

Copy stays static string literals (no interpolation) — preserves the existing property that the
total NextBestMove output space is a small, finite, enumerable set. **Sarah Chen reviewed tone and
requested two softenings (applied): the interview detail line read as alarmist ("the most
time-sensitive thing on your plate right now"), and the strategist-message headline read as
guilt-tripping ("waiting to hear from you"). Final approved copy:**

- `prepare_for_interview` — headline: "You have an interview coming up — take a moment to prepare"
  · detail: "Your interview is coming up soon, so it is worth reviewing the role and your talking
  points now." · cta label: "Review your interviews"
- `follow_up_on_application` — headline: "You applied recently — follow up while it is fresh" ·
  detail: "A recent submission is easiest to check while it is still fresh. Review its status and
  next steps." · cta label: "Review your applications"
- `reply_to_strategist` — headline: "You have a new message from your strategist" · detail: "You
  have an unread message from your strategist or the FreshlyForward team. A quick reply can keep
  things moving." · cta label: "Open your messages"

### Deterministic precedence — `LIFECYCLE_PRIORITY`

A second fixed array, evaluated **before** the existing pillar algorithm, same discipline as
`PILLAR_PRIORITY`:

```
LIFECYCLE_PRIORITY (fixed, never reordered by data)
  [0] prepare_for_interview      <- context.hasUpcomingInterview
  [1] follow_up_on_application   <- context.submittedRecently
  [2] reply_to_strategist        <- context.hasUnreadInboundMessages
```

Algorithm: walk the array left to right; the first entry whose predicate is true wins, returned
immediately. If none fire, run the existing 4-pillar algorithm byte-for-byte unchanged.

**Why lifecycle outranks all four pillars:** (1) perishability — pillar advice is evergreen, dated
obligations expire; (2) the momentum inversion — all three lifecycle signals also feed the Career
Momentum pillar score, so an active member's higher momentum score makes momentum *less* likely to
be the lowest pillar, meaning the pillar path would speak least precisely exactly when the member is
most active. Running lifecycle first is the only ordering that resolves that inversion.

**Why interview > submission > message within the tier:** interview is externally imposed,
calendar-dated, and irreversible if missed (no re-prep after the fact). Submission follow-up is
member-controlled and measured in days, not hours. Unread message is genuinely important but is the
only one of the three with redundant persistent surfacing elsewhere (`MemberLayout` unread badge,
`/messages` nav item) — least additive use of the single Next Best Move slot.

**Explicit answer for the multi-signal case:** upcoming interview AND unread messages ->
`prepare_for_interview`, always — array position resolves it, no tie-break needed. Verified via an
exhaustive 16-combination table test (all combinations of the four booleans).

**Ratified product judgment (accepted as designed, documented rather than re-litigated):** lifecycle
bypasses the pillar `THRESHOLD` entirely — a member with a catastrophic Forward DNA score and an
interview tomorrow sees interview prep, not "complete your profile." No second "critical threshold"
escape hatch — that would be a tunable knob, and knobs are how deterministic rule tables rot into
scoring engines.

### Deferred, not included in N13a (kept minimal by design)

- **`waiting_on_member` application status as a 4th lifecycle tier** — a legitimate candidate
  (explicit strategist-raised block, unambiguous, zero new queries) but adding a 4th signal expands
  scope beyond the three signals this ticket exists to activate. Revisit as a fast-follow once N13a
  ships and is observed in production, not bundled in now.
- **Analytics/instrumentation on `NextBestMoveCard`** — none exists today (no click/impression
  tracking). N13a ships on reasoning + QA, not measured outcome; do not claim an engagement lift
  without separate instrumentation work.

### Call-site changes (`useForwardScore.ts`)

- `hasActiveApplication` — reuse `inputs.momentum.hasActiveApplication` unchanged.
- `hasUpcomingInterview`, `submittedRecently`, `hasUnreadInboundMessages` — new local derivations,
  zero new queries, from rows already fetched (see semantics above).
- Line ~175 call becomes `getNextBestMove(score, { hasActiveApplication, hasUpcomingInterview,
  submittedRecently, hasUnreadInboundMessages })`.
- **Explicitly not changed:** `inputs.momentum` and its four existing fields, `computeForwardScore`,
  `pillars.ts`, `score.ts`, `NextBestMoveCard.tsx` rendering, any SQL/RLS/migration.

## Test plan

- `buildContext(overrides)` helper (mirrors existing `buildResult(overrides)`), defaulting all four
  booleans to `false` — existing 13 pillar tests updated to compile and pass unchanged (checkpoint
  proving the refactor is non-destructive).
- One new test per lifecycle tier (interview, submission, message) confirming it fires and produces
  the correct `cta.to`.
- Exhaustive 16-combination precedence table test.
- Dedicated regression test: a `completed` mock interview with no future `interview_date` must NOT
  trigger `prepare_for_interview` (C1 guard).
- Regression test rename + strengthen: `nextBestMove.test.ts`'s "one of the three routes" test
  becomes a 5-route allow-list (`/forward-dna`, `/career-compass`, `/applications`, `/interviews`,
  `/messages`), asserting both no-rogue-route AND no-dead-route (produced-set equals allowed-set).
- `FALLBACK` docstring and `getNextBestMove` algorithm docstring rewritten to match the new
  two-tier algorithm — the "only three routes" sentence must not be left to go stale (N12 lesson).
- `useForwardScore.test.ts`: new cases per derivation plus the mock-interview guard case.
- `DashboardPage.test.tsx`: existing all-`[]`-fixture cases stay green (all lifecycle booleans
  false -> unchanged `stay_the_course` behavior).

## Explicitly out of scope

- X4a (weak-skill naming) — now N13b, blocked on its own architecture ruling.
- X8b (offer/rejection-decision actions) — gated on N5's structured offer/rejection entities.
- Fixing the pillar-side `hasRespondedToMessages` own-message bug — filed separately, not fixed here.
- `waiting_on_member` as a lifecycle tier — deferred fast-follow candidate, not in this ticket.
- Any change to how the pillar-side momentum inputs are computed.

## Acceptance criteria

- [ ] `getNextBestMove` receives and can act on all four `NextBestMoveContext` fields
- [ ] `LIFECYCLE_PRIORITY` fires before pillar logic, deterministically, per the fixed array above
- [ ] C1/C2/C3 guards each have a dedicated regression test
- [ ] Regression test's allowed-route set updated to 5 routes, bidirectional (no rogue, no dead)
- [ ] `FALLBACK`/algorithm docstrings updated to match new behavior
- [ ] Full suite green, build clean
- [ ] Ethan's security review confirms no cross-member data exposure and no logging leakage from the
      widened context
- [ ] Sarah's tone sign-off on interview-tier copy
- [ ] Nina confirms via targeted QA that a member with an upcoming interview, recent submission, or
      unread inbound message sees the correct differentiated CTA, and that mock-interview-only /
      own-message-only members do NOT get a false positive
