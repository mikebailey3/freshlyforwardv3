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
- Current `src/pages/LandingPage.tsx` and `src/pages/AboutPage.tsx`, read in
  full.

## Locked positioning decision: blend, with an explicit hierarchy

**"Hudl outside. TrophyCoach inside. FreshlyForward everywhere."**

The current `main` homepage copy is the "Concierge Editorial" positioning
(`docs/superpowers/specs/2026-08-28-concierge-editorial-redesign-design.md`):
a human-led service ("one real strategist searches, applies, and reports
back") that explicitly rejects the self-serve/AI framing. The
`Redesign_Project.txt` brief describes a self-serve AI platform (FreshFit,
Opportunity Engine, Career Vault, Career Compass) where strategists are a
supporting feature. Owner decision, final: **neither replaces the other —
blend them with a fixed hierarchy.**

FreshlyForward's primary identity is the **career operating system** — not a
traditional career-services agency that happens to use software, and not an
AI product that happens to offer human support as an afterthought. The
homepage narrative hierarchy, in order:

1. **Career Operating System (identity)** — FreshlyForward is the platform
   for managing and advancing your career. This leads.
2. **Personalized intelligence** — Forward Profile, FreshFit, Opportunity
   Engine, Forward Score, Career Vault, Current Focus understand the
   individual instead of treating everyone as another search query.
3. **Action** — the platform doesn't just surface information, it tells the
   user what matters now and what their next move should be.
4. **Human judgment** — strategists complement the technology when judgment,
   accountability, nuance, or personalized support is valuable. This is a
   real, important layer **inside** the platform, not the whole definition
   of it, and not an afterthought bolted onto an AI product either.
5. **Progress** — the system connects actions to outcomes so users can see
   their career is actually moving forward.

**Positioning guardrail (do not violate either direction):**
- Do not position this as "AI replacing career coaches."
- Do not position this as "career coaches with some software."
- Do position it as: *technology provides the intelligence, organization,
  personalization, and momentum; human strategists provide judgment,
  context, accountability, and support where it matters.*

**Preserve existing copy, repositioned rather than discarded:**
- *"A better search needs better judgment."* (currently `LandingPage.tsx:47`,
  the current hero H1) — this line is a near-perfect encapsulation of layer 4
  above. Repurpose it as **Section 4's (Human Judgment) headline** rather
  than deleting it. It stops being the hero's opening statement (which now
  leads with Career-OS identity per the hierarchy) and becomes the section
  that explains *why* judgment/humans still matter inside an intelligent
  platform.
- *"Career support should feel personal—because the decision is."*
  (`AboutPage.tsx:8`) — `/about` is out of scope for this sub-project and
  keeps this line unchanged. No action needed here; noted only so a future
  contributor doesn't assume it needs to move too.

**Claims discipline:** every homepage sentence must describe something that
exists today, not something planned. Where the brief's language implies more
than the codebase currently does (e.g. "message your strategist directly
whenever something comes up" reads as always-on chat — the real feature is
`MessagesPage.tsx`, a message thread, not guaranteed instant response), write
the honest version, not the aspirational one. Future capabilities may inform
architecture (e.g. leaving room in a component for a "3 minutes ago" status
verse "typically responds within a day") but public copy must not claim
service levels that aren't actually committed to anywhere in this codebase.

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
| Strategist support (weekly reports, messaging, interview prep) | `FridayReportsPage.tsx`, `MessagesPage.tsx`, `CalendarPage.tsx`/`InterviewsPage.tsx`, `CommunicationPreferencesPage.tsx` | all member-only, all real |
| "Take Career Compass" CTA | real, public, no auth required | `/career-compass` |

Public homepage CTAs may link to `/career-compass` (public) and `/signup`
directly. Any homepage visual claiming to show Opportunity Engine, Career
Vault, Forward DNA, Dashboard, or strategist tools **must be labeled as a
sample/preview** (same convention Sub-Project 1 preserved elsewhere, e.g.
`FridayReportCard isSample`), since those are gated behind auth and the
visual is necessarily a mockup, not a live embed.

**Do not fabricate:** the brief's "TRUSTED BY FORWARD THINKERS" logo row
(Amazon, Google, Microsoft, Deloitte, Accenture, Uber) and the brief's
Section 9 testimonial quotes are invented example content with no basis in
this project — FreshlyForward has no such customers on record. **Omit both
from this sub-project.** If real testimonials or partner logos exist, the
owner must supply them; do not placeholder-fabricate names, quotes, or logos
as if real. The existing `TODO(social-proof)` comment in `LandingPage.tsx`
already flags this same gap — resolve it by leaving an honest content gap,
not by faking data.

