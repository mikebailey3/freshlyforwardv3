// Homepage Redesign Phase 1 / Task 3 revision (owner checkpoint round 1):
// the hero's career-path graphic, now with a real glow treatment, node
// emphasis, and an upward-flow cue -- plus the human figure integrated
// directly into the same SVG coordinate space (standing at the path's
// starting node) instead of floating as a disconnected sibling element.
// One cohesive graphic, one source of truth for coordinates -- that's why
// the figure is composed inline here rather than exported separately.
//
// `simplified`: a shorter path with fewer nodes, used at tablet widths
// (md-lg) per the owner's requirement that tablet keep a simplified
// version of the graphic rather than hiding it entirely. Desktop (lg+)
// gets the full path.
export function HeroCareerPath({ className = '', simplified = false }: { className?: string; simplified?: boolean }) {
  const d = simplified
    ? 'M 40 400 C 90 330, 140 260, 200 180 C 230 140, 250 90, 280 30'
    : 'M 40 400 C 90 340, 60 280, 120 250 C 180 220, 150 160, 210 130 C 250 110, 240 70, 280 30'

  const nodes = simplified
    ? [{ x: 40, y: 400 }, { x: 280, y: 30 }]
    : [{ x: 40, y: 400 }, { x: 120, y: 250 }, { x: 210, y: 130 }, { x: 280, y: 30 }]

  const start = nodes[0]
  const end = nodes[nodes.length - 1]

  return (
    <svg className={className} viewBox="0 0 320 420" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="hero-path-gradient" x1="40" y1="400" x2="280" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2a4a6c" />
          <stop offset="1" stopColor="#7ee4b6" />
        </linearGradient>
        {/* Moderate blur, kept subtle -- premium glow, not a neon effect. */}
        <filter id="hero-path-glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Glow layer: wide, soft, low-opacity duplicate of the same path. */}
      <path d={d} stroke="url(#hero-path-gradient)" strokeWidth="7" strokeLinecap="round" opacity="0.4" filter="url(#hero-path-glow)" />

      {/* Crisp foreground stroke, with an upward-flowing dash animation
          (see .hero-path-line in index.css -- respects prefers-reduced-motion
          via the existing app-wide animation-duration override). */}
      <path className="hero-path-line" d={d} stroke="url(#hero-path-gradient)" strokeWidth="3.5" strokeLinecap="round" strokeDasharray="3 11" />

      {/* Waypoint nodes -- mid-path nodes are quieter, the destination node
          is emphasized (bigger, ringed) to read as "progress toward a
          milestone" rather than a flat dotted line. */}
      {nodes.map((node, index) => {
        const isEnd = node === end
        return (
          <g key={`${node.x}-${node.y}`}>
            {isEnd && <circle cx={node.x} cy={node.y} r="14" stroke="#7ee4b6" strokeOpacity="0.45" strokeWidth="2" />}
            <circle cx={node.x} cy={node.y} r={isEnd ? 8 : 5} fill={isEnd ? '#7ee4b6' : '#bfead2'} fillOpacity={isEnd ? 1 : 0.8} />
          </g>
        )
      })}

      {/* Human figure -- standing at the path's starting node, small and
          supporting (never the focal point). Same coordinate space as the
          path itself, so it's guaranteed to sit on it rather than drift. */}
      <g transform={`translate(${start.x - 15}, ${start.y - 48})`} opacity="0.85">
        <circle cx="15" cy="10" r="9" fill="#bac8d6" />
        <path d="M 3 48 C 3 24, 6 12, 15 12 C 24 12, 27 24, 27 48 Z" fill="#bac8d6" />
      </g>
    </svg>
  )
}
