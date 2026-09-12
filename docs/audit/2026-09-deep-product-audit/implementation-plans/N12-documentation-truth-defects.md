# Implementation Plan — N12: Documentation-Truth Defect Pack

**Status:** PLANNED — not started. **Owner:** Ethan Cole (defect class is security/trust-adjacent,
same lineage as D-05) with implementation by the relevant domain specialist. **QA:** Nina Patel.
**Origin:** discovered during the second-pass Recommendation Duplication Audit —
`11-recommendation-duplication-correction.md` §1-2.

## Why this exists

`src/lib/resumeIntelligence/evidenceCoverage.ts:27` contains a **member-reachable string** — the
`unavailableReason` on `NullEvidenceCoverageProvider` — that asserts *"Career Vault does not exist
yet."* Career Vault has existed and been live since `20260908000000_career_vault.sql` shipped. This
is the exact same defect class as D-05 (the dashboard's false "Career Vault — coming soon" card),
found one layer deeper, in library fallback code instead of UI copy. Per the new standing rule
("Docstring Lies Are Bugs"), this is filed as a defect, not documentation debt, and blocks release
the same way D-05 does.

The same false claim recurs in three more places, none yet confirmed member-reachable but all
factually wrong and worth correcting in the same pass:
- `src/lib/resumeIntelligence/resume.ts:104`
- `src/lib/opportunityEngine/memberOpportunityProfile.ts:55`
- `src/lib/resumeIntelligence/evidenceCoverage.test.ts:8`

## Scope

1. Confirm exactly which of the 4 occurrences are reachable by a real member-facing code path
   (start with `evidenceCoverage.ts:27`, which is the confirmed one) vs. internal comments only.
2. Rewrite each string/comment to reflect reality — Career Vault exists; the `Null...Provider`
   fallback should describe its *actual* trigger condition (e.g. "member has no Career Vault
   entries yet" or "evidence coverage temporarily unavailable"), not a false absence claim.
3. Update `evidenceCoverage.test.ts:8` so the test's own documentation doesn't perpetuate the lie.
4. No behavior change — this is a truth-in-strings fix, not a logic change. If fixing the string
   reveals the fallback condition itself is wrong (e.g. it's reachable when it shouldn't be), that
   becomes a separate ticket, not scope creep here.

## Explicitly out of scope

- Any change to `CareerVaultEvidenceCoverageProvider`'s actual detection logic.
- Any change to Resume Intelligence's UI presentation of evidence findings.
- A full sweep of the entire codebase for similar stale strings beyond the 4 named above — that is
  a good candidate for a follow-up N11 sub-task (As-Built Sweep), not this pack.

## Acceptance criteria

- Zero grep hits for "Career Vault does not exist" (or equivalent false-absence phrasing) across
  `src/`.
- `evidenceCoverage.test.ts` passes and its own documentation is accurate.
- No new test regressions in the resume intelligence or opportunity engine suites.
- Nina confirms via targeted QA that the member-facing fallback message (if reachable) reads
  correctly for a member who genuinely has zero Career Vault entries.
