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
export function HeroFloatingCard({
  className = '',
  style,
  children,
}: {
  className?: string
  style?: CSSProperties
  children: ReactNode
}) {
  return (
    <div
      className={`absolute rounded-xl bg-[color-mix(in_srgb,var(--navy-soft),white_8%)] px-4 py-3 shadow-lg shadow-black/40 ring-1 ring-white/20 ${className}`}
      style={style}
    >
      {children}
    </div>
  )
}
