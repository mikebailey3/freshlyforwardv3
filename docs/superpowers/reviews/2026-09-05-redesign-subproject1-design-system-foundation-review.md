# Sub-Project 1: Design System Foundation — Final Review & Deliverables Summary

**Status:** Complete, all 33 tasks. Awaiting owner review per the stop-gate in the locked spec before Sub-Project 2 (Homepage) begins.

**Plan:** `docs/superpowers/plans/2026-09-05-redesign-subproject1-design-system-foundation.md`
**Spec:** `docs/superpowers/specs/2026-09-05-redesign-subproject1-design-system-foundation-design.md`

---

## 1. What this sub-project did

Migrated FreshlyForward from a light, literal-neutral Tailwind palette (`bg-white`, `text-neutral-900`, etc.) to one semantic dark navy/green design-token system — across every primitive, shared component, and page in the app — with **zero changes to business logic, routes, backend behavior, auth, copy, or JSX structure**. Every migration was a class-name substitution reviewed in context against the semantic role table below, never a blind find/replace.

---

## 2. Final semantic token map

### Surfaces & ink (new tokens, Task 1)

| Token | Hex | Role |
|---|---|---|
| `--color-bg` / `bg-bg` | `#031421` | Page background |
| `--color-surface-elevated` / `bg-surface-elevated` | `#062235` | Elevated panel (e.g. hero band) |
| `--color-surface-card` / `bg-surface-card` | `#0A2B3A` | Card surface |
| `--color-surface-subtle` / `bg-surface-subtle` | `#0E3444` | Subtle/nested surface (chips, table headers) |
| `--color-surface-hover` / `hover:bg-surface-hover` | `#123044` | Interactive hover surface |
| `--color-ink` / `text-ink` | `#F4F7FA` | Primary text |
| `--color-ink-muted` / `text-ink-muted` | `#8FA3B8` | Secondary/muted text |
| `--color-border` / `border-border` | `#16374A` | Border/divider |

### Retuned accent scales (Task 1)

`primary` (fresh green, e.g. `--color-primary-600: #2DCE75`), `secondary` (blue-teal), `success`, `warning`, `error` were all retuned lighter/brighter so their light-background-oriented shades (300/400/500) read correctly against the new dark surfaces. `accent` (warm gold) was explicitly left unchanged — out of this redesign's scope.

### Typography scale (Task 1)

`--text-display`, `--text-h1`, `--text-h2`, `--text-h3`, `--text-body`, `--text-body-sm`, `--text-label`, `--text-eyebrow` → utilities `text-display` … `text-eyebrow`.

### Legacy `:root` marketing variables (Task 2)

`--navy`, `--navy-soft`, `--green`, `--green-dark`, `--green-light`, `--mint`, `--cream`, `--line`, `--ink-soft`, `--white`, `--shadow` (plus new `--ink`) were remapped to the same dark palette so the ~150 hand-rolled marketing CSS classes (`.site-header`, `.button-primary`, `.page-hero`, `.pricing-card`, etc.) went dark in lockstep with the Tailwind-token side.

### Standard substitution table (applied by every migration batch)

| Literal (before) | Semantic (after) | Role |
|---|---|---|
| `bg-white` | `bg-surface-card` | Card surface |
| `bg-neutral-50` | `bg-surface-subtle` | Subtle/nested surface |
| `hover:bg-neutral-50`, `hover:bg-neutral-100` | `hover:bg-surface-hover` | Interactive hover surface |
| `bg-neutral-900` (solid dark fill) | `bg-primary-600` | Primary action fill |
| `border-neutral-200`, `border-neutral-300`, `border-neutral-100` | `border-border` | Border/divider |
| `text-neutral-900`, `text-neutral-800` | `text-ink` | Primary text |
| `text-neutral-500`, `text-neutral-600`, `text-neutral-400`, `text-neutral-300` | `text-ink-muted` | Secondary/muted text |
| `text-white` on a `bg-neutral-900`/`bg-primary-*` fill | unchanged (`text-white` already reads correctly on a solid fill) | Text on filled surface |
| Light-tuned accent pairing, e.g. `border-success-300 text-success-700` | Dark-tuned pairing, e.g. `border-success-700 text-success-300` | Status pill/badge on a dark card |

---

## 3. Files migrated, by task

### Tokens & primitives (Tasks 1–12)

