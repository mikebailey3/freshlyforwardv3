# FreshlyForward Redesign — Sub-Project 1: Design System Foundation

## Context

`C:\Users\c0b0sty.s02638\Documents\Redesign_Project.txt` is a full-site visual
redesign brief: invert the entire FreshlyForward experience (public marketing
site + the ForwardOS member/strategist product app) from its current light
palette to a premium dark navy/green "career performance platform" identity,
inspired by Hudl (platform credibility) and TrophyCoach (personalized focus),
while preserving 100% of existing functionality, routes, auth, and backend
logic.

That brief is far too large for one spec. It was decomposed into 9
sequential sub-projects, each with its own spec → plan → implementation →
checkpoint cycle:

1. **Design System Foundation** (this document)
2. Homepage
3. ForwardOS Dashboard
4. Opportunity Engine
5. Forward Profile
6. How It Works
7. Career Vault, Applications, Career Compass, Strategist, Community
8. Pricing, Resources/Blog, footer/global polish
9. Mobile, accessibility, and performance passes

**This spec covers only Sub-Project 1.** No other sub-project's implementation
begins until the owner explicitly approves this foundation.

## Goals

- Establish one semantic color/surface/typography token system, shared by the
  public marketing site and the logged-in ForwardOS product, matching the
  brief's navy/green palette.
- Systematically migrate the codebase's existing hardcoded literal Tailwind
  neutrals (`bg-white`, `border-neutral-200`, `text-neutral-900`, etc.) onto
  that semantic system, in bounded, verified batches — not a blind
  find/replace.
- Build a small set of truly page-agnostic UI primitives.
- Ship an internal `/internal/design-system` showcase route that visually
  proves the foundation before any production page consumes it.
- Preserve 100% of existing routes, auth, Supabase integration, FreshFit,
  Opportunity Engine, Career Vault, Forward Score, Career Compass, and all
  other business logic. This sub-project touches only CSS tokens, class
  names, and a handful of new presentational components.

## Non-goals (explicitly deferred)

- No production page's layout, copy, or information hierarchy changes in
  this sub-project. Only literal-neutral **class substitutions** on existing
  markup (shared layouts + the audited files), never structural JSX changes.
- No content-specific composite components (`CurrentFocusCard`,
  `ForwardScoreCard`, `OpportunityCard`, `ProfileStrengthCard`, etc.) — those
  are designed in the sub-project that first needs them, driven by real
  content requirements instead of guessed now.
- No homepage, dashboard, or any other page redesign work.
- No backend, schema, FreshFit scoring, or Forward Score logic changes.

## Design

### 1. Semantic color tokens

Same mechanism the codebase already uses (Tailwind v4 `@theme` custom
properties in `src/index.css`), with light-mode values replaced in place —
no parallel/legacy token system kept around.

| Semantic role | Token | Value | Replaces |
|---|---|---|---|
| App/page background | `--color-bg` | `#031421` (deep navy) | body background, `bg-neutral-50` |
| Elevated chrome surface (header, sidebar) | `--color-surface-elevated` | `#062235` (primary navy) | ad hoc header/sidebar backgrounds |
| Card surface | `--color-surface-card` | `#0A2B3A` | `bg-white` on cards |
| Higher/nested surface (hover, subtle fill, nested card) | `--color-surface-subtle` | `#0E3444` | `bg-neutral-50`, `hover:bg-neutral-50` |
| Primary text | `--color-ink` | `#F4F7FA` (soft white) | `text-neutral-900` |
| Secondary/muted text | `--color-ink-muted` | `#8FA3B8` (muted blue-gray) | `text-neutral-500`, `text-neutral-600` |
| Border / subtle divider | `--color-border` | `#16374A` (subtle navy/teal) | `border-neutral-200`, `border-neutral-300` |
| Interactive/hover surface | `--color-surface-hover` | `#123044` | `hover:bg-neutral-50/100` |
| FreshlyForward green accent | `--color-primary-*` scale (reused name, retuned) | anchored on `#50F28C` / `#2DCE75` | existing green scale |
| Success / progress state | `--color-success-*` scale (reused name, retuned) | anchored on `#50F28C` | existing success scale |

`--color-ink`, `--color-ink-muted`, and `--color-border` use concrete hex
values because the brief left "soft white" / "muted blue-gray" / "subtle
navy/teal" unspecified — these are provisional and adjustable during the
showcase visual QA pass, per "translate the design intelligently" rather
than pixel-perfect.

