# Implementation Plan — N13: Discarded-Signal Activation (X8a + X4a)

**Status:** PLANNED — not started. **Owner:** John Carter (architecture — single call-site change)
with implementation by the Opportunity Intelligence / Career Intelligence specialist. **QA:** Nina
Patel. **Origin:** second-pass Recommendation Duplication Audit —
`11-recommendation-duplication-correction.md` §3, §6. Highest value-per-hour item identified in
either audit pass.

## Why this exists

`src/hooks/useForwardScore.ts:163-169` already computes three real lifecycle signals —
`hasRecentOrUpcomingInterview`, `submittedInLast30Days`, `hasRespondedToMessages` — every time the
hook runs. Line 175 then passes **only** `{ hasActiveApplication }` into
`getNextBestMove(context)`, whose signature (`src/lib/forwardScore/nextBestMove.ts:117-119`) only
accepts that one key. The other three signals are computed and discarded on every load. This is
hours of wiring work, not a new engine.

Separately, `CareerVaultEvidenceCoverageProvider` already emits `SKILL_WEAK_VAULT_EVIDENCE` findings
naming specific weak skills, but `nextBestMove`'s rules table only ever references the aggregate
evidence-quality pillar score, never a specific skill name. Threading one already-computed value
through is the same class of fix.

## Scope (X8a — context widening)

1. Widen `NextBestMoveContext` (or equivalent type) in `nextBestMove.ts` to accept the three
   discarded signals.
2. Update the call site in `useForwardScore.ts:175` to pass all four signals instead of one.
3. Add/extend deterministic rules in `nextBestMove.ts`'s fixed rule table to route on the new
   signals (e.g., "upcoming interview" → CTA toward interview prep once X3a exists; until then,
   route toward Career Vault/STAR-story review). Rules stay fixed/deterministic per the existing
   architecture — no new nondeterminism introduced.
4. No new database schema. No new UI surface beyond whatever `nextBestMove`'s existing CTA renderer
   already displays.

## Scope (X4a — name the specific weak skill)

1. Thread the specific skill name(s) from `SKILL_WEAK_VAULT_EVIDENCE` findings into the
   `nextBestMove` context alongside the aggregate evidence-quality pillar score.
2. Update the relevant rule(s) to name the skill in the recommended action copy (e.g., "Add a
   Career Win that demonstrates **Python** instead of the generic "improve your evidence" copy).
3. No change to `CareerVaultEvidenceCoverageProvider` itself — this only threads an already-computed
   value one hop further downstream.

## Explicitly out of scope

- X8b (offer/rejection-decision actions) — genuinely gated on N5's structured offer/rejection
  entities; do not attempt in this pack.
- X4c (proactive surfacing of evidence findings outside Resume Intelligence) — needs a UI home
  decision; separate NEXT-tier item.
- Any change to how `useForwardScore.ts` computes the three signals — they're already correct;
  this only stops throwing them away.

## Acceptance criteria

- `getNextBestMove` receives and can act on all four signals plus the specific weak-skill name(s).
- Existing `nextBestMove` unit tests continue to pass; new tests cover the newly-wired signal paths
  and skill-naming behavior.
- No regression in `useForwardScore.test.ts` or dashboard rendering.
- Nina confirms via targeted QA that a member with an upcoming interview, a recent submission, or an
  unread strategist message sees a differentiated Next Best Move CTA — and that a member with a
  specific weak-evidence skill sees it named, not just referenced abstractly.
