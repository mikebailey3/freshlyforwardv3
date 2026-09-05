# Hero Redesign — Direction A Implementation Design (v2, with refinements)

Status: **Design only, awaiting approval. No code changed.**
Branch: `homepage-redesign-phase1` (unchanged, no new commits yet).

## 1. One terminology call I'm making — please confirm or override

You offered "Resume Strength 78" OR "Goal Progress 75%" for the extra signal.
`Resume Strength` does not exist anywhere in this codebase as a real feature
name. `Search Readiness` is the real, live feature (`SearchReadinessWidget.tsx`,
`DashboardPage.tsx`, strategist workspace, onboarding, a dedicated regression
test file) that covers exactly the "how complete/ready is your profile"
concept you're describing — and it already uses the same sample value, 78,
that the current hero's Search Readiness card uses today.

**My recommendation: use `Search Readiness · 78 · Good`**, not "Resume
Strength" — same number you asked for, but the real product term instead of
an invented one. `Goal Progress 75%` remains the fallback if you'd rather show
that signal instead. Everything below assumes Search Readiness; swap is
trivial if you prefer Goal Progress.

## 2. Desktop structure

Two-column grid, same fundamental shape as today, reallocated toward the card:

- Grid ratio changes from today's `1.05fr 0.95fr` (text-heavy) to **`0.9fr 1.1fr`**
  (card-heavy) — this alone hands the card column roughly 15-20% more width
  without touching the shell's global 1180px max-width.
- Left column (headline/copy/CTAs/trust row): **unchanged content and
  markup**, just narrower by the grid shift above. "Operating System" keeps
  its exact current mint-green `<span>` treatment — no change.
- Right column: the new `ForwardOSSnapshotCard`, scaled up ~15-20% inside its
  larger column:
  - Card padding: 32px → 38px
  - FreshFit ring: 132px → 155px diameter
  - Score number: 30px → 36px font
  - Everything else (border, gradient surface, shadow language) reuses the
    existing card-surface visual style established in `HeroFloatingCard.tsx`,
    just on a bigger single card instead of eight small ones.
- No absolute positioning anywhere. No SVG path. No walking figure. No
  scattered cards. No connector lines. No standalone giant ring with its own
  radial glow div (that glow lives only in the now-removed
  `HeroFreshFitCenterpiece` wrapper — the ring itself, `HeroFreshFitRing`, has
  no glow, just a subtle per-segment drop-shadow, so reusing it directly
  satisfies "no excessive glow").

## 3. Mobile structure (and tablet — see note below)

Single-column, normal document flow, exact hierarchy you specified:

1. Headline
2. Supporting copy
3. Primary CTA (Take Career Compass)
4. Secondary CTA (See How It Works)
5. Trust/value row (Personalized / AI-powered career intelligence / Human experts)
6. Full-width `ForwardOSSnapshotCard`

This is not a reordering trick — it's simply the natural top-to-bottom
document order once the winding-path/floating-card system (which required
`HeroMobileJourney.tsx` to exist as a *separate, parallel* mobile
implementation) is gone. One component, one set of markup, every breakpoint.

**Snapshot card's internal layout on mobile** (rearranges, not shrinks):
- Header row (eyebrow + "Illustrative preview" tag) — unchanged, full width.
- Ring + Top Opportunity block: **stacks vertically, centered** (ring on top,
  text block below it, centered) instead of desktop's side-by-side row —
  because a 150px ring next to two lines of text doesn't have room to
  breathe under ~360-390px of content width.
- Search Readiness stat row: full width, unchanged internal layout (it's
  already a simple label + number + bar, no rearrangement needed).
- Recommended Next Action row: full width, unchanged internal layout.
- Strategist trust line: full width, unchanged internal layout.

**Tablet note:** the existing codebase's own breakpoint convention already
puts the 2-column/1-column split at `lg` (1024px). Portrait tablets (iPad
Mini 768px, iPad Air 820px) fall below that, so they naturally get the same
single-column "full-width snapshot card" treatment as mobile — no separate
tablet composition is needed at all, which removes an entire category of
past bugs (the old tablet path used `HeroCareerPath simplified`, a *third*
hand-tuned coordinate variant). One breakpoint, three device classes.

## 4. ForwardOS Snapshot card — exact contents (top to bottom)

1. **Header row:** eyebrow "Your ForwardOS Snapshot" (left) + small
   "● Illustrative preview" tag (right) — reuses the existing "Illustrative
   preview" convention/wording already established in the current hero.
2. **Primary proof row:** `HeroFreshFitRing` (82, "Strong Match") beside (desktop)
   or above (mobile) the Top Opportunity block — "Senior Product Manager,
   $120K–$130K · Remote". This is the single biggest visual moment in the
   card, matching your "primary product proof, not a supporting widget" note.
