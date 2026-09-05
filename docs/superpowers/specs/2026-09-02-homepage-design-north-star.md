# Homepage Design North Star (Spec)

**Status:** Draft — awaiting owner approval. No application code has been touched for this spec.
**Date:** 2026-09-02
**Scope:** Public homepage (`/`) visual redesign only. This document does not authorize implementation.

## Official Homepage Design North Star

> **`public/images/A63B5E0B-0AE1-4D9A-B05D-9C52403721C7.png`** is the **Official Homepage Design North Star**.

This image is the **visual acceptance target** for the homepage redesign, not loose inspiration. Implementation
must get as close as practical to its composition, visual hierarchy, graphical density, navy/green balance,
typography scale, spacing, FreshFit presentation, career-path geometry, floating-card treatment, rounded-card
styling, shadow/depth treatment, section rhythm, and product/human balance.

The image contains **illustrative UI content**. Per explicit instruction, it is a visual reference only. Concrete
literal content shown inside it (copy, numbers, names, testimonials, prices) is **not** to be copied into the real
product — see "Explicit content constraints" below, and "Known conflicts" for specific items already identified.

## Approved homepage direction

- Public-homepage-first: this page is the primary top-of-funnel surface, not an afterthought.
- Positioning: a premium "Career Operating System."
- A 50/50 blend of career intelligence (data/scoring/tools) and human career journey (strategist support, human
  warmth) — neither should visually dominate the other.
- Rich, layered graphical hero (not a laptop-mockup hero).
- FreshFit score as the hero's visual centerpiece.
- An upward career-path graphic woven through floating UI cards in the hero.
- A subtle human figure/illustration present in the hero.
- Gentle, continuous motion (implementation detail, deferred to the build phase — not addressed by this spec).
- Premium navy + green visual system.
- Graphical but still professional — not garish, not a generic SaaS template.
- Primary CTA: **Take Career Compass**. Secondary CTA: **See How It Works**.

## Approved homepage structure

1. Navigation — Product / How It Works / Career Compass / Pricing / Resources / Sign In
2. Hero — "Your Career Operating System for What's Next." + FreshFit centerpiece + career-path graphics + floating
   product cards + subtle human figure + Take Career Compass + See How It Works
3. How FreshlyForward Works — Discover / Build / Find / Understand / Move Forward — CTA: Start Your Career Journey
4. Flagship feature showcase — Opportunity Engine / FreshFit / Career Vault
5. Supporting capabilities — Career Compass / Application Workspace / Human Strategists
6. Human Support — warmer visual treatment — CTA: See How Human Support Works
7. Why FreshlyForward — "One connected system for your entire career move." — fragmented traditional tools vs.
   FreshlyForward's connected ecosystem, contrasted visually
8. Pricing — real existing plans/prices only, visual redesign only, no Forward Credits yet
9. FAQ
10. Final CTA — "Your next move starts here." — Take Career Compass / See How It Works

This structure is the owner's explicit decision, captured here as agreed. See "Known conflicts" for where it
diverges from what the reference image itself shows, and from what exists in the app today.

## What the reference image actually shows

Recorded here so "match the reference" has a concrete, shared description to build against, not just the raw file.

- **Nav bar** (dark navy): logo, `Product / How It Works / Pricing / Resources / For Organizations`, then
  `Sign In` (outline) + `Take Career Compass` (filled green).
- **Hero** (dark navy → gradient): headline "Your Career Operating System for What's Next." (green highlight on
  "Operating System"), subcopy, two CTAs, three small feature bullets (Personalized / AI-powered / Human experts).
  Right side: a large circular **FreshFit Score** ring (82, "Strong Match") as the visual centerpiece, surrounded by
  floating cards — Top Opportunity, Career Vault (23 Assets), Resume Strength, Skill Gap, Goal Progress,
  Application in Review, Next Milestone, Strategist Support (with a small avatar) — connected by a glowing
  upward career-path line that a small human silhouette walks along, ending in an upward arrow.
- **"How FreshlyForward Works"**: 5 connected steps (Discover / Build / Find / Understand / Move Forward) on a
  wavy line, each with an icon and one-line caption, CTA button below.
- **"Powerful tools. One connected system."**: 3 large flagship dark cards (Opportunity Engine 2.0, FreshFit,
  Career Vault) each showing realistic-looking mocked UI, then 3 smaller supporting-capability cards (Career
  Compass, Application Workspace, Human Strategists).
- **Human-support section**: warm photo of two people in conversation, 4 icon bullets, CTA, and a floating
  5-star testimonial card ("Alex R., Product Manager").