- `src/index.css` (Tailwind `@theme` tokens, Task 1; legacy `:root` block + ~150 marketing classes, Task 2)
- `src/components/ui/SectionEyebrow.tsx`, `SectionHeader.tsx`, `CTAButton.tsx`, `SecondaryButton.tsx`, `Card.tsx`, `ProgressBar.tsx`, `Tabs.tsx`, `FilterChip.tsx`, `EmptyState.tsx`, `DataRow.tsx` (+ matching `.test.tsx` for each, + `index.ts` barrel)
- `src/pages/internal/DesignSystemShowcasePage.tsx` (+ test) — new unlinked showcase route, `src/App.tsx` (route registration)
- `src/components/ui/legacyMarketingUi.tsx` (renamed/re-homed from the original `ui.tsx`)

### Layouts (Tasks 13–14)

- `src/components/MemberLayout.tsx`
- `src/components/StrategistLayout.tsx`
- `src/components/PublicLayout.tsx` (verified + one intentional literal-hex fix on the admin-only footer link)

### Shared component batches (Tasks 15–21)

- **Core UI:** `AlternatingRow.tsx`, `Badges.tsx`, `CircularProgress.tsx`, `KeyValueCard.tsx`, `LoadingScreen.tsx`, `ProfileCard.tsx`, `WizardShell.tsx`
- **Preview cards & misc:** `ChatPreviewCard.tsx`, `ChecklistPreviewCard.tsx`, `FridayReportCard.tsx`, `OpportunityPreviewCard.tsx`, `ProfileEditForm.tsx`, `SearchReadinessWidget.tsx`, `freshFit/FreshFitDetails.tsx`, `HowItWorksPage.tsx`
- **Forward DNA:** `forwardDna/CareerGoalsCard.tsx`, `CareerScopeCard.tsx`, `CompassSummaryCard.tsx`, `CompletenessWidget.tsx`, `ResponsibilitiesCard.tsx`, `SkillEvidenceCard.tsx`
- **Forward Score & Career Compass:** `careerCompass/ArchetypeQuestionScreen.tsx`, `ReadinessQuestionScreen.tsx`, `forwardScore/NextBestMoveCard.tsx`, `PillarCard.tsx`
- **Onboarding (2 batches):** `onboarding/OnboardingDocumentUpload.tsx`, `OnboardingHowItWorks.tsx`, `OnboardingQuestionnaire.tsx`, `OnboardingWelcome.tsx`, `OnboardingCelebration.tsx`, `OnboardingConfirmation.tsx`, `OnboardingDashboardIntro.tsx`, `OnboardingMeetStrategist.tsx`
- **Wrap-up sweep fix (Task 22):** `FeatureEntitlements.tsx`, `forwardScore/NextBestMoveCard.tsx`, `forwardScore/PillarCard.tsx` (two missed light-theme leftovers)

### Page batches (Tasks 23–32)

- **Dashboard & onboarding flow:** `DashboardPage.tsx`, `ForwardDnaPage.tsx`, `OnboardingPage.tsx`
- **Career/profile:** `AchievementVaultPage.tsx`, `ActivityFeedPage.tsx`, `CareerProfilePage.tsx`, `CareerSuccessPage.tsx`, `TimelinePage.tsx`
- **Opportunity/application:** `MemberApplicationsPage.tsx`, `MemberOpportunitiesPage.tsx`, `OpportunityEnginePage.tsx`, `WhyWeAppliedPage.tsx` (+ `lib/freshFitScore/tiers.ts` shared styles, `components/freshFit/FreshFitBadge.test.tsx`)
- **Communication/scheduling:** `CalendarPage.tsx`, `InterviewsPage.tsx`, `MessagesPage.tsx`, `MockInterviewPage.tsx`, `NotificationsPage.tsx`
- **Account/billing/settings:** `CheckoutPage.tsx`, `CommunicationPreferencesPage.tsx`, `FoundingMemberPage.tsx`, `MembershipPage.tsx`
- **Product tools:** `FridayReportsPage.tsx`, `LinkedInOptimizerPage.tsx`, `RoadmapPage.tsx`, `ToolsPage.tsx`
- **Public marketing:** `LandingPage.tsx`, `PricingPage.tsx`, `SignUpPage.tsx` (contrast-bug fixes, see §4)
- **Strategist admin batch 1:** `strategist/AdminDashboardPage.tsx`, `AdminMemberDetailPage.tsx`, `AdminMembersPage.tsx`, `AdminReportReviewPage.tsx`, `FeatureEntitlementsPage.tsx`
- **Strategist content/dashboard:** `strategist/BlogManagementPage.tsx`, `BlogPostEditorPage.tsx`, `StrategistDashboardPage.tsx`, `StrategistFridayReportsPage.tsx`
- **Strategist member/opportunity:** `strategist/StrategistApplicationsPage.tsx`, `StrategistMemberWorkspacePage.tsx` (1,063 lines — largest file in the project), `StrategistMembersPage.tsx`, `StrategistOpportunitiesPage.tsx`, `StrategistOpportunityEnginePage.tsx`

