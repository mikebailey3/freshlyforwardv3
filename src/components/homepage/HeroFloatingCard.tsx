import type { CSSProperties, ReactNode } from 'react'

// Homepage Redesign Phase 1 / Task 3, contrast pass in the Hero Redesign
// (round 2): a small reusable floating-card shell for the hero graphics
// column. Positioning-agnostic -- LandingPage.tsx supplies exact placement
// (top/left/right/bottom) via `className`, plus an optional `style` (used
// for staggered reveal-animation delays) so this component stays a pure
// presentational shell, reusable for any future floating-card content.
//
// Round 2 bumped contrast: the owner's feedback called round 1 "too faint
// / muddy." `var(--navy-soft)` (#102a46) sits close in tone to the hero's
// own `var(--navy)` (#071a31) background, so cards barely separated from
// it visually with only a `ring-white/10` border. Lightened the card
// background a touch (`color-mix` +8% white, same technique already used
// for the Powerful Tools card hover state) and strengthened the ring and
// added a real drop shadow so each card reads as a distinct, intentional
// UI element floating above the scene instead of blending into it.
// Round 4: bumped contrast again -- owner feedback said cards were still
// "too dark/faint against the navy background" even after round 2's +8%
// lightening. Pushed the tint to +14% white and the ring to white/30 with
// a slightly stronger shadow. Still meant to read as premium/subdued, not
// as loud opaque UI chrome -- just clearly separated from the background
// now instead of blending into it.
// Hero Redesign round 6 (literal North Star fidelity pass): the owner
// called the round 2-5 `color-mix` translucent treatment an "outline-only
// pill," not a finished card, when compared directly against the
// reference's solid, opaque, drop-shadowed dashboard cards. Switched from
// a partial white-mix (which let the hero's own dark background bleed
// through) to a fully opaque `--navy-soft` surface with its own visible
// border, so each card reads as a distinct, finished UI component sitting
// on top of the scene -- matching the reference's card language -- rather
// than a tinted overlay of the background behind it.
export function HeroFloatingCard({
  className = '',
  style,
  children,
  ...rest
}: {
  className?: string
  style?: CSSProperties
  children: ReactNode
  'data-testid'?: string
}) {
  return (
    <div
      className={`absolute rounded-2xl border border-white/10 bg-[var(--navy-soft)] px-4 py-3 shadow-xl shadow-black/50 ring-1 ring-white/15 ${className}`}
      style={style}
      {...rest}
    >
      {children}
    </div>
  )
}
