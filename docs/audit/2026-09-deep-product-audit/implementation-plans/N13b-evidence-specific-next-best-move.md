# Implementation Plan — N13b: Evidence-Specific Next Best Move Integration (X4a)

**Status:** BLOCKED / NOT STARTED — do not implement until the architecture ruling below is
formally re-confirmed at build time. **Owner:** John Carter (architecture — canonical data path
must be approved before any code is written). **Origin:** split out of the original combined N13
per ChatGPT/owner review — see `N13a-lifecycle-signal-activation.md`'s split rationale.

## Why this is a separate, blocked ticket

The original N13 described X4a as "threading one already-computed value one hop further
downstream" — as if `SKILL_WEAK_VAULT_EVIDENCE` findings were sitting in `useForwardScore.ts`
alongside the lifecycle signals N13a activates. **That framing is not accurate and must not be used
to justify treating N13b as small.** The finding is generated inside Resume Intelligence's
`CareerVaultEvidenceCoverageProvider.score()`, which:

- is `async` and queries `career_win_capabilities` directly,
- is scoped to a **specific resume version's** `claimedSkills` (not the member's overall skill set),
- returns `status: 'unavailable'` for a member with no resume at all.

`useForwardScore.ts` does not currently possess this finding. Importing it naively into the Forward
Score / Next Best Move path would:

1. duplicate a Career Vault query the hook doesn't otherwise need,
2. rerun part of Resume Intelligence's scoring on every dashboard load,
3. couple Forward Score (deliberately pure, synchronous-composable, resume-independent) to
   resume-analysis internals, and
4. risk **two competing definitions of "weak evidence"** — the vault-evidence-coverage one
   (`career_win_capabilities`-count-based, resume-scoped) versus a simpler one already available
   (see below), which would itself become a data-integrity/documentation-truth problem of exactly
   the kind N12 exists to catch.

## Candidate canonical data path (John Carter's architecture recommendation — not yet a final ruling)

`useForwardScore.ts` already fetches `careerSkills` via `getSkillStates`, where each row carries
`state: 'claimed' | 'demonstrated' | 'supported'` — the **same underlying source**
`evidenceQualityPillar` already scores from. Deriving "the first `claimed`-state skill" from data
the hook already has is free (no new query) and — critically — guarantees the Next Best Move copy
and the Evidence Quality pillar score can never disagree, because they'd share one definition of
"weak evidence" instead of two.

**John's recommendation: use `career_skills.state`, explicitly reject threading
`SKILL_WEAK_VAULT_EVIDENCE` from `CareerVaultEvidenceCoverageProvider` for this purpose.** This
recommendation is recorded here as the leading candidate, but per the owner/ChatGPT instruction,
**N13b must not be implemented until this data path is formally approved as a build-time
architecture ruling** (i.e., re-confirmed against whatever the Resume Intelligence and Forward Score
subsystems look like at the time N13b is actually picked up — do not implement purely on this
document's word after time has passed).

## Additional design property this ticket must resolve before implementation

Naming a specific skill in copy means **interpolated text**, not the static string literals every
existing `NextBestMove` rule uses today. That ends the property the current (and N13a's) regression
tests rely on — that the total output space is a small, finite, enumerable set of fixed objects.
Whoever picks up N13b must design (and get John's sign-off on) a test strategy for interpolated
copy — e.g., asserting on `key` + `cta.to` as the invariant while treating `headline`/`detail` as
templated — before writing the feature, not after.

## Explicit gate

**Do not implement N13b until:**
1. John Carter re-confirms the `career_skills.state`-based data path (or a superseding alternative)
   as architecturally sound against the codebase as it exists at that time, in writing, and
2. A test strategy for interpolated (non-enumerable) copy is designed and reviewed.

Until both are satisfied, this ticket stays in the backlog as BLOCKED, not IN PROGRESS. N13a does
not depend on this and should not wait for it.