## Goals

- Replace `LandingPage.tsx`'s content and section structure with the
  5-layer hierarchy above (Identity → Intelligence → Action → Human
  Judgment → Progress → Final CTA), reusing the two preserved copy lines
  where they land naturally.
- Build the homepage-specific composite primitives the brief calls for that
  Sub-Project 1 explicitly deferred: `CurrentFocusCard`, `ForwardScoreCard`,
  `OpportunityCard`/`OpportunityPreviewCard` (reuse existing where already
  built — see below), `ProfileStrengthCard`, `MetricCard`.
- Build the hero's dense product-visual composition (FreshFit score ring
  centerpiece, floating stat cards, a glowing trajectory path) as one
  cohesive dark-navy scene, matching the reference image's density and
  hierarchy, while leading with Career-OS identity copy (not the old
  concierge copy, and not a judgment-first headline — judgment moves to
  layer 4).
- Give the Human Judgment layer real visual weight — it is layer 4 of 5, not
  an afterthought footnote — using only real, existing strategist features.
- Preserve header/footer/nav structure, auth flows, and every other route
  untouched.

## Non-goals (explicitly deferred)

- No changes to `/dashboard`, `/opportunity-engine`, `/achievement-vault`,
  `/forward-dna`, `/career-profile`, `/career-compass`, `/how-it-works`,
  `/services`, `/pricing`, `/faq`, `/about`, or any strategist/admin page.
  Those are later sub-projects (3 through 8 per the brief's execution order)
  or simply out of scope (`/about`, `/services`).
- No merge of the `homepage-redesign-phase1` branch. This is a fresh build
  against the current `main` token system, not a port. That branch's
  components remain uninspected/unused; if any component there turns out to
  be a useful reference during implementation, treat it strictly as
  prior-art to reimplement against current tokens, not code to graft in
  as-is (it targets the old light `--navy`/`--cream` variable set).
- No fabricated social proof (trusted-by logos, testimonials) — see above.
- No implied AI-replaces-humans or humans-with-a-website framing — see
  positioning guardrail above.
- No backend, schema, FreshFit/Forward Score scoring-logic changes.

## Design decision: full-dark page, no light sections

The North Star reference image alternates dark hero/CTA bands with white/
light-gray middle sections. Per explicit owner instruction ("keep color
scheme the same as we had in the previous draft"), **the whole homepage
stays on the Sub-Project 1 dark token system** — no section reverts to a
literal white/`#fff`/light-gray background. To reproduce the reference's
visual rhythm and "pop" without reintroducing light backgrounds, alternate
**surface elevation** instead:

| Reference's light/dark rhythm | This project's dark-only equivalent |
|---|---|
| Dark hero | `bg-bg` (deepest navy, `#031421`) |
| White "How It Works"-style section | `bg-surface-elevated` (`#062235`) — one step up, still dark, reads as a distinct band against the hero |
| Light-gray tool grid | `bg-surface-subtle` (`#0E3444`) as the section background, with individual product-mockup cards on `bg-surface-card` (`#0A2B3A`) + `border-border` — cards read as elevated against their section the same way "dark card on light page" does, just inverted in luminance direction |
| White testimonial section | omitted (no real testimonials — see above) |
| Dark comparison/differentiation band | keep; `bg-bg` again to bookend against the lighter bands between it and the hero |
| Dark final CTA | `bg-bg`, matching hero |

This preserves the reference's alternating-band rhythm (deep → lighter →
deep → lighter → deep down the page) using pure luminance steps within the
dark palette rather than a hue swap to white.

## Section-by-section plan

Each section states: hierarchy layer → brief/reference content → current
file/status → target.

### 1. Hero — Layer 1: Career Operating System (identity)

**Current:** `LandingPage.tsx` lines ~35-68, `bg-[var(--cream)]` (light!),
two-column layout with `FridayReportCard` sample on the right, concierge
copy, H1 = "A better search needs better judgment."

**Target:**
- Section background `bg-bg`.
- Eyebrow: "A BRIGHTER CAREER AHEAD" (`SectionEyebrow` primitive, already
  built).
- New headline leads with platform identity, not judgment (judgment moves to
  Section 4): "Change the way you move your **career forward.**" — accent
  span in `text-primary-400`/`500`, matching the existing green-accent
  convention (e.g. `SignUpPage.tsx` plan banner).
- Supporting copy frames FreshlyForward as the career operating system,
  using real feature names from the terminology map — do not claim "finds
  opportunities that fit" without it linking to the real Opportunity Engine.
- Primary CTA "Get Started Free →" → `/signup`. Secondary CTA "See How It
  Works" → `/how-it-works` (existing route, unmodified this sub-project).
- Micro-value row (3 short items) using the existing icon-row pattern
  already in the file (the current `Check`-icon assurances row) — copy swap
  only, framed around the platform (personalization, intelligence,
  momentum) rather than the old concierge assurances.
- **Do not add the "Trusted by" logo row** (fabricated companies — see
  Terminology section).
- Hero visual (right column, ~45-55% width on desktop per brief): new
  composite component (see New Primitives) — a `FreshFitScoreRing`
  centerpiece surrounded by floating sample-labeled cards (Top Opportunity,
  Profile Strength, Skill Gap, Goal Progress, Achievement Vault asset count)
  connected by one glowing trajectory path built in CSS (gradient +
  `box-shadow` glow), not a raster image, per the brief's performance
  guidance. Every card is explicitly sample-labeled, same pattern as the
  existing sample Friday Report card. Mobile: 2-3 visible cards max, no
  horizontal overflow.

### 2. Personalized Intelligence — Layer 2

**Current:** No equivalent exists (`manifest` section is concierge-specific,
removed).

**Target:** New section, `bg-surface-elevated`. Headline + supporting copy
introducing Forward Profile, FreshFit, Opportunity Engine, Forward Score,
Career Vault as one connected intelligence layer that understands the
individual. Four to five large cards (not tiny feature tiles, per brief),
using the `Card` primitive, each linking to its real feature
(`/career-profile` + `/forward-dna`, `/achievement-vault`,
`/opportunity-engine`, `/dashboard`) with a "sign in required" affordance
where the destination is gated.

### 3. Action — Layer 3 (Current Focus)

**Target:** New section, `bg-surface-subtle`. Build the new `CurrentFocusCard`
primitive here with realistic **sample**, clearly-labeled content: evidence
→ progress → CTA pattern from the brief ("the platform tells you what
matters now"). Do not claim this reflects a specific real user.

### 4. Human Judgment — Layer 4

**Target:** New section, `bg-bg`. **Headline: "A better search needs better
judgment."** (repurposed verbatim from the current hero — see Positioning
section above). Supporting copy explains strategist support as a real,
existing layer working alongside the platform's intelligence — grounded
only in real features from the terminology map (Friday Reports, Messages,
Interview scheduling, Communication Preferences). Must satisfy the
positioning guardrail: not "AI replacing coaches," not "coaches with a
website." CTA can point to `/services` or `/how-it-works` (both out of
scope/unmodified) for more detail, or `/signup`.