- **"Why FreshlyForward?"**: side-by-side "Traditional Job Search" (red X's, tangled graph) vs. "FreshlyForward"
  (green checks, connected node graph), "VS" badge between them.
- **Pricing**: 3 cards — Starter $19/mo, Professional $39/mo ("Most Popular"), Strategist+ $99/mo — plus a
  separate "Kickstarter Special" one-time-offer callout.
- **FAQ**: two-column accordion list.
- **Final CTA band**: matches the hero's dark navy/green treatment, restates both CTAs, small decorative
  career-path graphic.

## Explicit content constraints

The reference image is a **visual** reference. The following literal content inside it must **not** be carried
into the real product:

- Do not copy the "Alex R., Product Manager" testimonial, or any other testimonial-shaped content, verbatim or
  paraphrased, unless backed by a real, owner-approved testimonial.
- Do not invent user counts, success metrics, or outcome statistics not already verified elsewhere in the app.
- Do not invent employer/customer relationships or logos.
- Do not invent pricing. Do not use "Starter / Professional / Strategist+" or "$19 / $39 / $99" or "Kickstarter
  Special" — none of these are real.
- Do not present concept-only or coming-soon functionality as currently live.

## Known conflicts (image / approved notes vs. real app) — needs owner decision before implementation

1. **Career Vault is not live.** `DashboardPage.tsx` currently renders an explicit
   `<CareerVaultPlaceholderCard />` with an inline comment: "no `career_wins` table, no `/career-vault` route, and
   no Career Vault [feature]" — covered by a passing test asserting no link anywhere points at `/career-vault`.
   The reference image presents Career Vault as a fully populated flagship feature ("23 Assets," resume/cert
   list). **This is the most significant conflict.** The homepage cannot present Career Vault as live without
   violating "do not advertise concept-only functionality as live." Options for the owner to choose between:
   - Show Career Vault in the flagship showcase, explicitly labeled "coming soon."
   - Substitute the real, currently-live **Achievement Vault** feature (`/achievement-vault`, gated behind the
     `career-concierge` plan) in that flagship slot instead.
   - Omit a third flagship card entirely for now.
2. **Real pricing is data-driven, not hardcoded.** `PricingPage.tsx` and `MembershipPage.tsx` both fetch plans
   live from a `membership_plans` Supabase table. The only real plan slugs found in code are `career-growth`
   ("Career Growth") and `career-concierge` ("Career Concierge") — two plans, not three, and neither named
   "Starter," "Professional," or "Strategist+." Actual `price_cents` values live in the database, not in source,
   so this spec cannot state real dollar amounts — implementation must render whatever the real
   `membership_plans` table actually contains, matching the reference image's *visual card treatment* only.
3. **Nav structure mismatch, three-way.** The reference image's nav ("Product / How It Works / Pricing /
   Resources / For Organizations") does not match either the owner's approved nav list ("Product / How It Works /
   Career Compass / Pricing / Resources / Sign In") or the real current public nav in
   `src/components/PublicLayout.tsx` ("How It Works / Free Assessment / Services / Why FreshlyForward / Pricing /
   The Forward Feed / About"). Notably, none of "Product," "Resources," or "For Organizations" exist as real
   routes today, and the real Career Compass entry point is currently labeled "Free Assessment." Changing the nav
   to the approved list is a **structural** change (adding/removing/renaming real nav items and routes), not a
   pure visual reskin — flagging so it isn't implemented by accident under a "visual redesign only" assumption.
4. **"Application Workspace" branding is unverified.** Not yet confirmed against a real page/feature name in this
   codebase. Needs a quick verification pass before implementation treats it as an existing capability name.
5. **Confirmed real and safe to reference as live:** Opportunity Engine (2.0, freshly redesigned), FreshFit
   scoring, Career Compass (`/career-compass`), direct strategist messaging/Human Strategists.

## Fidelity requirements (acceptance criteria)

Implementation should be judged against how closely it achieves, relative to the North Star image:

- Overall composition and visual hierarchy
- Navy/green palette balance
- Layered graphical hero, non-laptop-centered
- FreshFit centerpiece treatment
- Career-path visual geometry
- Floating information card treatment, rounded corners, shadow/depth
- Typography scale and spacing rhythm
- Section-to-section rhythm across the full page
- Product-density vs. human-warmth balance per section

## Explicit non-goals for this spec

- No homepage code implementation yet.
- No changes to any existing application functionality, route, or component.
- No changes to `docs/superpowers/specs/2026-08-28-concierge-editorial-redesign-design.md` — that spec remains
  the source of truth for the rest of the already-migrated Persuade-mode pages; this document is homepage-only
  and does not supersede it.

## Locked implementation decisions (owner-approved 2026-09-02)

Spec is **APPROVED**. The 4 conflicts above are resolved as follows -- these are binding for implementation:

1. **Career Vault:** keep it in the flagship showcase (it's part of the approved product direction), but it must
   be clearly labeled **"Coming Soon"** and must not imply members can access it today.
2. **Pricing:** ignore the image's literal pricing entirely (no Starter/Professional/Strategist+, no $19/$39/$99,
   no Kickstarter Special unless real product data explicitly supports one). Use only the real plans/prices
   already backed by the `membership_plans` table, rendered the same way `PricingPage.tsx`/`MembershipPage.tsx`
   already fetch them. Visual redesign of the pricing cards only -- the data source does not change.
3. **Navigation:** approved to change, including real route/nav structure (not visual-only). Final nav:
   **Product** (dropdown: relevant FreshlyForward capabilities) / **How It Works** / **Career Compass** /
   **Pricing** / **Resources** / **Sign In**. Do not copy the image's nav literally. Do not keep the current
   `PublicLayout.tsx` nav merely because it already exists -- but every real route it currently exposes
   (`/how-it-works`, `/career-compass`, `/services`, `/why-freshlyforward`, `/pricing`, `/forward-feed`, `/about`,
   `/signin`, `/signup`) must still be reachable somewhere under the new nav (most naturally, several become
   "Product" dropdown entries or move to a footer/Resources grouping) -- this is a navigation redesign, not a
   route deletion.
4. **"Application Workspace":** confirmed real matching capability exists under the truthful current name
   **"Applications"** -- live route `/applications` (see `src/components/MemberLayout.tsx`), backed by real
   `APPLICATION_STATUSES` tracking and strategist-side tooling (`StrategistApplicationsPage.tsx`). Use
   **"Applications"**, not "Application Workspace", anywhere this capability is referenced on the homepage.
5. **Testimonials / social proof:** do not use the image's testimonial. Do not invent replacement testimonials,
   user counts, ratings, employer logos, success percentages, or awards, in any form. Credibility on this page is
   established through product presentation, the "How FreshlyForward Works" flow, the connected-system
   differentiation section, real capabilities, and human strategist support -- not claimed social proof.

## Next step

Implementation planning. See `docs/superpowers/plans/2026-09-02-homepage-redesign-phase1.md`.
