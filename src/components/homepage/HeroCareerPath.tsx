// Homepage North Star fidelity pass, Hero Redesign (round 2 -- clarity
// pass): the hero's career-path graphic, rebuilt after owner feedback that
// round 1 read as "an abstract cluster of elements," not a clear career
// journey. Round 1's problems, diagnosed from an actual close-up
// screenshot rather than guessed from code:
//   1. The path had a confusing extra branch/loop with no clear single
//      direction.
//   2. The human figure was a tiny, featureless blob sitting in empty
//      space well below the path's start point -- visually disconnected
//      from the journey it's supposed to be walking.
//   3. The path itself was thin and low-contrast against the navy
//      background, hard to trace at a glance.
//
// This version is ONE continuous, bold, high-contrast curve with an
// unambiguous direction: person (bottom-left) -> rises past the FreshFit
// ring (the centerpiece, rendered separately by LandingPage.tsx, floating
// above this path's midpoint) -> arrives at a clearly-marked destination
// node (top-right) where the "Top Opportunity" floating card anchors. The
// human figure is bigger, simplified but readable (round head, shoulders,
// body), and its shoulder is the path's literal start coordinate -- no gap,
// no ambiguity about what it's connected to.
export function HeroCareerPath({ className = '', simplified = false }: { className?: string; simplified?: boolean }) {
  // Person's shoulder (path start) -> rises past the ring -> destination
  // node (path end, top-right, where the Top Opportunity card anchors).
  // start.y is deliberately kept well clear of the viewBox's y=420 floor:
  // an earlier version placed it at y=385, which combined with the bigger
  // figure's ~70-unit height meant the figure's feet extended to y=439 --
  // past the viewBox edge, so they were silently clipped (SVG's default
  // overflow:hidden). Confirmed via a real screenshot, not guessed.
  const start = simplified ? { x: 45, y: 250 } : { x: 55, y: 360 }
  const end = simplified ? { x: 240, y: 40 } : { x: 275, y: 55 }
  const d = simplified
    ? 'M 45 250 C 70 200, 110 168, 150 140 C 180 118, 205 88, 240 40'
    : 'M 55 360 C 90 300, 140 255, 180 210 C 210 172, 240 115, 275 55'

  const suffix = simplified ? 'simplified' : 'full'
  const gradientId = `hero-path-gradient-${suffix}`
  const glowId = `hero-path-glow-${suffix}`

  return (
    <svg className={className} viewBox="0 0 320 420" preserveAspectRatio="none" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1={start.x} y1={start.y} x2={end.x} y2={end.y} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#5b8cb8" />
          <stop offset="1" stopColor="#7ee4b6" />
        </linearGradient>
        {/* Stronger glow than round 1 (higher opacity, wider blur) -- the
            owner's core complaint was that things felt "too faint." */}
        <filter id={glowId} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Glow layer. */}
      <path d={d} stroke={`url(#${gradientId})`} strokeWidth="14" strokeLinecap="round" opacity="0.5" filter={`url(#${glowId})`} />

      {/* Crisp foreground stroke -- visibly thicker than round 1 (5px -> 7px)
          so the eye can trace it at a glance instead of hunting for a thin
          dashed line. */}
      <path
        className="hero-path-line"
        d={d}
        stroke={`url(#${gradientId})`}
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray="3 13"
      />

      {/* Start node at the person's shoulder -- makes the "path begins
          exactly at the person" connection explicit instead of implied. */}
      <circle cx={start.x} cy={start.y} r="6" fill="#7ee4b6" />

      {/* Destination node + short continuation + arrowhead, all tightly
          clustered (round 1's arrow over-extended and drifted into
          unrelated space) -- this reads as "the path arrives HERE." */}
      <circle cx={end.x} cy={end.y} r="16" stroke="#7ee4b6" strokeOpacity="0.55" strokeWidth="2.5" />
      <circle cx={end.x} cy={end.y} r="9" fill="#7ee4b6" />
      <path
        d={simplified ? 'M 240 40 L 254 22' : 'M 275 55 L 289 37'}
        stroke="#7ee4b6"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d={simplified ? 'M 246 20 L 254 22 L 252 30' : 'M 281 35 L 289 37 L 287 45'}
        stroke="#7ee4b6"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Human figure -- bigger and clearer than round 1 (a distinct round
          head + shoulders + body, not an ambiguous blob), anchored exactly
          at the path's start node so it reads as "this person is walking
          this path," not "a shape floating near a path." Translated up by
          32 (not 8) so the body's full height stays inside the viewBox --
          see the start-coordinate comment above for why that matters. */}
      <g transform={`translate(${start.x - 20}, ${start.y - 32})`}>
        <circle cx="20" cy="10" r="11" fill="#e4ecf3" />
        <path d="M 4 62 C 4 34, 8 18, 20 18 C 32 18, 36 34, 36 62 Z" fill="#e4ecf3" />
      </g>
    </svg>
  )
}
