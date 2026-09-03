# Homepage North Star Fidelity Pass — Design Spec

**Date:** 2026-09-03
**Branch:** `homepage-redesign-phase1` (no merge to `main`)
**Supersedes-in-part:** `docs/superpowers/specs/2026-09-02-homepage-design-north-star.md` (this doc
is the fidelity-pass follow-on once high-fidelity reproduction, not "inspired by," became the goal)
**Source of truth:** `public/images/A63B5E0B-0AE1-4D9A-B05D-9C52403721C7.png` (864x1821px)

## 1. Goal

Reproduce the North Star reference image as closely as technically possible on `/`, section by
section, at desktop width first, then translate the same design system down to tablet/mobile.
Differences from the reference should be caused only by truthful real product data/content —
never by choosing different spacing, proportions, card sizes, section heights, typography scale,
density, backgrounds, composition, or graphical treatment.

This is **not** a rebuild "inspired by" the reference. It is a high-fidelity design-to-code pass
against a fixed image target.

## 2. Measured baseline (Phase 1 audit findings)

Reference canvas: 864x1821px (height = 2.11x width). Current homepage at matching width: ~4.46x
width. Normalized to equal width, the current page runs **~2.1x taller** than the reference for
equivalent content — the majority of every section's "sparse" feeling traces back to this, not
missing content.

Normalized (to 1440px width) zone comparison:

| Zone | Reference (normalized) | Current | Direction |
|---|---|---|---|
| Header + Hero | ~640px | 892px | reduce ~28% |
| How It Works -> FAQ (combined) | ~2,254px | 4,800px | reduce ~53% |
| Final CTA | >=135px (reference image is cropped here -- floor, not ceiling) | 336px | tighten, but not forced past what real content needs |

The density reduction is treated as **one padding/type-scale pass across How It Works, Powerful
Tools, Human Support, Why FreshlyForward, and Pricing/FAQ together**, not five isolated tweaks,
per the approved direction to fix proportions globally rather than section-by-section in
isolation.

## 3. Section-by-section target state

### 3.1 Header (homepage only)
- New `variant?: 'light' | 'dark'` prop on `SiteHeader` (`src/components/PublicLayout.tsx`).
  Default remains `'light'` — every other public route is byte-for-byte unchanged.
- `App.tsx` passes `variant={location.pathname === '/' ? 'dark' : 'light'}`.
- Dark variant: header renders transparent/absolutely-positioned over the hero (no seam/border),
  logo forced white via CSS filter (`brightness(0) invert(1)` — no new logo asset needed), nav
  links/dropdown text and the Sign In/Get Started actions restyled for dark contrast.
- **Unchanged:** nav link labels, routes, dropdown structure/behavior, auth-aware states
  (Dashboard/Sign Out vs Sign In/Get started), CTA destinations. Only `/` gets the dark treatment;
  all other pages keep today's white sticky header exactly as-is.
- Logo scale tightened (~220px -> smaller) and nav-links wrapped in their own centered flex group
  (separate from the pinned-right actions) to match the reference's more even horizontal spacing.

### 3.2 Hero (high priority)
- `HeroFreshFitCenterpiece`: remove the boxed card chrome (bg/padding/shadow container) around the
  ring. Ring floats directly on the navy background with a soft radial glow behind it.
- `HeroCareerPath`: extend the path so it continues past the ring toward an arrow/forward motif
  (echoing the "forward momentum" language already used elsewhere on the site). The human figure
  is integrated as actually walking the path, not a static glyph at a fixed point.
- Floating cards (`HeroFloatingCard` instances in `LandingPage.tsx`): reposition tighter around the
  ring/path to remove dead negative space; content unchanged (all already-vetted truthful sample
  data, explicitly illustrative).
- Section height reduced toward the ~640px (header+hero combined, normalized) target.

### 3.3 How FreshlyForward Works
- Spacing/scale tightening pass only (not a structural rebuild): smaller circular icon nodes,
  tighter vertical rhythm, connector line pulled closer to the icons. Five-step structure, numbered
  badges, and centered CTA remain as already implemented.

### 3.4 "Powerful tools. One connected system."
- **Structural fix:** outer section background changes from full-bleed navy
  (`bg-[var(--navy)] py-20`) to the page's light/cream canvas. Only the six individual cards (3
  flagship + 3 supporting) stay dark-navy boxes, matching the reference's light-canvas /
  dark-cards model exactly.
