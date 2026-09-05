// Hero fidelity round 9 (layout-only pass, ring construction is the one
// exception the owner explicitly called out): the owner wants the ring's
// visual construction improved -- segmented dial instead of a smooth
// continuous arc, muted inactive segments, green active segments, subtle
// depth -- WITHOUT moving its position and WITHOUT touching the shared
// `CircularProgress` component (that component renders the real
// Dashboard/Opportunity Engine progress rings elsewhere in the actual
// product; changing its fundamental visual construction for everyone
// wasn't asked for and risks an unrelated regression). This is a
// hero-only, purpose-built segmented ring instead.
//
// Segments are drawn as individual rounded-cap arcs (not a dashed
// stroke-based trick) so each one can be colored independently and the
// gap between segments stays visually even regardless of how many are
// active -- a `strokeDasharray` approach would need to fight the browser
// over where dashes land relative to the progress cutoff.
interface HeroFreshFitRingProps {
  value: number
  size: number
  strokeWidth: number
}

const SEGMENT_COUNT = 32
const GAP_DEGREES = 3.2

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle)
  const end = polarToCartesian(cx, cy, r, startAngle)
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1'
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`
}

export function HeroFreshFitRing({ value, size, strokeWidth }: HeroFreshFitRingProps) {
  const clamped = Math.max(0, Math.min(100, value))
  const radius = (size - strokeWidth) / 2
  const cx = size / 2
  const cy = size / 2
  const segmentSpan = 360 / SEGMENT_COUNT
  const arcSpan = segmentSpan - GAP_DEGREES
  const activeCount = Math.round((clamped / 100) * SEGMENT_COUNT)
  const glowId = `hero-ring-glow-${size}`

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0" aria-hidden="true">
      <defs>
        {/* Subtle depth -- a soft drop shadow under the whole dial plus a
            faint bright glow on the active segments so the ring reads as
            a lit dimensional dial rather than a flat ring of ticks. */}
        <filter id={glowId} x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="1.5" stdDeviation="2" floodColor="#000000" floodOpacity="0.45" />
        </filter>
      </defs>
      {/* Recessed backing disc -- gives the segmented dial a slight
          "sunken gauge" depth cue instead of floating flat on the glow
          behind it. */}
      <circle cx={cx} cy={cy} r={radius} fill="none" stroke="rgba(3,12,24,0.35)" strokeWidth={strokeWidth + 3} />
      <g filter={`url(#${glowId})`}>
        {Array.from({ length: SEGMENT_COUNT }, (_, i) => {
          const start = i * segmentSpan
          const end = start + arcSpan
          const isActive = i < activeCount
          return (
            <path
              key={i}
              d={describeArc(cx, cy, radius, start, end)}
              stroke={isActive ? '#7ee4b6' : 'rgba(148,163,184,0.28)'}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              fill="none"
            />
          )
        })}
      </g>
    </svg>
  )
}
