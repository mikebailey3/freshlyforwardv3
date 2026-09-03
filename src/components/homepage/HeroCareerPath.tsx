// Homepage Redesign Phase 1 / Task 3 revision (owner checkpoint round 2):
// the hero's career-path graphic.
//
// Round 1 added glow/nodes/animation but the path was nearly invisible.
// Round 2's first attempt fixed a letterboxing bug (missing
// preserveAspectRatio), then a second attempt fixed a margin-conflict
// (path hugging space already claimed by floating cards), shortening the
// path to the genuinely open area below the FreshFit card.
//
// Neither fix actually made anything visible, because of a THIRD, real
// bug found via DOM inspection: adding the `simplified` tablet variant
// means two <HeroCareerPath> SVGs render simultaneously (one hidden via
// CSS `lg:hidden`/`hidden lg:block`, not conditional rendering, to match
// this codebase's existing responsive pattern) -- and both defined
// <linearGradient id="hero-path-gradient"> and <filter id="hero-path-glow">
// with the SAME id. Duplicate ids are invalid HTML/SVG; `url(#id)`
// resolves to the first match in the whole document, and when that first
// match lives inside a `display:none` instance, Chromium silently refuses
// to paint the gradient/filter on the *other*, visible instance. The path
// had correct geometry (confirmed via getBoundingClientRect) but zero
// visible stroke -- a real rendering bug, not a styling nit. Fixed by
// suffixing both ids per variant so there's no collision.
//
// The path now leads from the human figure directly up into the bottom of
// the FreshFit card -- "person -> path -> FreshFit" -- fully visible
// against open navy space instead of fighting the other floating cards
// for room.
export function HeroCareerPath({ className = '', simplified = false }: { className?: string; simplified?: boolean }) {
  const d = simplified
    ? 'M 60 405 C 50 365, 75 335, 110 320 C 140 308, 165 300, 190 290'
    : 'M 70 410 C 55 360, 90 320, 130 300 C 160 288, 180 280, 205 270'

  const start = simplified ? { x: 60, y: 405 } : { x: 70, y: 410 }
  const end = simplified ? { x: 190, y: 290 } : { x: 205, y: 270 }

  const suffix = simplified ? 'simplified' : 'full'
  const gradientId = `hero-path-gradient-${suffix}`
  const glowId = `hero-path-glow-${suffix}`

  return (
    <svg className={className} viewBox="0 0 320 420" preserveAspectRatio="none" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1={start.x} y1={start.y} x2={end.x} y2={end.y} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3a5f82" />
          <stop offset="1" stopColor="#7ee4b6" />
        </linearGradient>
        {/* Moderate blur, kept subtle -- premium glow, not a neon effect. */}
        <filter id={glowId} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Glow layer: wide, soft, duplicate of the same path. */}
      <path d={d} stroke={`url(#${gradientId})`} strokeWidth="10" strokeLinecap="round" opacity="0.55" filter={`url(#${glowId})`} />

      {/* Crisp foreground stroke, with an upward-flowing dash animation
          (see .hero-path-line in index.css -- respects prefers-reduced-motion
          via the existing app-wide animation-duration override). */}
      <path className="hero-path-line" d={d} stroke={`url(#${gradientId})`} strokeWidth="5" strokeLinecap="round" strokeDasharray="3 11" />

      {/* Destination node -- where the path arrives at the FreshFit card,
          emphasized (bigger, ringed) to read as "progress toward a
          milestone" rather than a flat dotted line. */}
      <circle cx={end.x} cy={end.y} r="15" stroke="#7ee4b6" strokeOpacity="0.5" strokeWidth="2" />
      <circle cx={end.x} cy={end.y} r="9" fill="#7ee4b6" />

      {/* Human figure -- standing at the path's starting node, small and
          supporting (never the focal point). Same coordinate space as the
          path itself, so it's guaranteed to sit on it rather than drift. */}
      <g transform={`translate(${start.x - 15}, ${start.y - 48})`} opacity="0.9">
        <circle cx="15" cy="10" r="9" fill="#d7e3ee" />
        <path d="M 3 48 C 3 24, 6 12, 15 12 C 24 12, 27 24, 27 48 Z" fill="#d7e3ee" />
      </g>
    </svg>
  )
}
