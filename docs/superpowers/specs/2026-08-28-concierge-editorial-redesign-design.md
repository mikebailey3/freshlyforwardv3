# FreshlyForward "Concierge Editorial" Redesign — Design Spec

**Date:** 2026-08-28
**Status:** Draft, pending user review
**Author:** Code Puppy (F&C Command Center), decisions delegated by Mike per session transcript

## 1. Problem Statement

FreshlyForward's entire product — public marketing site and authenticated member/
strategist app — currently runs one deliberately-chosen, fully-built visual direction
called **"Production Call Sheet"** (sharp borders, mono-font metadata, rotated
approval stamps, masthead-style headers; see provenance comment in `index.html` and
the trail of "Extend Call Sheet direction to X" commits on `fix/critique-priority-issues`).
It was chosen from 7 generated candidate directions via a documented concept-seed
process and is not a placeholder.

The user has reviewed a new visual direction (reference mockup: soft rounded cards
with subtle shadow, true editorial serif headlines, the product's real "Friday
Report" artifact used as hero proof, before/after resume proof sections) and,
after being shown the cost of full replacement, elected to **fully adopt the new
direction across the entire product**, superseding Production Call Sheet
everywhere — both the original public site and the just-completed Operate-mode
work from this session (42 commits).

This spec covers the resulting design system and its phased rollout. It does not
cover new product features — those are explicitly deferred to a separate,
later brainstorming session (see §8).

## 2. Reference Material

- Reference mockup: soft-rounded editorial marketing page provided by the user in
  chat (not committed to the repo; treated as directional inspiration, not a
  pixel spec — exact spacing/shadow/radius values and exact typeface are
  implementation-time decisions within this spec's constraints).
- `PRODUCT.md` (existing, `impeccable`-authored) — product principles are binding
  constraints on this redesign, especially:
  - Principle 1: credibility rests on visible, attributable human effort (named
    strategist, the Friday report) over generic SaaS polish.
  - Principle 4: Persuade mode (public site) and Operate mode (member/strategist
    tooling) are one design system serving two different jobs — a redesign of one
    must not silently assume it redesigns the other identically.
  - No testimonials/case studies exist or may be fabricated — proof must come from
    showing real product artifacts, not claims.

## 3. Design Direction: "Concierge Editorial"

Full replacement of Production Call Sheet's visual execution, while deliberately
retaining two of its motifs on their own merits (they are good ideas independent
of corner radius):

- **Kept:** monospace treatment for metadata/timestamps/small labels (report
  dates, application IDs, day-by-day tags) — reinforces "real work, precisely
  tracked."
- **Kept:** the rotated "stamp" badge concept for authorized/approved/plan-label
  states — distinctive, legible at a glance, softened to match new corner-radius
  rules rather than removed.
- **Replaced:** sharp/flat card borders → soft rounded corners with subtle
  elevation (shadow) as the default surface treatment.
- **Replaced:** Manrope (a sans-serif marketed as "serif-adjacent") for headlines
  → a true editorial serif for major headings.
- **Replaced:** masthead/dashed-rule documentary structure as the *primary*
  organizing motif on marketing pages → warmer editorial composition (large
  serif headline, real product artifact as hero visual, numbered process
  timeline, proof-by-demonstration sections).

## 4. Design Tokens

### 4.1 Color
No change to the brand palette. `src/index.css`'s existing Tailwind `@theme`
tokens (`--color-primary-*` = brand green, navy `#071a31` as `--navy`) and the
existing semantic scales (success/warning/error) are reused as-is. The reference
mockup uses the same navy/green pairing already in the codebase.

### 4.2 Typography
- **Display/headings:** a true editorial serif replaces Manrope for `h1`/`h2`
  and marketing display type. Candidate: Fraunces or Newsreader (both free,
  Google Fonts-hosted, editorial-warm character matching the reference mockup).
  Final pick made at implementation time; must support the weight range used by
  existing `clamp()`-based responsive heading sizes.
- **Body:** DM Sans, unchanged.
- **Metadata/mono accent:** Space Mono, unchanged in typeface, reduced in scope
  — accent role only (timestamps, IDs, stamps), not structural page furniture.

### 4.3 Shape & elevation
- New default: rounded corners (radius scale to be defined in Tailwind theme,
  roughly 8–16px depending on component size) + a subtle single-layer shadow for
  elevated surfaces (cards, the Friday Report card, modals).
- Buttons: primary CTAs move to fully-rounded (pill) shape per reference mockup;
  secondary/tertiary buttons keep a smaller consistent radius.
- This replaces the flat/sharp-corner "Call Sheet" system (both the original
  `index.css` `.cs-*` classes and this session's Tailwind-based Operate-mode
  flattening work).

### 4.4 Mode-specific intensity (Persuade vs. Operate)
Same tokens, different intensity — not two different systems:

- **Persuade mode:** full expression. Generous shadow, serif headlines
  throughout, imagery-forward blog/proof cards, the numbered process timeline.
- **Operate mode:** quieter sibling. Smaller/rarer shadows, serif reserved for
  page-level `h1` titles only (not every card/row), denser spacing for tables
  and lists, optimized for scanning many rows rather than one hero moment.
  Rationale: a strategist re-reading the same card 40 times a day needs
  usability, not repeated ceremony.

## 5. Shared Component: Friday Report Card

The Friday Report card is built **once** and rendered in both places:
- Persuade mode: the marketing hero visual (as shown in the reference mockup).
- Operate mode: the actual Friday Report a member/strategist works with
  (`FridayReportsPage`, `StrategistFridayReportsPage`).

This is a deliberate trust move — prospects see the literal artifact they'll
receive, not an approximation of one. Implementation must extract this into a
single component consumed by both surfaces, not two components that happen to
look similar.

## 6. Scope & Phasing

Given the size (53 routed pages across Persuade, Operate-member, and
Operate-strategist/admin — see §7), this spec covers **Phase 1 only**. Later
phases are named here for context but are separate implementation efforts,
planned and executed independently:

- **Phase 1 (this spec → this plan):** Establish the design system foundation
  (tokens in `src/index.css` / Tailwind `@theme`, the shared Friday Report card
  component, base button/card/badge primitives) and validate it end-to-end on
  two representative screens:
  1. `LandingPage.tsx` (Persuade mode, full expression, replaces `.cs-*` hero)
  2. `DashboardPage.tsx` (Operate mode, quieter sibling, replaces today's Call
     Sheet Operate styling on one representative dense screen)
- **Phase 2 (future):** Roll the validated system out to the remaining 14
  Persuade-mode pages + `CheckoutPage`.
- **Phase 3 (future):** Roll the validated system out to the remaining 22
  Operate-member pages + 14 Operate-strategist/admin pages.
- **Phase 4 (future, separate brainstorming session):** New features. Explicitly
  not scoped here — see §8.

## 7. Page Inventory (for future phase planning, not built now)

**Persuade mode (`SiteHeader`/`SiteFooter`, currently `.cs-*` CSS):** Landing,
Pricing, HowItWorks, Services, WhyFreshlyForward, About, Contact, Faq,
ForwardFeed (list + detail), Authorization, Privacy, Terms, SignIn, SignUp.
Plus `CheckoutPage` (currently unlayoutted; bucketed with Persuade since it's
part of the pre-membership conversion funnel).

**Operate mode — member (`MemberLayout`):** Onboarding (+ 8 subcomponents),
Dashboard, CareerProfile, Membership, CareerSuccess, Timeline, Messages,
MemberOpportunities, OpportunityEngine, LinkedInOptimizer, MemberApplications,
WhyWeApplied, FoundingMember, FridayReports, MockInterview, Calendar,
Notifications, CommunicationPreferences, ActivityFeed, Interviews, Tools,
AchievementVault, Roadmap.

**Operate mode — strategist/admin (`StrategistLayout` or standalone):**
StrategistDashboard, StrategistMembers, StrategistMemberWorkspace,
StrategistOpportunities, StrategistOpportunityEngine, StrategistApplications,
StrategistFridayReports, AdminReportReview, BlogManagement, BlogPostEditor,
AdminDashboard, AdminMembers, AdminMemberDetail, FeatureEntitlements.

## 8. Explicitly Out of Scope

- **New product features.** Deferred to a dedicated brainstorming session after
  Phase 1 ships, per earlier agreement — designing features into a design
  language that doesn't exist yet guarantees rework.
- **Pixel-exact match to the reference mockup.** Directional inspiration only,
  per explicit user instruction.
- **Phases 2–4** as implementation work (they're named here for continuity, not
  built by the plan that follows this spec).

## 9. Accessibility & Testing

- WCAG 2.2 AA is the floor (org-wide standard), not merely "preserve existing
  affordances" — existing skip-link, `:focus-visible`, `aria-label`s on
  icon-only controls, and `prefers-reduced-motion` support must survive the
  new shadow/radius/motion additions, and new interactive components (pill
  buttons, the shared report card) must meet contrast and focus-visibility
  requirements on first implementation, not as a follow-up fix.
- Verification per change: `tsc && vite build` must pass clean, matching this
  session's existing discipline. No automated visual regression suite exists;
  manual before/after review remains the verification method for visual changes.

## 10. Open Items For Implementation-Time Decision

These are intentionally left flexible (directional inspiration, not spec):
exact serif typeface pick (Fraunces vs. Newsreader vs. alternative), exact
radius scale values, exact shadow values, exact pill-button padding/sizing.
