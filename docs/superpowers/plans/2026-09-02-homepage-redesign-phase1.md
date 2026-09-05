# Homepage Redesign — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for
> tracking.

**Goal:** Rebuild the public homepage (`LandingPage.tsx`) and the public nav (`PublicLayout.tsx`) to match the
Official Homepage Design North Star (`public/images/A63B5E0B-0AE1-4D9A-B05D-9C52403721C7.png`) as closely as
practical, per the approved spec's 10-section structure and 5 locked implementation decisions.

**Architecture:** This is a full visual rebuild of one page (`LandingPage.tsx`) plus a structural nav change
(`PublicLayout.tsx`). It reuses existing design tokens (`--navy`, `--color-primary-600` green, `--shadow`,
`--radius`, `font-display`/Fraunces, `font-mono`/Space Mono) and an existing proven "navy/green premium hero"
pattern (`ForwardScoreWidget.tsx`) rather than inventing a new visual system. No other page, no backend, no
Supabase schema, no auth, no membership/pricing data model changes. `docs/superpowers/specs/2026-08-28-concierge-editorial-redesign-design.md`
is not touched.

**Tech Stack:** React + TypeScript + Vite + Tailwind v4. Verification per task: `npm run build` (tsc + vite build)
must pass clean. New logic worth locking down (nav route coverage, Career Vault "Coming Soon" labeling, no
literal fake pricing/testimonial strings) gets a Vitest + RTL test; pure layout/graphics changes are verified by
build + the visual-comparison loop below, matching this repo's existing convention.

**Spec:** `docs/superpowers/specs/2026-09-02-homepage-design-north-star.md`

## Global Constraints

- Brand tokens unchanged: reuse `--navy` (`#071a31`), `--color-primary-600` (`#078a58`), `--shadow`, `--radius`
  from `src/index.css`. Do not introduce new brand colors. Reuse the existing green accent `#7ee4b6` /
  muted-navy-text `#bac8d6` pairing already established in `ForwardScoreWidget.tsx` for text-on-navy contrast.
- `font-display` (Fraunces) for headline-scale text, `font-mono` (Space Mono) for score digits/labels/eyebrow
  text, matching existing Concierge Editorial convention. No new fonts.
- `npm run build` must pass clean after every task.
- WCAG 2.2 AA is the floor: every interactive element needs visible focus states and sufficient contrast,
  including new elements placed on the dark navy hero background (`#bac8d6`-on-navy and white-on-navy already
  verified sufficient in `ForwardScoreWidget.tsx`; do not introduce new dark-on-dark or low-contrast text/icon
  pairs). Do not regress the existing skip-link/`:focus-visible`/`prefers-reduced-motion` support.
- **FreshFit/score-language constraint (carried over from `ForwardScoreWidget.tsx`'s hard requirement):** any
  FreshFit score shown on the homepage must never be captioned with "hiring probability," "salary
  potential"/"guaranteed salary," "employer," "human worth," or "objective prediction" language. It is a
  directional fit snapshot, same framing as the existing Forward Score.
- **No fabricated content, per spec:** no invented testimonials, user counts, ratings, employer logos, success
  percentages, awards, or pricing. No presenting Career Vault as live. No "Application Workspace" branding — use
  "Applications." These are enforced by tests in Task 8, not just code review.
- Every real route currently reachable from `PublicLayout.tsx`'s nav today (`/how-it-works`, `/career-compass`,
  `/services`, `/why-freshlyforward`, `/pricing`, `/forward-feed`, `/about`, `/signin`, `/signup`) must remain
  reachable somewhere under the new nav structure. Nothing gets orphaned.
- Scope is exactly: `src/components/PublicLayout.tsx`, `src/pages/LandingPage.tsx`, `src/index.css` (additive
  hero-only rules), and any new small presentational components this plan explicitly creates under
  `src/components/homepage/`. No other file changes belong in this plan.

