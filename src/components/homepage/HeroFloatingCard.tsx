import type { CSSProperties, ReactNode } from 'react'

// Homepage Redesign Phase 1 / Task 3: a small reusable floating-card shell
// for the hero graphics column. Positioning-agnostic -- LandingPage.tsx
// supplies exact placement (top/left/right/bottom) via `className`, plus an
// optional `style` (used for staggered reveal-animation delays) so this
// component stays a pure presentational shell, reusable for any future
// floating-card content.
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
      className={`absolute rounded-xl bg-[var(--navy-soft)] px-4 py-3 shadow-[var(--shadow)] ring-1 ring-white/10 ${className}`}
      style={style}
    >
      {children}
    </div>
  )
}
