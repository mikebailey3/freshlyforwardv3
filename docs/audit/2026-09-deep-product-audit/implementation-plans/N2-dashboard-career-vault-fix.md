# Implementation Plan — N2: Dashboard "Career Vault" Stale-State Correction

**Status:** PLANNED — not started (this audit is documentation-only; no product code changed).
**Owner:** front-end delivery (Sarah for copy/preview design sign-off, Nina for the test fix).
**Classification of the underlying defect:** BUG / product-UX integration defect — **not** a
missing feature. Career Vault itself is classified **B (complete, needs polish)** elsewhere in this
audit. This plan fixes a dashboard wiring/copy defect, it does not build Career Vault.

## 1. Evidence (exact, cited)

- `src/pages/DashboardPage.tsx:248-253` and `:552-568` render a `CareerVaultPlaceholderCard` with
  the literal text **"Career Vault — coming soon"**.
- The surrounding comment/docblock claims *"This branch has no `career_wins` table, no
  `/career-vault` route, and no Career Vault component."* This claim is false:
  - Migration `20260908000000_career_vault.sql` creates `career_wins` and `career_win_capabilities`.
  - Route `/career-vault` is live in `src/App.tsx:176`.
  - `src/components/careerVault/` contains real, shipped components, including an existing
    `CareerVaultTeaserCard` suitable for reuse on the dashboard.
  - Nav entry exists in `MemberLayout.tsx:43`.
  - Career Vault data already feeds FreshFit scoring.
- `src/pages/DashboardPage.test.tsx:172-203` actively **asserts** the placeholder text and asserts
  no `/career-vault` link exists inside that card — i.e. the test currently enshrines the bug as
  correct behavior.

## 2. Scope

1. Replace `CareerVaultPlaceholderCard` usage on the dashboard with the existing
   `CareerVaultTeaserCard` component (already built, already used elsewhere per John's audit) —
   reuse, do not build a new component.
2. Wire the teaser card to real Career Vault summary data (wins/capabilities count, or whatever
   `CareerVaultTeaserCard`'s existing prop contract expects — check its current usage site(s) first
   rather than inventing a new data shape).
3. Update `DashboardPage.test.tsx` to assert the **correct** state: a real Career Vault preview
   linking to `/career-vault`, not the placeholder text.
4. Remove the false docblock comment claiming the table/route/component don't exist.

## 3. Explicit exclusions

- **No wider dashboard redesign.** `DashboardPage.tsx` and `src/components/forwardScore/**` are
  locked surfaces under the existing roadmap-redesign plan. This is a scoped, deliberate exception
  to correct a factual error on the page — it is not an invitation to restyle anything else on the
  dashboard.
- Do not touch the Forward Score / Profile Completeness rename (that's N4, a separate, sequenced
  piece of work that depends on N1).
- Do not change Career Vault itself — it is already complete. This plan only fixes how the
  dashboard *represents* it.

## 4. Dependencies

None. This is a self-contained, small fix and can ship independently of N1 (it touches no
uncertain schema — `career_wins` already has confirmed application-code consumers in multiple
surfaces, and the fix itself doesn't depend on resolving the broader migration-verification
question).

## 5. Acceptance criteria

- [ ] Dashboard no longer renders "Career Vault — coming soon" anywhere
- [ ] Dashboard renders a real Career Vault preview (reusing `CareerVaultTeaserCard`) linking to
      `/career-vault`
- [ ] `DashboardPage.test.tsx` asserts the corrected state, not the placeholder
- [ ] The false "no table/route/component" comment is removed from the source
- [ ] Full test suite still green; no other dashboard behavior changed
- [ ] Sarah signs off that the reused teaser card reads correctly in the dashboard's existing
      layout/information hierarchy (no new design work, just a placement check)

## 6. Estimated effort

**Small.** Per John Carter's own estimate: roughly 3 files touched (`DashboardPage.tsx`,
`DashboardPage.test.tsx`, and whatever data-fetch hook backs `CareerVaultTeaserCard`'s existing
usage), no new functionality, no migration required.