- Flagship card previews get denser, more realistic mini-UI (e.g., Opportunity Engine preview
  shows two full match rows with action buttons, not a single compact line) while continuing to
  reuse real components/data shapes (`MatchCard`-style, real `CircularProgress`, real
  `APPLICATION_STATUSES`), never inventing new content categories.

### 3.5 Human Support
- Wide horizontal layout preserved: photo occupies roughly the right half, floating card overlaps
  its edge.
- **Truthfulness substitution:** the reference's "Alex R." testimonial quote card is replaced with
  a truthful capability card (e.g., "Human strategist support, whenever you need it") at the same
  size/position/overlap treatment. No fabricated name, quote, title, or rating.

### 3.6 Why FreshlyForward?
- Section becomes an inset rounded navy panel within the page shell (matching the reference's
  near-full-width-but-not-quite-edge-to-edge treatment) rather than a full-bleed section.
- VS badge, red-X/green-check lists, and `NodeGraph` decorative comparison remain as already
  implemented; this is a containment/padding/proportion fix, not new content.

### 3.7 Pricing
- Grid, card proportions, "Most Popular"/featured emphasis, and CTA placement match the
  reference's visual system.
- **Kickstarter Special callout is dropped entirely** — confirmed no such offering exists anywhere
  in the real product (only referenced in a test asserting it must never fake-appear). The grid
  uses the freed width rather than leaving a gap. Plan count/names/prices continue to come
  exclusively from the live `membership_plans` query already used by `PricingTeaser.tsx` — never
  hardcoded.

### 3.8 FAQ
- Row-height/border/density tightening pass on the existing two-column, six-question layout (all
  questions already verbatim from `FaqPage.tsx`). No new questions invented to fill space.

### 3.9 Final CTA (high priority)
- Path becomes a richer multi-milestone visual (glowing line with several labeled stops), matching
  the reference's structural richness far beyond the current simple two-dot dashed line.
- **Milestone labels:** progress-oriented, non-guaranteeing language. The final label is
  **"Next Move"**, not "Offers" — the path communicates progress toward the user's next career
  move, never an implied guarantee of interviews, offers, or placement. Intermediate labels
  (e.g., "Career Clarity", "Stronger Opportunities", "Stronger Applications", "Interviews") stay
  process-oriented; none imply a guaranteed outcome.
- Headline/subcopy/dual CTAs remain exactly as already implemented ("Your next move starts here." /
  Take Career Compass / See How It Works).

### 3.10 Footer
- **No change.** The reference screenshot's navy band ends immediately after the Final CTA
  (~81px at true edges, cropped) — no footer is visible in the source image, so there is nothing
  to reproduce fidelity against. The existing, previously-reviewed footer is left untouched.

## 4. Truthfulness substitutions (locked)

| Reference shows | Real substitute |
|---|---|
| "Alex R." testimonial quote card | Truthful capability card, same geometry |
| Career Vault "23 Assets" | Existing "Coming Soon" treatment, same visual density |
| "Monica is online" named strategist | Existing generic icon/neutral presentation |
| Kickstarter Special callout | Removed — not a real offering |
| "Offers" milestone glow (final CTA) | **"Next Move"** — no guaranteed-outcome language |

## 5. Engineering guardrails

No changes to: routes, authentication, Supabase logic, plan gating, Opportunity Engine behavior,
FreshFit behavior, or real pricing data flow. This is a presentational pass only. Visual fidelity
is never justification for touching unrelated product architecture.

## 6. Responsive behavior

Desktop is the primary reference target. Once desktop closely matches the North Star, the same
design system (not an independently redesigned layout) is intelligently simplified for tablet and
mobile, consistent with the existing `lg:`/`md:` breakpoint conventions already used in
`LandingPage.tsx`.

## 7. Testing & verification plan

1. Focused component/page tests during implementation (`LandingPage.test.tsx`,
   `PublicLayout.test.tsx`, plus a new test asserting the homepage-only dark header variant and
   every other public route keeping the light variant).
2. Full suite: `npx vitest run --exclude "**/.worktrees/**"`.
3. `npm run build`.
4. Fresh desktop/tablet/mobile screenshots of `/`.
5. Side-by-side comparison image: North Star vs. new implementation.
6. Second visual-difference audit against the reference, reporting remaining mismatches in
   geometry, spacing, typography, colors, composition, card dimensions, and graphical elements.
   Material mismatches are fixed before the task is called complete — a single implementation pass
   is not treated as sufficient on its own.

All work stays on `homepage-redesign-phase1`. No merge into `main`.
