# QA / Testing Review

## Scope
Read-only QA audit of the FreshlyForward test suite and test posture, informed by John Carter’s repo/architecture audit.

I independently ran:
- `npm run build`
- `npx tsc --noEmit`
- `npm run test -- --run`

I also inspected the repo’s test layout, searched for skipped/ignored tests, checked for Playwright/E2E coverage, and reviewed the specific stale Career Vault placeholder concern.

---

## Verification results

### Build
`npm run build` succeeded.
- TypeScript compile: passed
- Vite production build: passed
- Reported build stats:
  - `2395 modules transformed`
  - `dist/assets/index-D8HuvZaE.js` — `3,614.81 kB` (`1,085.79 kB gzip`)
  - `dist/assets/pdfjs-OHSPhjXw.js` — `1,600.73 kB` (`492.53 kB gzip`)
  - build time: `2.34s`
- Build emitted a chunk-size warning, but it did **not** fail the build.

### Typecheck
`npx tsc --noEmit` succeeded with exit code 0.

### Test suite
`npm run test -- --run` succeeded.
- Test files: `219 passed`
- Tests: `1429 passed`
- Duration: `29.85s`
- No failed, skipped, or todo tests were found in the executed suite.

### Working tree
`git status --porcelain=1` showed:
- `?? _pin_models.py`
- `?? docs/audit/2026-09-deep-product-audit/`

I did not modify production code.

---

## What is genuinely well-tested

FreshlyForward has strong unit coverage in the core domain libraries and many UI components.

Examples of real behavioral / failure-path coverage:
- Resume ingestion:
  - corrupt / malformed document handling
  - anti-fabrication checks
  - extraction fallback behavior
- Opportunity Engine:
  - job normalization and deduplication
  - exclusion rules
  - ranking and recurring gaps
  - dismissal failure paths
- Career Vault / Forward DNA / Forward Score:
  - deterministic logic, state transitions, and scoring rules
- Auth / RLS / regression paths:
  - auth refetch loop regression
  - null-authz RPC regression
  - reserved-event immutability / RLS guards
  - public profile privacy allow-list behavior

This is not a shallow “lots of tests, no substance” repo. There is real logic coverage and meaningful negative-path testing.

---

## Where the suite is weak

### 1) No browser E2E coverage
I found **no Playwright specs** and no e2e test folder/config. There is one integration test in the suite (`src/lib/resumeIntelligence/resumeIntelligenceJourney.integration.test.ts`), but it is not a browser journey.

That means the critical member flow is **not** verified end-to-end:
- onboarding
- Career Vault
- Opportunity Engine
- application lifecycle

At present, the suite is almost entirely unit/component/integration-by-mocks.

### 2) Many page-level routes have no direct tests
Component coverage is broad, but page coverage is uneven. I found a large set of route pages with no dedicated test file, including:
- `OnboardingPage`
- `MessagesPage`
- `NotificationsPage`
- `TimelinePage`
- `MemberApplicationsPage`
- `MemberOpportunitiesPage`
- `InterviewsPage`
- `ForwardFeedPage` / `ForwardFeedPostPage`
- several strategist/admin pages

The repo has many robust unit tests, but several user-facing routes are only indirectly covered or not covered at all.

### 3) Migration checks are still mostly text-based
A few regression tests are intentionally static and inspect SQL files as text rather than executing them against Postgres.

Examples:
- `src/lib/forwardProfilesPublicViewMigration.test.ts`
- `src/lib/careerTimelineReservedEventTypeRlsMigration.test.ts`
- `scripts/lib/marketIntelligenceAdminPolicyRegression.test.ts`

These are useful drift guards, but they do **not** prove the migrations actually ran in a live database.

### 4) Some tests emit React `act(...)` warnings
The suite passes, but stderr includes repeated React warnings in component/page tests, especially around:
- `MemberLayout`
- `ResumeIntelligencePage`
- `ProfileEditForm`
- `ResponsibilitiesCard`
- `CareerScopeCard`
- `SkillEvidenceCard`
- `CareerGoalsCard`

That is not a failing suite, but it is test hygiene debt and a sign that some interaction tests are not fully wrapped in `act(...)`.

---

## Placeholder / snapshot-style risk: Career Vault

John Carter’s concern is real and still present in the test suite.

### Verified issue
`src/pages/DashboardPage.test.tsx` contains a test that **actively pins the wrong state**:
- it asserts the dashboard renders the heading **`Career Vault — coming soon`**
- it asserts the card contains no `/career-vault` link inside the card subtree

The relevant test is:
- `src/pages/DashboardPage.test.tsx`
- test name: `renders the Career Vault placeholder card with no link inside the card itself pointing at /career-vault`

That test is now a dependency hazard: once the UI bug is fixed, this test must be corrected or removed so it does not preserve the stale placeholder behavior.

I did **not** change the test or the UI; this is analysis only.

---

## Skips / xfails / silent passes

I searched for common skip markers and found none in the repo’s test files:
- no `describe.skip`
- no `it.skip`
- no `test.skip`
- no `xit`
- no `todo` tests
- no `only` tests

So the suite is not hiding critical failures behind skipped tests.

---

## What to do about the migration uncertainty

John’s PARTIAL classifications that stem from the “NOT APPLIED migration” problem can be improved in two different ways:

### Can be strengthened by forward-only migration-application tests
These can verify that the migration SQL applies cleanly to a fresh DB and produces the expected schema objects / policies:
- public Forward Profile view migration
- Career Timeline reserved-event RLS migration
- OE security-hardening migrations
- resume/master-resume Phase 2 schema work
- exclusion / dedup / view-related migrations
- admin-policy hardening migrations

This would materially improve confidence and reduce “text-only” drift risk.

### Still requires DB Lead / live schema confirmation
No test can tell us what is actually applied in production today. For that, we still need a definitive live-schema ledger from ChatGPT / DB Lead.

So the rule is:
- **tests can prove the migration is valid and forward-applicable**
- **DB Lead must prove whether it is actually live**

That live-state question is still unresolved for the current audit.

---

## Release-readiness verdict if shipped today

Based on test evidence alone, I would flag the product as **NOT READY** for release-gate purposes, for these reasons:

1. **No browser E2E coverage** of the core member journey.
2. **A known bad dashboard assertion** still enshrines the stale Career Vault placeholder.
3. **Live schema state remains uncertain** because important migration coverage is text-based only.
4. **Several route pages have no direct tests**, especially around onboarding, messaging, notifications, applications, interviews, and strategist/admin workflows.
5. **React act warnings** indicate some test interactions are still brittle or incomplete.

That said, the repo is materially stronger than a typical “green but untested” codebase. The core domain logic is well-covered; the biggest gap is end-to-end confidence and schema-live-state verification, not raw unit-test quantity.

---

## Bottom line
FreshlyForward has strong unit and regression coverage, but it is **not release-ready on test evidence alone** because the suite does not yet prove the real member journey in-browser, and it still contains a test that freezes an incorrect Career Vault placeholder state.
