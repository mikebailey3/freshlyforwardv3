# FreshlyForward Redesign — Sub-Project 2: Homepage

## Context

`C:\Users\c0b0sty.s02638\Documents\Redesign_Project.txt` is the full-site visual
redesign brief: a premium dark navy/green "career performance platform"
identity inspired by Hudl (platform credibility) and TrophyCoach (personalized
focus). Sub-Project 1 (`docs/superpowers/specs/2026-09-05-redesign-subproject1-design-system-foundation-design.md`,
complete, merged to `main`) delivered the token system, primitives, and an
all-dark migration of every existing page's colors — explicitly **without**
touching any page's layout, copy, or content-specific components. The owner's
review of that work correctly called out that the homepage "still just looks
like we changed the colors" — that was Sub-Project 1's intended scope. This
spec is Sub-Project 2: the actual homepage redesign.

**Reference assets consulted for this spec:**
- `Redesign_Project.txt` — full section-by-section content brief.
- `north-star-reference.png` (pulled from the unmerged `homepage-redesign-phase1`
  branch, `docs/superpowers/visual-review/2026-09-04-hero-redesign/`) — the
  supplied visual target the brief points to.
- Hudl/TrophyCoach directional design analysis (synthesized from established
  brand knowledge — **live screenshots of both sites could not be captured in
  this environment**; Playwright's browser runtime failed to launch and no
  alternate engine was installed. Treat the Hudl/TrophyCoach guidance below as
  directional, not a verified pixel reference. Flag to the owner if a later
  environment can capture real screenshots for a sanity check before final
  polish.)
- Current `src/pages/LandingPage.tsx` and its supporting components, read in
  full.

## A resolved conflict: product positioning