3. **Divider.**
4. **Secondary signal row (the one new addition):** "Search Readiness · 78 ·
   Good" with a slim inline progress bar — small, quiet, clearly secondary to
   #2. Not a floating card, not equal visual weight — just one more line
   inside the same frame.
5. **Divider.**
6. **Recommended Next Action row:** highlighted green-tinted pill —
   "Interview Practice · Today, 2:00 PM" — the payoff moment: intelligence →
   action.
7. **Strategist trust line:** small icon + "Your strategist is here if you
   need a second opinion." — quietest element in the card, reinforcing the
   human-led differentiator without adding a whole separate card.

No Career Vault representation in the hero card (see §7 below — flagged as a
consequence, not an oversight).

## 5. Responsive breakpoints/behavior — summary table

| Breakpoint | Outer grid | Card internal ring+opportunity row |
|---|---|---|
| `< lg` (0–1023px: phones + portrait tablets) | 1 column, card full-width below text | stacked, centered |
| `≥ lg` (1024px+: laptops/desktops) | 2 columns, `0.9fr 1.1fr` | side-by-side row |

One breakpoint concept governs the entire hero. No JS, no percentage
coordinates, no per-device special-casing beyond that single Tailwind `lg:`
prefix — which is exactly the reused convention already in the rest of this
codebase (`lg:grid-cols-2` is already the pattern this file uses today).

## 6. Components reused vs. new vs. removed

**Reused as-is:**
- `LinkButton` (both CTAs)
- `HeroFreshFitRing.tsx` (the segmented dial itself — no changes needed)
- Existing headline/copy/trust-row JSX and copy, verbatim
- Existing `lucide-react` icons already imported (`ArrowRight`, `PlayCircle`, `Check`)

**New:**
- `src/components/homepage/ForwardOSSnapshotCard.tsx` — the single snapshot
  card, self-contained, handles its own responsive internal layout via one
  `lg:` breakpoint. Kept separate from `LandingPage.tsx` to keep that file's
  line count in check and to make the card independently testable.

**Removed from the hero entirely (files deleted — confirmed via grep that
`LandingPage.tsx` is their only consumer):**
- `src/components/homepage/HeroCareerPath.tsx` (winding path, arrow, walking
  figure, both coordinate objects)
- `src/components/homepage/HeroFloatingCard.tsx` (the 8-card absolute-position shell)
- `src/components/homepage/HeroFreshFitCenterpiece.tsx` (the big glow-wrapped
  ring; superseded by using `HeroFreshFitRing` directly, smaller, glow-free)
- `src/components/homepage/HeroMobileJourney.tsx` (the parallel mobile-only
  coordinate system, no longer needed)

**Untouched (below-the-fold / out of scope, per your instruction):**
- `PublicLayout.tsx`, nav, `SectionHeading`, all Powerful Tools flagship
  cards (`FlagshipOpportunityPreview`, `FlagshipFreshFitPreview`,
  `FlagshipVaultPreview`), `HowItWorksConnector`, `FooterCareerPath`,
  `NodeGraph`, `PricingTeaser`, everything in `index.css`, all routes.

## 7. Files expected to change

1. `src/pages/LandingPage.tsx` — hero `<section>` markup replaced (grid
   ratio, remove old imports/usages, add `<ForwardOSSnapshotCard />` once for
   both mobile and desktop — no more separate mobile/tablet/desktop variants).
2. **New:** `src/components/homepage/ForwardOSSnapshotCard.tsx`
3. `src/pages/LandingPage.test.tsx` — updates required:
   - Remove tests tied to the removed hero elements (walking figure, 8 floating
     cards, `hero-career-vault-card` testid/behavior — Career Vault is no
     longer represented in the hero under this simplified design; it still
     appears in the Powerful Tools section below, unchanged).
   - Add tests asserting the new card's content (ring score, Top Opportunity,
     Search Readiness stat, Next Action, strategist line) and its
     "Illustrative preview" labeling.
4. **Delete:** `HeroCareerPath.tsx`, `HeroFloatingCard.tsx`,
   `HeroFreshFitCenterpiece.tsx`, `HeroMobileJourney.tsx`
5. No other files change.

## Open item for your sign-off

Removing the hero's Career Vault mention (§6/§7) is a direct, intended
consequence of "keep the snapshot intentionally simple, one card, one extra
signal" — Career Vault just isn't one of the two product signals shown
anymore. It remains fully represented in the Powerful Tools section further
down the page. Flagging this explicitly so it's a decision, not a surprise.

---

**Stopping here per your instruction. Waiting on:**
1. Search Readiness vs. Goal Progress for the second signal (recommendation: Search Readiness)
2. Approval of the grid ratio / sizing numbers in §2
3. Sign-off on Career Vault leaving the hero card (§7)

Then I'll write the actual implementation.