**Total: ~90 distinct source files touched** across tokens, primitives, layouts, shared components, and pages.

---

## 4. Bugs found and fixed during migration (not pre-existing scope, but caught by visual QA)

These were genuine contrast/legibility defects exposed once real screenshots were taken — each was a pre-existing assumption (some CSS var or class meant "dark text on light background") that broke once the underlying variable was retuned dark. All were fixed in the same task they were discovered:

1. **Landing hero heading** (`LandingPage.tsx`) — used `text-[var(--navy)]`, which became dark-on-dark after `--navy` was retuned. Changed to `text-[var(--ink)]`.
2. **SignUp plan-selection banner** (`SignUpPage.tsx`) — used `color: var(--navy)` on the dark `var(--mint)` fill. Changed to `var(--ink)`.
3. **How It Works dashboard section** (`HowItWorksPage.tsx`) — separate dark-on-dark contrast bug, fixed in its own commit (`44033c5`).
4. **About page checklist text** (`src/index.css`) — separate dark-on-dark contrast bug, fixed in its own commit (`e7be925`).

---

## 5. Intentional literal-color exceptions (documented, not silently kept)

| Location | What | Why it's an exception |
|---|---|---|
| `src/index.css` — `.contrast-muted` | `background: rgba(255,255,255,.07)` | Already a low-opacity white overlay — works correctly as a subtle highlight on the dark surface as-is; not a literal light-theme leftover. |
| `src/index.css` — `.blog-filter-pill.active` | `color: white` → left as `color: var(--navy)` | The active pill has a solid green fill; it needs **dark** text for contrast against that fill, which is the opposite of every other text-color substitution in this migration. Intentionally not "fixed" to `var(--ink)`. |
| `src/components/PublicLayout.tsx` (pre-existing, fixed in Task 14) | Inline hardcoded hex on the admin-only footer link | One-off inline style, corrected to the semantic token during the StrategistLayout batch since it was in the same file family. |

No other literal-color exceptions were found or preserved. Everything else in scope was migrated to a semantic token.

---

## 6. Verification results (fresh run, this task)

```
npx tsc --noEmit         → PASS (zero errors)
npm test -- --run        → PASS — 82 test files, 425 tests, 0 failures
npm run build             → PASS — production build succeeds
                             (pre-existing >500kB single-chunk warning,
                             unrelated to this migration; not addressed
                             here per scope)
```

Same three commands were re-run and passed after every single task (1 through 32) throughout the migration, not just at the end.

---

## 7. Visual sweep — screenshots

**Showcase route:** `/internal/design-system` — every foundational primitive (surfaces, typography, buttons, cards, progress bars, tabs, filter chips, data rows, empty/loading/error states, nav states) shown with realistic FreshlyForward content. Not linked from any public navigation.

**Screenshot directory (this task):** `docs/superpowers/reviews/screenshots/subproject1-final/`

Captured at both desktop (1440×900) and mobile (375×812) for:
- `/` (landing)
- `/how-it-works`
- `/pricing`
- `/about`
- `/faq`
- `/internal/design-system`

**Signed-in pages (`/dashboard`, `/opportunity-engine`, `/forward-dna`, `/career-compass/assessment`) could not be captured.** This is a hard environment constraint, not a missing test account: this sandbox has no network path to the project's Supabase host at all (`Test-NetConnection` confirms DNS resolution itself fails for `siysdmgdsxlceewlwngl.supabase.co`), so no sign-in flow can complete here regardless of credentials. Every strategist/member/admin page in Tasks 23–32 was instead verified by direct code review of the migrated JSX (grep-swept for zero remaining `neutral-`/`bg-white` literals after each file) plus the full automated test suite, which exercises these components' rendering logic without requiring a live network session.

**Result of the visual sweep:** no page shows a half-dark/half-light mix, no illegible text-on-background pairing, and no leftover literal-white flashes, across all 12 captured screenshots. The one known non-visual defect (Pricing plans stuck on a loading spinner) is caused by the same Supabase network unreachability described above, not a design-system regression — the loading state itself renders in-theme correctly.

An earlier checkpoint sweep also exists at `docs/superpowers/visual-review/2026-09-06-task29-public-marketing/` and `docs/superpowers/visual-review/2026-09-06-task33-final-verification/` from intermediate task work.

---

## 8. Stop-gate

Per the locked spec, Sub-Project 2 (Homepage) does not begin until the owner has reviewed this document and the linked screenshots and given explicit approval.