**Known follow-on case:** existing accent-scale usage (e.g.
`FreshFitBadge`'s `border-success-300 text-success-700`) is tuned for a
*light* background (dark text + light border on white). On a dark surface
that pairing is illegible. Part of the inventory pass is cataloging these
light-tuned accent pairings (not just literal neutrals) and remapping them
to a dark-appropriate pairing (lighter text, mid-tone border) — same
semantic meaning, different token direction. Error/warning/success scales
get a contrast check against the new dark surfaces as part of this
sub-project; values are retuned only if they fail WCAG contrast, not
redesigned wholesale.

### 2. Typography tokens

No font-family changes (Manrope/DM Sans, Fraunces, Space Mono stay). Add a
shared modular type-scale so marketing's oversized editorial headings and
the product app's compact operational hierarchy both draw from one system
instead of ad hoc sizes per page:

- `--text-display` — oversized marketing hero headings
- `--text-h1` / `--text-h2` / `--text-h3` — section headings, scaled down for
  product density where needed
- `--text-body` / `--text-body-sm`
- `--text-label` — compact operational labels/metrics
- `--text-eyebrow` — small uppercase system labels (uppercase stays reserved
  for eyebrows/labels/statuses, never full headings, per the brief)

### 3. Inventory & migration process

1. **Inventory**: systematically catalog every literal-neutral and
   light-tuned-accent occurrence per file (spot-check already found ~50
   occurrences across just 4 files; realistically hundreds across the
   64 pages + 34 components).
2. **Map**: assign each occurrence to a semantic role above, or mark it an
   **intentional exception** (e.g. a pure-white icon glyph, a status color
   that must stay literal for a genuine reason) — exceptions get a one-line
   comment explaining why.
3. **Migrate in bounded groups**, in this order:
   - Shared layouts first: `MemberLayout`, `PublicLayout`, `StrategistLayout`
   - Most-reused small components next (`Badges.tsx`, `ui.tsx`,
     `ProfileCard.tsx`, etc.)
   - Then page files, batches of ~5–8 files at a time
4. **After every batch**: run typecheck, full test suite, production build,
   then visually inspect one representative public page and one
   representative authenticated page.
5. No sed-style blind global replace — every substitution reviewed in
   context; exceptions preserved deliberately, not accidentally.

### 4. Primitives to build now (page-agnostic only)

`SectionEyebrow`, `SectionHeader`, `CTAButton`, `SecondaryButton`, a base
`Card`/surface primitive, `ProgressBar`, `Tabs`, `FilterChip`, `EmptyState`,
`DataRow`, plus any other primitive that's clearly page-agnostic and reused
by multiple future sub-projects (evaluated as they come up, not
speculatively expanded).

**Explicitly deferred**: `CurrentFocusCard`, `ForwardScoreCard`,
`OpportunityCard`, `ProfileStrengthCard`, and any other content-specific
composition — designed later, in the sub-project that defines their real
content hierarchy and behavior.

### 5. `/internal/design-system` showcase route

An unlinked, internal-only route (no public nav entry, not part of the
sitemap) rendering every Section 4 primitive plus the semantic
backgrounds/surfaces and typography hierarchy, using **realistic
FreshlyForward content** (real copy patterns like "Regional Account
Manager," "FreshFit 86," "Strengthen your leadership accomplishments" —
never lorem ipsum). No real user data or Supabase calls — purely static
sample content, so no auth-gating needed.

Sections to include:
- Semantic backgrounds/surfaces (all 4 navy levels side by side)
- Typography hierarchy (display through label/eyebrow)
- Buttons (primary, secondary, states)
- Base cards
- Progress bars
- Tabs
- Filter chips
- Data rows
- Empty / loading / error state treatments
- Navigation states where foundational (active/hover nav item styling)

Shown at representative **desktop and mobile** widths. This route is for
visual QA of the foundation only — it does not pre-build any dashboard-
specific page layout.

### 6. Testing & verification

- Component tests for each new primitive (rendering, prop variants).
- Existing test suite must stay green after every migration batch — no
  regressions in behavior, only class-level changes.
- Typecheck and production build clean after every batch.
- Manual visual inspection (screenshots) of the showcase route and of
  representative public + authenticated pages after their batch, at
  desktop and mobile widths.
- WCAG-conscious contrast check on the new token pairings, especially
  retuned accent scales (success/warning/error) against dark surfaces.

## Deliverables (end of Sub-Project 1)

1. The semantic token map (as implemented, with any values adjusted during
   visual QA noted against this spec's provisional values).
2. List of every file migrated to semantic tokens.
3. List of intentional literal-color exceptions, with the reason for each.
4. The `/internal/design-system` showcase route.
5. Screenshots/previews of the showcase (desktop + mobile) and of
   representative migrated public/authenticated screens.
6. Test, typecheck, and build results.

## Stop-gate

**Sub-Project 2 (Homepage) does not begin until the owner reviews and
explicitly approves this design-system foundation** — the token map, the
migrated-file list, the exception list, and the showcase route.

## Scope guardrails (carried from the master brief)

Do not: alter backend logic, change database schema, change FreshFit or
Forward Score logic, remove features, break routes, introduce unrelated
features, perform broad unrelated code cleanup, or fake data. If a design
improvement surfaces that requires backend work, document it separately
rather than implementing it here.
