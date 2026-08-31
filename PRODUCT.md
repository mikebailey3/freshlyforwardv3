# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

[INFERRED — probe round timed out with no response, not confirmed by the user]
Primary users are mid-to-senior career professionals actively job-hunting who are
frustrated with high-volume, mass-apply or AI-driven job search tools and want a
real, dedicated person managing the details of their search — strategy, hand-tailored
applications, interview preparation, and ongoing decision support — for a recurring
monthly fee. The product implies enough disposable income to pay monthly for
concierge-level service rather than self-serve job boards.

Open/unconfirmed: whether the segment narrows further (e.g. executives only,
career-changers, laid-off vs. currently-employed-but-searching, specific industries).

## Product Purpose

FreshlyForward is a human-led career-search concierge service: a dedicated strategist
researches roles for fit, hand-crafts applications one at a time, sends a weekly
("every Friday") progress report, and coaches interviews and offer decisions. Success
for the user is landing a well-fit role with less personal time/effort spent on the
mechanical parts of the search, and with a trusted person accountable for the work
done on their behalf.

## Positioning

[INFERRED, not confirmed] The stated, and clearest, differentiator in the existing
copy is: **100% human-led, one dedicated strategist per client, hand-crafted
applications, explicitly not AI mass-applying, no long-term contract (pause anytime).**
This is positioned directly against "mass application services" (the site's own
`contrast-section` names this comparison explicitly). Whether this is still the
intended primary wedge, or whether it has shifted toward something else (speed,
specific industries, measurable outcomes, price), is unconfirmed.

## Operating Context

- Public marketing site (landing, pricing, how-it-works, services, why-freshlyforward,
  about, contact, FAQ, "Forward Feed" blog) plus an authenticated member area
  (dashboard, career profile, membership, timeline, messages, opportunities,
  opportunity engine, LinkedIn optimizer, applications, mock interviews, calendar,
  notifications, achievement vault, roadmap) and a separate strategist/admin backend
  (member workspace, opportunity engine, applications review, Friday reports review,
  blog management, feature entitlements).
- Membership plans and feature-gating (`ProtectedRoute` with `feature`/`requiredPlan`
  props) are data-driven from Supabase (`membership_plans` table), not hardcoded —
  pricing/plan copy can change without a redesign.
- Weekly "Friday reports" are a named, recurring ritual central to the service's
  trust model (visibility into what the strategist actually did).

## Capabilities and Constraints

- Stack: React + Vite + TypeScript + Tailwind v4 + Supabase (auth + data). Existing
  codebase already answers the stack question; no greenfield decision needed here.
- Role-based access: `strategist`, `admin`, and implicit `member` roles gate distinct
  route trees.
- No native app; web only, responsive (existing breakpoints at 1024/860/600/360px).

## Brand Commitments

- Name: FreshlyForward. Founder: Mike Bailey (real headshot used on homepage and
  About page — this is a real person's photo and identity, not a stock/placeholder
  asset; treat as binding).
- Existing voice: direct, contrast-driven ("no bots, no shortcuts"; "no spray-and-pray
  search"), concierge/premium-but-approachable tone — not corporate-SaaS voice.
- Existing visual identity (navy `#071a31` + brand green `#078a58`, organic
  asymmetric border-radius shapes, editorial serif-adjacent headings via Manrope):
  incumbent, not yet confirmed as binding or up for replacement. [Redesign scope —
  preserve vs. replace — is a new-work decision, not answered here.]

## Evidence on Hand

- **No third-party testimonials, case studies, client quotes, logos, or placement
  statistics exist anywhere in the codebase.** The only "social proof" is a founder
  quote about his own service. This was flagged in a prior critique
  (`.impeccable/critique/` not yet written) as a P1 gap.
- Confirmed absence, not an oversight to fill: future design work must not fabricate
  testimonials, client names, outcome numbers, or press mentions. If real evidence
  exists off-repo, it was not surfaced when asked (question round timed out).

## Product Principles

1. The service's credibility rests on "a real human did this specific thing for you,"
   not on volume or automation — every design decision should reinforce visible,
   attributable human effort (the Friday report, the named strategist) over generic
   SaaS polish.
2. Explicitly anti-mass-market: fewer, better-chosen actions (roles, applications,
   words) beats more content — the copy already encodes this ("one carefully chosen
   opportunity is worth more than a hundred generic submissions").
3. Trust and flexibility over lock-in: "no contracts, pause anytime" is a repeated
   claim; design should keep this visible near commitment points (pricing, signup),
   not just in a footnote.
4. Two very different audiences share one design system: prospective clients
   (Persuade mode, public site) and paying members/strategists doing real work
   (Operate mode, dashboards) — a redesign of the public site must not assume it also
   redesigns the operate-mode member/strategist tooling.

## Accessibility & Inclusion

No product-specific requirement beyond general web accessibility was established
(no confirmed WCAG target level). Existing implementation already includes a skip
link, `:focus-visible` styling, `aria-label`s on icon-only controls, and
`prefers-reduced-motion` support — treat these as an existing floor to preserve, not
a ceiling.
