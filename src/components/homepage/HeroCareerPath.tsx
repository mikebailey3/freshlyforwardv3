import type { CSSProperties } from 'react'

// Homepage Redesign Phase 1 / Task 3: the hero's decorative "upward,
// winding, glowing" career path, plus a small human-figure silhouette
// placed along it. Both are pure decoration (aria-hidden) -- static for
// Phase 1, no data props needed yet. Kept together in one file since
// they're visually one composed graphic, not two independently reusable
// pieces. `style` is accepted on the silhouette for the staggered
// reveal-animation delay applied by LandingPage.tsx.
export function HeroCareerPath({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 320 420"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="hero-path-gradient" x1="40" y1="400" x2="280" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#1a3a5c" />
          <stop offset="1" stopColor="#7ee4b6" />
        </linearGradient>
      </defs>
      <path
        d="M 40 400 C 90 340, 60 280, 120 250 C 180 220, 150 160, 210 130 C 250 110, 240 70, 280 30"
        stroke="url(#hero-path-gradient)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="2 10"
      />
      <circle cx="280" cy="30" r="7" fill="#7ee4b6" />
      <circle cx="280" cy="30" r="12" stroke="#7ee4b6" strokeOpacity="0.4" strokeWidth="2" />
    </svg>
  )
}

export function HeroFigureSilhouette({
  className = '',
  style,
}: {
  className?: string
  style?: CSSProperties
}) {
  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 60 100"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="30" cy="16" r="12" fill="#bac8d6" fillOpacity="0.35" />
      <path
        d="M 10 100 C 10 65, 14 45, 30 45 C 46 45, 50 65, 50 100 Z"
        fill="#bac8d6"
        fillOpacity="0.35"
      />
    </svg>
  )
}