### 5. Progress — Layer 5 (Career Momentum)

**Target:** New section, `bg-surface-elevated`. Sample Forward Score
movement / profile growth / applications indicators using the `ProgressBar`
primitive (exists) and the new `MetricCard` primitive. Purposeful only — the
brief explicitly says no decorative analytics, and this section's whole job
is proving layer 5 ("see your career actually moving forward"), not
padding the page.

### 6. Opportunity Intelligence highlight (supporting Layer 2/3)

**Target:** New section, `bg-surface-subtle`, positioned after Progress as a
concrete proof-point before the final CTA. Reuse
`OpportunityPreviewCard.tsx` (already built, already migrated to dark
tokens in Sub-Project 1) as the featured example if its shape fits the
brief's example ("Regional Account Manager, FreshFit 86, Strong Match") —
do not build a second competing component if this one already covers it.
CTA "Explore Opportunities →" → `/signup` (Opportunity Engine itself is
gated).

### 7. Testimonial / social proof

**Omitted this sub-project** — no real testimonials exist to use (see
Terminology section). Leave a `TODO(social-proof)`-style comment in the new
file pointing back to this decision, same convention as the current file.

### 8. Final CTA

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
  CTA points at a real route, every sample card is labeled as a sample, both
  preserved copy lines land where this spec says they do, and the copy
  doesn't imply AI-replaces-humans or humans-with-software.
- Screenshot sweep (desktop + mobile) of `/` after implementation, added to
  `docs/superpowers/reviews/screenshots/subproject2-homepage/`.
- If a real browser becomes available in a later session, capture actual
  Hudl/TrophyCoach screenshots and do a side-by-side sanity check against
  this spec's Hudl/TrophyCoach section before calling this sub-project done
  — flagged above as a known gap in this spec's research, not skipped
  silently.

## Stop-gate

This spec itself requires owner approval before the implementation plan is
written — per the brief's execution order and the established two-checkpoint
process (spec review, then plan, then implementation). Sub-Project 3
(ForwardOS Dashboard) does not begin until the owner reviews the implemented
homepage (code + screenshots) against this spec and gives explicit approval.