The current `main` homepage copy is a **different product story** than the
brief. It's the "Concierge Editorial" positioning (`docs/superpowers/specs/2026-08-28-concierge-editorial-redesign-design.md`):
a human-led service ("one real strategist searches, applies, and reports
back") that explicitly rejects the self-serve/AI framing ("No AI mass
applications. No spray-and-pray search."). The brief describes the opposite:
a self-serve AI platform — FreshFit, Opportunity Engine, Career Vault, Career
Compass — where strategists support the user rather than act on their behalf.

**Decision (owner-approved):** Sub-Project 2 replaces the Concierge Editorial
homepage copy and narrative with the brief's self-serve "career operating
system" story. This is a full content/positioning replacement on this page,
not an additive change. The Concierge Editorial sections (`manifest`,
`contrast-section` "No AI mass applications", `cs-schedule-section` concierge
scenes, `service-preview` strategist-does-it-for-you framing) are removed from
the homepage and superseded by the sections defined below. Other pages that
still use concierge-service language (e.g. `/how-it-works`, `/services`) are
**out of scope** for this sub-project — the brief lists `/how-it-works` as
Sub-Project 6. Flag but do not silently fix the resulting temporary narrative
inconsistency between the homepage and those pages; that inconsistency is
expected until later sub-projects land, per the brief's own execution order.

## Terminology mapping (brief → real codebase feature)

The brief uses idealized feature names. Every homepage claim must point at a
real route/feature — do not invent product claims. Use this mapping:

| Brief name | Real feature | Real route |
|---|---|---|
| Career Operating System | (marketing framing only — no dedicated route) | — |
| FreshFit / FreshFit Score | `src/lib/freshFitScore/` | surfaced inside Opportunity Engine, not a standalone page |
| Opportunity Engine | `OpportunityEnginePage.tsx` | `/opportunity-engine` (member-only) |
| Career Vault | `AchievementVaultPage.tsx` (nav label "Achievement Vault") | `/achievement-vault` (member-only, gated by `career-concierge` plan) |
| Forward Profile | `CareerProfilePage.tsx` + `ForwardDnaPage.tsx` (the brief's "identity layer" is split across these two in the real app) | `/career-profile`, `/forward-dna` (member-only) |
| Forward Score | `src/lib/forwardScore/` | surfaced on `/dashboard`, not a standalone page |
| Career Compass | `CareerCompassIntroPage.tsx` | `/career-compass` (**public**, works pre-signup) |
| ForwardOS Dashboard | `DashboardPage.tsx` | `/dashboard` (member-only) |
| "Take Career Compass" CTA | real, public, no auth required | `/career-compass` |

Public homepage CTAs may link to `/career-compass` (public) and `/signup`
directly. Any homepage visual claiming to show Opportunity Engine, Career
Vault, Forward DNA, or the Dashboard **must be labeled as a sample/preview**
(same convention Sub-Project 1 preserved elsewhere, e.g. `FridayReportCard
isSample`), since those are gated behind auth and the visual is necessarily a
mockup, not a live embed.

**Do not fabricate:** the brief's "TRUSTED BY FORWARD THINKERS" logo row
(Amazon, Google, Microsoft, Deloitte, Accenture, Uber) and Section 9's
testimonial quotes are invented example content with no basis in this
project — FreshlyForward has no such customers on record. **Omit both from
this sub-project.** If real testimonials or partner logos exist, the owner
must supply them; do not placeholder-fabricate names, quotes, or logos as if
real. Existing `TODO(social-proof)` comment in `LandingPage.tsx` already flags
this same gap — resolve it by leaving an honest content gap, not by faking
data.

## Goals

- Replace `LandingPage.tsx`'s content and section structure with the brief's
  10-section self-serve career-platform narrative (Hero → Positioning →
  Forward Loop → Current Focus → Opportunity Intelligence → Forward Profile →
  Human + AI → Career Momentum → Final CTA; testimonial section omitted per
  above).
- Build the homepage-specific composite primitives the brief calls for that
  Sub-Project 1 explicitly deferred: `CurrentFocusCard`, `ForwardScoreCard`,
  `OpportunityCard`/`OpportunityPreviewCard` (reuse existing where already
  built — see below), `ProfileStrengthCard`, `MetricCard`, `ProgressCard`,
  `FreshFitBadge`.
- Build the hero's dense product-visual composition (FreshFit score ring
  centerpiece, 5-6 floating stat cards, a glowing trajectory path, a walking
  figure/marker) as **one cohesive dark-navy scene**, matching the reference
  image's density and hierarchy.
- Extend the existing dark token system only where a genuinely new need
  appears (e.g. a glow/shadow token for the trajectory line); do not
  reintroduce light/white page backgrounds anywhere on this page (see below).
- Preserve header/footer/nav structure, auth flows, and every other route
  untouched.

## Non-goals (explicitly deferred)

- No changes to `/dashboard`, `/opportunity-engine`, `/achievement-vault`,
  `/forward-dna`, `/career-profile`, `/career-compass`, `/how-it-works`,
  `/services`, `/pricing`, `/faq`, or any strategist/admin page. Those are
  later sub-projects (3 through 8 per the brief's execution order).
- No merge of the `homepage-redesign-phase1` branch. Per owner decision, this
  is a fresh build against the current `main` token system, not a port. That
  branch's components remain uninspected/unused; if any component there turns
  out to be a useful reference during implementation, treat it strictly as
  a prior-art sketch to reimplement against current tokens, not code to graft
  in as-is (it targets the old light `--navy`/`--cream` variable set).
- No fabricated social proof (trusted-by logos, testimonials) — see above.
- No backend, schema, FreshFit/Forward Score scoring-logic changes.

## Design decision: full-dark page, no light sections

The North Star reference image alternates dark hero/CTA bands with white/
light-gray middle sections (How It Works, tool grid, testimonial, pricing,
FAQ). Per explicit owner instruction ("keep color scheme the same as we had
in the previous draft"), **the whole homepage stays on the Sub-Project 1 dark
token system** — no section reverts to a literal white/`#fff`/light-gray
background. To reproduce the reference's visual rhythm and "pop" without
reintroducing light backgrounds, alternate **surface elevation** instead:

| Reference's light/dark rhythm | This project's dark-only equivalent |
|---|---|
| Dark hero | `bg-bg` (deepest navy, `#031421`) |
| White "How It Works" | `bg-surface-elevated` (`#062235`) — one step up, still dark, reads as a distinct band against the hero |
| Light-gray tool grid | `bg-surface-subtle` (`#0E3444`) as the section background, with individual product-mockup cards on `bg-surface-card` (`#0A2B3A`) + `border-border` — the cards should look distinctly elevated against their section, same relationship as "dark card on light page" just inverted in luminance direction |
| White testimonial/pricing/FAQ | omitted (testimonial) / out of scope (pricing, FAQ are separate pages) |
| Dark "Why FreshlyForward" comparison band | keep as a section on this homepage; `bg-bg` again to bookend against the lighter surface-elevated/subtle bands between it and the hero |
| Dark final CTA | `bg-bg`, matching hero |

This preserves the reference's alternating-band feel (the eye still gets a
rhythm of "deep → lighter → deep → lighter → deep" down the page) using pure
luminance steps within the dark palette rather than a hue swap to white.

## Section-by-section plan

Each section below states: brief content → current file/status → target.

### 1. Hero

**Current:** `LandingPage.tsx` lines ~35-68, `bg-[var(--cream)]` (light!) two-
column layout with `FridayReportCard` sample on the right. Concierge copy.

**Target:**
- Section background `bg-bg`.
- Eyebrow: "A BRIGHTER CAREER AHEAD" (`SectionEyebrow` primitive, already built).
- Headline: "Change the way you move your **career forward.**" — accent span
  in `text-primary-400`/`500` per existing green-accent convention seen
  elsewhere (e.g. `SignUpPage.tsx` plan banner).
- Supporting copy per brief, adapted to real feature names from the mapping
  table above (do not claim "finds opportunities that fit" without linking to
  the real Opportunity Engine feature).
- Primary CTA "Get Started Free →" → `/signup`. Secondary CTA "See How It
  Works" → `/how-it-works` (existing route, unmodified this sub-project).
- Micro-value row (3 short items) using existing icon-row pattern already in
  the file (see the current `Check`-icon assurances row) — swap copy only.
- **Do not add the "Trusted by" logo row** (fabricated companies — see
  Terminology section).
- Hero visual (right column, ~45-55% width on desktop per brief): new
  composite component (see New Primitives below) — a `FreshFitScoreRing`
  centerpiece surrounded by 5-6 floating sample-labeled cards (Top
  Opportunity, Resume/Profile Strength, Skill Gap, Goal Progress, Achievement
  Vault asset count, Application in Review) connected by one glowing
  trajectory path built in CSS (gradient + `box-shadow` glow), not a raster
  image, per the brief's performance section ("Use CSS gradients/grids/
  borders/glows instead of images where practical"). Every card is
  explicitly `aria-label`led/visually marked as a sample composition, same
  pattern as the existing sample Friday Report card.
- Mobile: per brief, simplify to 2-3 visible cards max, no horizontal
  overflow, path graphic may be reduced/removed if it fights legibility.

### 2. Positioning ("More than a job search tool.")

**Current:** No equivalent exists (`manifest` section is concierge-specific,
removed).

**Target:** New section, `bg-surface-elevated`. Headline + supporting copy
per brief. Four large pillar cards (Understand / Build / Discover / Advance)
using the `Card` primitive — large format per brief's "confident cards rather
than tiny feature tiles" instruction, each linking to its real feature
(`/career-profile`+`/forward-dna`, `/achievement-vault`, `/opportunity-engine`,
`/dashboard`) with a `(sign in required)` affordance where the destination is
gated.

### 3. The Forward Loop

**Target:** New section, `bg-surface-subtle`. Four-step connected system
(Understand → Focus → Act → Advance) — reuse the existing wavy-connector
visual language already built for onboarding/How It Works
(`components/homepage/*` did this on the other branch; this sub-project
reimplements fresh against current tokens, not a port — see Non-goals). Keep
it CSS-based (grid/border/gradient), not a raster asset.

### 4. Current Focus / Personalized Coaching

**Target:** New section, `bg-bg`. This is the brief's single most important
module — build the new `CurrentFocusCard` primitive here (see below) with
realistic **sample** content (clearly labeled), showing the evidence →
progress → CTA pattern from the brief. Do not claim this reflects a specific
real user; label as illustrative, consistent with existing sample-data
conventions in this codebase.

### 5. Opportunity Intelligence

**Target:** New section, `bg-surface-elevated`. Reuse
`OpportunityPreviewCard.tsx` (already built and already migrated to dark
tokens in Sub-Project 1) as the featured example if its shape fits the
brief's example ("Regional Account Manager, FreshFit 86, Strong Match"); do
not build a second competing component if this one already covers it —
extend only if a real gap exists after inspecting it. CTA "Explore
Opportunities →" → `/signup` (Opportunity Engine itself is gated).

### 6. Forward Profile

**Target:** New section, `bg-surface-subtle`. Sample profile summary card
using the `ProfileStrengthCard` primitive (new, see below) — photo/headline/
experience/skills/achievements/Vault highlights/Forward Score, all sample-
labeled. CTA → `/signup`.

### 7. Human + AI

**Target:** New section, `bg-bg`. Explains strategist support as a real,
existing feature (strategist areas already exist in-app:
`StrategistDashboardPage.tsx` etc.) working alongside the platform — careful
with copy here per the brief's explicit instruction: **do not imply AI
replaces career professionals**, and equally do not reintroduce the old
Concierge Editorial "a human does it for you" framing — the strategist is a
support layer on a self-serve platform, not the operator of it.

### 8. Career Momentum

**Target:** New section, `bg-surface-elevated`. Sample Forward Score
movement / profile growth / applications indicators using `ProgressBar` and
`MetricCard` primitives (`ProgressBar` exists; `MetricCard` is new — see
below). Purposeful only — brief explicitly says no decorative analytics.

### 9. Testimonial / Social proof

**Omitted this sub-project** — no real testimonials exist to use (see
Terminology section). Leave a `TODO(social-proof)`-style comment in the new
file pointing back to this decision, same convention as the current file.

### 10. Final CTA

**Current:** `closing-cta cs-final-call` section exists with concierge copy.

**Target:** `bg-bg`. Headline "Your next opportunity is closer than you
think." per brief, CTA "Get Started Free →" → `/signup`. Reuse the existing
`closing-cta`/`LinkButton variant="light"` pattern already in the file,
copy/content swap only.

## New primitives needed

Per Sub-Project 1's explicit deferral list, these are now in scope, to be
built in `src/components/homepage/` (page-specific, not `src/components/ui/`,
since they're content-shaped rather than page-agnostic — matching the
existing convention where content-specific cards like `FridayReportCard`
live directly under `src/components/`, not `ui/`):

- `HeroProductVisual` (or similar) — the composite hero graphic (score ring +
  floating cards + trajectory path).
- `CurrentFocusCard`
- `ForwardScoreCard`
- `ProfileStrengthCard`
- `MetricCard`
- `ProgressCard` (only if `ProgressBar` alone doesn't cover section 8's need
  after implementation — avoid building a near-duplicate of an existing
  primitive; confirm gap before creating)
- `FreshFitBadge` (only if `freshFit/FreshFitDetails.tsx` or
  `freshFitScore/tiers.ts` styling don't already provide this — check before
  building; Sub-Project 1 already migrated `FreshFitDetails.tsx`)

Reuse without modification (content-shape already matches, already
dark-token-migrated in Sub-Project 1): `OpportunityPreviewCard`,
`FridayReportCard`'s sample-labeling pattern (not the component itself),
`SectionEyebrow`, `SectionHeader`, `CTAButton`, `SecondaryButton`, `Card`,
`ProgressBar`.

## Verification plan (unchanged process from Sub-Project 1)

- `npx tsc --noEmit`, full test suite, `npm run build` after every batch.
- New tests for every new primitive (matching the existing `.test.tsx`
  convention) and an updated/expanded `LandingPage.test.tsx` covering: no
  Concierge Editorial copy remains, no fabricated logos/testimonials, every
  CTA points at a real route, every sample card is labeled as a sample.
- Screenshot sweep (desktop + mobile) of `/` after implementation, added to
  `docs/superpowers/reviews/screenshots/subproject2-homepage/`.
- If a real browser becomes available in a later session, capture actual
  Hudl/TrophyCoach screenshots and do a side-by-side sanity check against
  this spec's Hudl/TrophyCoach section before calling this sub-project done
  — flagged above as a known gap in this spec's research, not skipped
  silently.

## Stop-gate

Per the brief's execution order, Sub-Project 3 (ForwardOS Dashboard) does not
begin until the owner reviews the implemented homepage (code + screenshots)
against this spec and gives explicit approval.