## Visual-comparison loop (required acceptance mechanism, not optional polish)

This environment has a working local screenshot pipeline (already used and verified during the Opportunity Engine
2.0 visual review this session): Python + Playwright (Chromium already installed), driven against the real Vite
dev server (`npm run dev`). Every task below that touches visible layout ends with this loop, not just a build
check:

1. Ensure `npm run dev` is running, note the printed local URL.
2. Take a screenshot of the real `/` route (desktop viewport ~1440x900, and mobile ~390x844) with a short
   Playwright script (same pattern as `visual_review_capture.py` used in the Opportunity Engine 2.0 review —
   recreate a minimal version scoped to `/`, since that script was deleted after its own review; do not assume
   it still exists).
3. Load both the new screenshot and `public/images/A63B5E0B-0AE1-4D9A-B05D-9C52403721C7.png` and compare them
   directly, section by section, against the fidelity requirements in the spec (composition, navy/green balance,
   FreshFit centerpiece, career-path geometry, floating-card treatment, spacing, section rhythm).
4. Note concrete deltas (not vague "make it better" — e.g. "floating cards overlap the headline at this
   viewport," "green accent is a different shade than the reference," "career-path line is too thin/faint").
   Adjust code, re-screenshot, re-compare. Repeat until the section matches as closely as practical.
5. Save final accepted screenshots as review artifacts under
   `docs/superpowers/visual-review/2026-09-02-homepage-redesign-phase1/` (desktop + mobile, at minimum one after
   Task 3's hero and one full-page after Task 9's wrap-up), same convention as the Opportunity Engine 2.0 review.
6. Delete any temporary capture script afterward, same as before — it's tooling, not part of the app.

This loop is an explicit **Definition of Done** item for Tasks 2, 3, 4, and 9 below, not a nice-to-have.

---

### Task 1: Public nav overhaul

**Files:**
- Modify: `src/components/PublicLayout.tsx`
- Create: `src/components/PublicLayout.test.tsx` (this repo has no existing test for this file; nav route
  coverage is exactly the kind of logic worth locking down per Global Constraints)

**Interfaces:**
- Produces: same exported `SiteHeader`, `SiteFooter`, `Logo` — signatures unchanged, so no other file needs
  edits. Internal `navigation` array structure changes to support one dropdown ("Product").

- [ ] **Step 1: Write the failing test first**

Create `src/components/PublicLayout.test.tsx` covering:
- Top-level nav renders exactly: Product (as a dropdown trigger, not a direct link), How It Works, Career
  Compass, Pricing, Resources, Sign In.
- Opening the Product dropdown surfaces links to real capability pages (at minimum `/services` and
  `/why-freshlyforward` — the two that don't otherwise have a top-level slot).
- Every one of these hrefs exists somewhere in the rendered header or footer nav, logged-out:
  `/how-it-works`, `/career-compass`, `/services`, `/why-freshlyforward`, `/pricing`, `/forward-feed`, `/about`,
  `/signin`, `/signup`. (This is the "nothing gets orphaned" constraint, made concrete and testable.)
- Logged-in state still shows `Dashboard` + `Sign Out` in place of `Sign In`/`Get started`, matching current
  behavior (`useAuth()` mock with a `user` present).

- [ ] **Step 2: Run the test, confirm it fails** (component doesn't have a dropdown yet / labels don't match).

- [ ] **Step 3: Restructure the `navigation` data and add the Product dropdown**

Replace the flat `navigation` array with a structure that distinguishes direct links from the one dropdown:

```tsx
const productLinks = [
  ['/services', 'Services'],
  ['/why-freshlyforward', 'Why FreshlyForward'],
] as const

const primaryNav = [
  ['/how-it-works', 'How It Works'],
  ['/career-compass', 'Career Compass'],
  ['/pricing', 'Pricing'],
] as const

const resourcesLinks = [
  ['/forward-feed', 'The Forward Feed'],
  ['/about', 'About'],
] as const
```

Render order in `SiteHeader`: Product (dropdown, `productLinks`) → How It Works → Career Compass → Pricing →
Resources (dropdown, `resourcesLinks`) → Sign In / auth actions. Keep the existing mobile `nav-open` toggle
behavior; the dropdowns should collapse into the same mobile menu as plain stacked links on small screens
(simplest accessible option — do not build a separate mobile-only interaction pattern).

Use a plain button + conditional list for each dropdown (no new dependency) with `aria-expanded` and
`aria-haspopup="true"`, closing on outside click and on `Escape`, matching the existing mobile-menu keyboard
affordance already present in this file.

- [ ] **Step 4: Run the test, confirm it passes.**

- [ ] **Step 5: Verify the build**

Run: `npm run build`. Expected: clean.

- [ ] **Step 6: Visual-comparison loop**

Screenshot the header alone (top ~120px of `/`) at desktop and mobile widths. Compare against the North Star
image's nav bar treatment (dark navy bar, logo left, links center/right, filled-green primary CTA). Note: the
image's own literal nav items are NOT the target here — the approved nav list is — so compare *treatment*
(spacing, button styling, dropdown affordance) not literal copy.

- [ ] **Step 7: Commit**

```bash
git add src/components/PublicLayout.tsx src/components/PublicLayout.test.tsx
git commit -m "Restructure public nav: Product/Resources dropdowns, Career Compass promoted to top-level"
```

---

### Task 2: New homepage hero — structure, copy, and CTAs (no graphics yet)

**Files:**
- Modify: `src/pages/LandingPage.tsx` (hero section only)

**Interfaces:**
- Consumes: nothing new yet. Prepares the DOM structure Task 3 will layer graphics into.

- [ ] **Step 1: Replace the hero's copy/CTA column**

Headline: "Your Career Operating System for What's Next." with "Operating System" in the green accent color
(`text-[color:var(--color-primary-600)]` or equivalent), on a dark navy hero section
(`bg-[var(--navy)] text-white`, matching `ForwardScoreWidget.tsx`'s navy/white pairing rather than the current
white-background hero).

Subcopy: one to two sentences describing the connected system (direction + opportunities + assets + support) —
write new copy grounded in what the app actually does (Career Compass, Opportunity Engine, FreshFit, Applications,
human strategists), not the image's literal sentence.

Two CTAs: primary "Take Career Compass" → `/career-compass`, secondary "See How It Works" → `/how-it-works` (with
a play-style icon, reusing `lucide-react`'s `PlayCircle` or similar, matching the image's secondary-CTA
treatment).

Three short feature bullets under the CTAs (Personalized / AI-powered career intelligence / Human experts),
plain small text, muted-on-navy color (`#bac8d6`).

- [ ] **Step 2: Leave a clearly-marked placeholder for the graphical column**

```tsx
{/* Task 3: FreshFit centerpiece + career-path graphic + floating cards + human figure */}
<div className="relative hidden lg:block" aria-hidden="false">
  {/* placeholder */}
</div>
```

- [ ] **Step 3: Verify the build.** Run: `npm run build`. Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/pages/LandingPage.tsx
git commit -m "Rebuild homepage hero copy/CTAs on navy background (graphics in next task)"
```

---

### Task 3: Hero graphics — FreshFit centerpiece, career-path, floating cards, human figure

This is the highest-fidelity, highest-iteration task in this plan. Treat the steps below as a starting structure,
not a guaranteed one-shot match — the visual-comparison loop is how this task actually finishes.

**Files:**
- Modify: `src/pages/LandingPage.tsx` (hero graphical column)
- Create: `src/components/homepage/HeroFreshFitCenterpiece.tsx` (the circular score ring — a presentational,
  hand-authored sample score for marketing purposes only, clearly not wired to any real member's data; add a
  code comment saying so explicitly, matching this repo's existing sample-data-labeling convention from
  `FridayReportCard`'s `sampleReport`)
- Create: `src/components/homepage/HeroFloatingCard.tsx` (small reusable floating-card shell: rounded corners,
  `bg-[var(--navy-soft)]` or similar slightly-lighter-than-navy fill, shadow, absolutely positioned by the parent)
- Create: `src/components/homepage/HeroCareerPath.tsx` (an inline SVG path — a simple bezier curve with a
  gradient stroke and a small circle/arrow marker at the end — not a literal recreation of the image's exact
  curve, but the same "upward, winding, glowing" character)

**Interfaces:**
- `HeroFreshFitCenterpiece`: `{ score: number; label: string }` props, no data fetching.
- `HeroFloatingCard`: `{ className?: string; children: ReactNode }` — a positioning-agnostic shell; the parent
  (`LandingPage.tsx`) supplies `absolute top-[...] left-[...]`-style Tailwind classes per card via `className`.
- `HeroCareerPath`: no props needed for Phase 1 (static path); accepts `className` for sizing.

- [ ] **Step 1: Build `HeroFreshFitCenterpiece`**

Circular ring (reuse the same SVG-ring-gauge approach already implemented in `src/components/CircularProgress.tsx`
— check whether it can be reused directly with a larger `size` prop before writing a new one; only build a new
component if `CircularProgress` can't reasonably scale to hero size/styling). Center text: sample score (e.g.
`82`) + "Strong Match" wording matching FreshFit's existing tier language from `opportunityEngineTiers.ts` — do
not invent new tier labels for the homepage.

- [ ] **Step 2: Build `HeroFloatingCard` and 4-6 sample cards**

Populate with realistic-but-labeled-as-illustrative sample content mirroring the image's categories (Top
Opportunity, Career Vault asset count, Resume Strength, Skill Gap, Goal Progress, Next Milestone) — reusing real
copy patterns from the actual features (e.g. Opportunity Engine's tier language, `useTopJobMatch`'s shape) rather
than inventing unrelated concepts. Each card gets a code comment noting it's illustrative marketing content, not
live data.

- [ ] **Step 3: Build `HeroCareerPath`**

Simple SVG `<path>` with a linear or radial gradient stroke from navy toward the green accent, an arrowhead or
small circle marker at the top end. Absolutely positioned behind/around the floating cards via z-index.

- [ ] **Step 4: Add a small human-figure element**

A simple silhouette (inline SVG or a single small illustration asset) positioned along the lower part of the
path. Keep it small and subtle per the spec ("subtle human figure/illustration"), not a literal photo.

- [ ] **Step 5: Compose all of it into the hero's graphical column in `LandingPage.tsx`**, replacing the Task 2
placeholder. Use `absolute`/`relative` positioning within a fixed-aspect-ratio container so it degrades
predictably at different viewport widths; hide or simplify on mobile (`hidden lg:block`, already scaffolded in
Task 2) rather than attempting the full composition on narrow screens.

- [ ] **Step 6: Verify the build.** Run: `npm run build`. Expected: clean.

- [ ] **Step 7: Visual-comparison loop (required, not optional)**

Full hero screenshot, desktop width. Compare directly against the North Star image's hero region. Iterate on
card positions, path curvature, ring size, and color balance until it's a close practical match per the fidelity
requirements. Also screenshot mobile width and confirm the simplified/hidden graphical treatment still reads as
a coherent, uncluttered hero (not a broken half-rendered graphic).

- [ ] **Step 8: Commit**

```bash
git add src/pages/LandingPage.tsx src/components/homepage/
git commit -m "Add hero FreshFit centerpiece, career-path graphic, floating cards, and human figure"
```

- [ ] **Step 9: MANDATORY VISUAL APPROVAL CHECKPOINT -- STOP HERE, do not proceed to Task 4**

Task 3 establishes the visual-system foundation (navy/green treatment, FreshFit centerpiece, career-path
graphics, floating cards, human figure, responsive behavior, initial motion) that every remaining section builds
on. Getting this wrong and propagating it through the rest of the page is expensive to unwind, so this plan
requires owner sign-off here before continuing:

1. Run the full required tests and `npm run build` (TypeScript + build verification).
2. Capture browser screenshots at minimum for desktop, tablet, and mobile viewports of the hero (Task 1's nav
   plus Task 2/3's hero, in context on the real `/` route).
3. Compare them directly against `public/images/A63B5E0B-0AE1-4D9A-B05D-9C52403721C7.png`.
4. Report the local commit SHAs for Tasks 1-3, show the three screenshots, and **stop** -- do not begin Task 4
   until the owner reviews and approves the hero.

---

### Task 4: "How FreshlyForward Works" section

**Files:**
- Modify: `src/pages/LandingPage.tsx`

- [ ] **Step 1:** Build the 5-step connected flow (Discover / Build / Find / Understand / Move Forward), each
with an icon (reuse `lucide-react` icons already used elsewhere: e.g. `Compass`, `FolderOpen`, `Search`,
`Target`, `Rocket`), a short caption grounded in what each real capability does (Career Compass, Career Vault
[mark as "Coming Soon" here too if referenced], Opportunity Engine, FreshFit, Applications + strategist support),
connected by a simple line (CSS border/background, not necessarily SVG). CTA button below: "Start Your Career
Journey" → `/career-compass` (the natural first real step).

- [ ] **Step 2: Verify the build.** Run: `npm run build`.

- [ ] **Step 3: Visual-comparison loop.** Screenshot this section, compare rhythm/spacing/icon treatment against
the reference image's equivalent section.

- [ ] **Step 4: Commit**

```bash
git add src/pages/LandingPage.tsx
git commit -m "Add How FreshlyForward Works section to homepage"
```

---

### Task 5: Flagship feature showcase + supporting capabilities

**Files:**
- Modify: `src/pages/LandingPage.tsx`
- Create: `src/pages/LandingPage.test.tsx` (first test for this file — needed to enforce the Career Vault
  "Coming Soon" and "Applications not Application Workspace" constraints per Global Constraints, not just
  visual review)

- [ ] **Step 1: Write failing tests**

Assert:
- The text "Application Workspace" never appears anywhere on the page; "Applications" does.
- Wherever Career Vault is mentioned, a visible "Coming Soon" label is present adjacent to it, and there is no
  link anywhere on the page pointing at `/career-vault` (mirroring the exact pattern already proven in
  `DashboardPage.test.tsx`'s equivalent assertion).
- No literal fake pricing strings appear on the page yet at this point in the plan (this task doesn't touch
  pricing, so this should trivially pass — it's here so Task 7 can't accidentally reintroduce them without
  breaking an existing test).

- [ ] **Step 2: Build the 3 flagship cards** (dark navy cards, matching hero treatment): Opportunity Engine
(real, link to `/opportunity-engine` behind sign-in messaging or `/signup` for logged-out visitors — check how
other member-only feature mentions on this page currently handle logged-out CTAs and match that pattern),
FreshFit (real, describe the scoring concept plainly), Career Vault (**"Coming Soon"** badge, no route/link,
illustrative description only).

- [ ] **Step 3: Build the 3 supporting-capability cards**: Career Compass (real, `/career-compass`), Applications
(real, described using the truthful name, no direct public link since it's member-only — describe the capability,
CTA drives to `/signup` or `/career-compass` same as other member-only mentions), Human Strategists (real,
consistent with the existing Human Support section content built in Task 6 — do not duplicate exact copy, cross
reference instead).

- [ ] **Step 4: Run tests, confirm pass. Run `npm run build`, confirm clean.**

- [ ] **Step 5: Visual-comparison loop.** Screenshot this section, compare card density/treatment against
the reference image's "Powerful tools" section.

- [ ] **Step 6: Commit**

```bash
git add src/pages/LandingPage.tsx src/pages/LandingPage.test.tsx
git commit -m "Add flagship feature showcase and supporting capabilities section"
```

---

### Task 6: Human Support section

**Files:**
- Modify: `src/pages/LandingPage.tsx`
- Modify: `src/pages/LandingPage.test.tsx`

- [ ] **Step 1: Extend the test** to assert no testimonial-shaped content (a quote attributed to a named person)
appears anywhere on the page, and no star-rating markup/graphic appears anywhere on the page.

- [ ] **Step 2:** Build the warmer-toned section: photo (reuse an existing real photo asset already in
`public/images/` if one fits — check `founder-headshot.jpg`/`headshot.png` first rather than sourcing anything
new; if neither fits the "two people in conversation" framing, use a single warm portrait instead of inventing a
stock-photo-style scene), 3-4 real capability bullets (career strategy/planning, resume & application feedback,
interview prep, next steps/negotiation — these match real strategist-support capabilities already described
elsewhere in the app, e.g. `CareerSuccessPage.tsx`'s feature list), CTA "See How Human Support Works" →
an appropriate real page (check whether `/services` or `/why-freshlyforward` already covers this content before
deciding the CTA target — do not invent a new route).

- [ ] **Step 3: Run tests, confirm pass. Run `npm run build`.**

- [ ] **Step 4: Visual-comparison loop.**

- [ ] **Step 5: Commit**

```bash
git add src/pages/LandingPage.tsx src/pages/LandingPage.test.tsx
git commit -m "Add Human Support section to homepage (no fabricated testimonial)"
```

---

### Task 7: "Why FreshlyForward?" comparison section

**Files:**
- Modify: `src/pages/LandingPage.tsx`

- [ ] **Step 1:** Attempt a faithful reproduction first -- this is the default approach, not simplification.
Build the side-by-side "Traditional Job Search" (fragmented, list of pain points) vs. "FreshlyForward"
(connected system: Career Compass, Career Vault [Coming Soon], Opportunity Engine, FreshFit, Applications, human
strategists) contrast using lightweight CSS/SVG/components, genuinely attempting to match the image's node-graph
illustration style (scattered/tangled nodes on the left, connected nodes on the right, "VS" badge between).

- [ ] **Step 2: Visual-comparison loop on this section specifically**, before deciding whether to simplify.
Screenshot it, compare against the reference. Only fall back to a simpler visual metaphor (e.g. scattered icons
vs. connected icons in a plain grid) if the faithful version demonstrably harms clarity, responsive behavior,
accessibility, or performance -- not merely because the faithful version is more effort. If simplifying, preserve
the same visual idea (fragmented tools -> connected system) and note in a code comment why the simpler version
was chosen over the faithful one.

- [ ] **Step 3: Run `npm run build`.**

- [ ] **Step 4: Commit**

```bash
git add src/pages/LandingPage.tsx
git commit -m "Add Why FreshlyForward comparison section to homepage"
```

---

### Task 8: Pricing section (real data only)

**Files:**
- Modify: `src/pages/LandingPage.tsx`
- Modify: `src/pages/LandingPage.test.tsx`

**Interfaces:**
- Consumes: `membership_plans` table via the same Supabase query pattern already used in `PricingPage.tsx` (fetch
  plans, render `formatCurrency(plan.price_cents)`). Do not duplicate query logic if it can reasonably be
  extracted into a shared hook — check `PricingPage.tsx`'s fetch logic first; if extracting a shared
  `useMembershipPlans` hook is a clean, low-risk refactor, do it here so both pages share one source of truth,
  otherwise duplicate the minimal fetch rather than risk destabilizing the existing `PricingPage.tsx`.

- [ ] **Step 1: Write failing tests** asserting: none of "Starter", "Strategist+", "$19", "Kickstarter" appear on
the page; real plan names/prices from a mocked `membership_plans` response do appear.

- [ ] **Step 2:** Build the pricing cards visually matching the image's card treatment (rounded, shadow, "Most
Popular" style badge on whichever real plan is marked as such if the data supports it, otherwise omit the badge
rather than inventing which plan is "most popular") but sourced entirely from the real fetched plans. If real
data supports a one-time/founding offer (check `FoundingMemberPage.tsx` — "Lifetime Founding Pricing" already
exists as a real concept), it is fine to reflect that; do not invent a "Kickstarter Special" if no such real offer
exists in the data.

- [ ] **Step 3: Run tests, confirm pass. Run `npm run build`.**

- [ ] **Step 4: Visual-comparison loop.**

- [ ] **Step 5: Commit**

```bash
git add src/pages/LandingPage.tsx src/pages/LandingPage.test.tsx
git commit -m "Add real-data-driven pricing section to homepage (no fabricated tiers/prices)"
```

---

### Task 9: FAQ + Final CTA band

**Files:**
- Modify: `src/pages/LandingPage.tsx`

- [ ] **Step 1:** Build a simple FAQ accordion (check whether an existing accordion pattern already exists
elsewhere in the app, e.g. `PricingPage.tsx`'s "Can I change plans?" block or any `<details>`-based pattern,
before building a new one) with real questions about FreshlyForward, Career Compass, Opportunity Engine, FreshFit,
plans/cancellation, and data privacy — answers grounded in real product behavior, not invented specifics.

- [ ] **Step 2:** Build the final CTA band matching the hero's navy/green treatment: "Your next move starts
here.", both CTAs repeated, small decorative career-path graphic (can reuse `HeroCareerPath` from Task 3 at a
smaller scale rather than building a second bespoke graphic).

- [ ] **Step 3: Run `npm run build`.**

- [ ] **Step 4: Full-page visual-comparison loop (final acceptance pass)**

Screenshot the entire page top-to-bottom, desktop and mobile, alongside the North Star image. Walk every fidelity
requirement in the spec one more time, end to end, not just section-by-section as before — check the whole
page's rhythm together. Save final accepted screenshots to
`docs/superpowers/visual-review/2026-09-02-homepage-redesign-phase1/` (e.g. `01-full-page-desktop.png`,
`02-full-page-mobile.png`, plus any section close-ups worth keeping). Delete any temporary capture script
afterward.

- [ ] **Step 5: Commit**

```bash
git add src/pages/LandingPage.tsx docs/superpowers/visual-review/2026-09-02-homepage-redesign-phase1/
git commit -m "Add FAQ and final CTA band; complete homepage redesign Phase 1 visual-comparison pass"
```

---

### Task 10: Full-repo verification and wrap-up

**Files:** none (verification only)

- [ ] **Step 1: Run the full build.** Run: `npm run build`. Expected: clean.
- [ ] **Step 2: Run the full test suite**, excluding `.worktrees` per this repo's established convention (see
  earlier session history — an unscoped run previously picked up unrelated pre-existing worktree failures).
  Expected: all new tests from Tasks 1, 5, 6, and 8 pass; no regressions elsewhere.
- [ ] **Step 3: Full-repo grep for scope leakage.** Run a search for the new component names/imports
  (`HeroFreshFitCenterpiece`, `HeroFloatingCard`, `HeroCareerPath`) — expected matches only in
  `src/components/homepage/` and `src/pages/LandingPage.tsx`.
- [ ] **Step 4: Confirm no fabricated-content strings anywhere on the page** — re-run the Task 5/6/8 assertions
  as a final combined check, or add one consolidated `LandingPage.test.tsx` test that checks all of them together
  as a named "no fabricated content" regression guard.
- [ ] **Step 5: Do not push.** Report final HEAD SHA and the full list of commits made under this plan for
  owner review, matching the pattern already used for the Opportunity Engine 2.0 Phase 1 and homepage spec work
  this session.
