// Homepage North Star fidelity pass, Hero Redesign round 6: FOCUSED
// literal fidelity rebuild against the actual reference image
// (public/images/A63B5E0B-0AE1-4D9A-B05D-9C52403721C7.png). Round 5 grew
// card density and moved FreshFit inward, but the owner still called the
// result a "wireframe/constellation" -- thin dashed connector lines
// reading as a network diagram rather than a single cohesive glowing
// journey path, and a path shape too gentle compared to the reference's
// visibly winding, multi-node curve.
//
// This round removes the dashed card-to-card connector network entirely
// (the owner's explicit instruction: "not a network diagram") and
// replaces the single-bezier-through-4-points path with a proper
// multi-point Catmull-Rom spline through 6 waypoints, giving it the
// reference's genuine winding/switchback quality without hand-tuning six
// pairs of bezier control points by feel.
//
// Round 8 (bounded visual-refinement pass): rebuilt the path rendering as
// three solid layers -- a wide soft outer glow, a tighter mid glow, and a
// solid (non-dashed) bright core -- all sharing one gradient that runs
// white/pale-blue at the person's feet through the brand green and into a
// warm yellow-green near the arrow.
//
// Round 9 (layout-only pass): the owner's audit called the card
// *positions* asymmetric -- 4 cards hugging the far-left edge, 4 cards
// spread further right with a lot of empty space past them, rather than a
// balanced spread on both sides of the ring. `freshFit` and `person` stay
// exactly where round 6 put them (not touched, per the owner's explicit
// "do not move the ring" instruction) -- only the 8 card anchors below
// were recomputed as genuine left/right mirror pairs (using the
// composition's own horizontal center as the mirror axis, accounting for
// every card now sharing one fixed width -- see HeroFloatingCard.tsx),
// with matching row heights on both sides for an even top-to-bottom
// rhythm instead of the old staggered values.
export interface JourneyPoint {
  x: number
  y: number
}

export const desktopJourneyNodes = {
  freshFit: { x: 38, y: 44 } as JourneyPoint,
  person: { x: 34, y: 92 } as JourneyPoint,
  // Card anchor points -- round 9 mirror pairs (left column x + right
  // column x sum to ~74, accounting for the shared 160px/~26%-of-container
  // card width, so left and right cards sit equidistant from the
  // composition's own center rather than from the off-center ring).
  topOpportunity: { x: -1, y: 1 } as JourneyPoint,
  careerVault: { x: 75, y: 1 } as JourneyPoint,
  searchReadiness: { x: 1, y: 34 } as JourneyPoint,
  applications: { x: 73, y: 34 } as JourneyPoint,
  skillGap: { x: 1, y: 58 } as JourneyPoint,
  nextMilestone: { x: 73, y: 58 } as JourneyPoint,
  goalProgress: { x: 0, y: 78 } as JourneyPoint,
  strategistSupport: { x: 63, y: 81 } as JourneyPoint,
}

// The path's own waypoints -- deliberately more numerous/winding than the
// card anchors above (the reference's path visibly changes direction
// several times, independent of exactly where each card sits). Unchanged
// from round 6/8 -- round 9 is a card-layout-only pass.
const desktopPathPoints: JourneyPoint[] = [
  { x: 34, y: 92 },
  { x: 44, y: 76 },
  { x: 52, y: 58 },
  { x: 62, y: 44 },
  { x: 72, y: 28 },
  { x: 90, y: 8 },
]

export const tabletJourneyNodes = {
  freshFit: { x: 50, y: 42 } as JourneyPoint,
  person: { x: 16, y: 80 } as JourneyPoint,
}

const tabletPathPoints: JourneyPoint[] = [
  { x: 16, y: 80 },
  { x: 34, y: 62 },
  { x: 55, y: 48 },
  { x: 92, y: 10 },
]

// Catmull-Rom-to-cubic-Bezier conversion -- gives a smooth curve through
// an arbitrary number of waypoints without hand-tuning control points per
// segment (DRY: one spline function serves both the winding desktop path
// and the simpler tablet one).
function splineD(points: JourneyPoint[]): string {
  if (points.length < 2) return ''
  const d: string[] = [`M ${points[0].x} ${points[0].y}`]
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] ?? p2
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 }
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 }
    d.push(`C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${p2.x} ${p2.y}`)
  }
  return d.join(' ')
}

// Stylized "person moving forward" pictogram -- lightweight SVG shapes,
// never a stock photo. Round 9: the owner's audit still called this "an
// icon" even after round 8's width bump -- a single silhouette outline
// reads flat regardless of limb thickness. Rebuilt with clearly separate
// front/back arms and front/back legs (a real walking gait has one of
// each visible on both sides, not a single central leg-split), a
// distinct neck, a tapered chest-to-waist torso for actual proportions,
// and a two-stop diagonal gradient fill instead of flat white so the
// surface reads as dimensional/lit rather than a flat cutout.
function WalkingFigure({ at, scale, glowId, fillId }: { at: JourneyPoint; scale: number; glowId: string; fillId: string }) {
  const fill = `url(#${fillId})`
  return (
    <g transform={`translate(${at.x}, ${at.y}) scale(${scale})`} filter={`url(#${glowId})`}>
      {/* Head */}
      <circle cx="0" cy="-39" r="9" fill={fill} />
      {/* Neck */}
      <rect x="-3.5" y="-31" width="7" height="5" rx="1.5" fill={fill} />
      {/* Torso -- broader shoulders tapering to waist for real proportions */}
      <path d="M -12 -26 C -14 -15, -12 -3, -7 8 L 7 8 C 12 -3, 14 -15, 12 -26 C 6 -30, -6 -30, -12 -26 Z" fill={fill} />
      {/* Back arm (trailing behind the body) */}
      <path d="M -9 -23 L -20 -9 L -15 -4 L -6 -18 Z" fill={fill} opacity="0.82" />
      {/* Front arm (swinging forward) */}
      <path d="M 8 -21 L 20 -8 L 16 -3 L 5 -16 Z" fill={fill} />
      {/* Back leg (trailing, straighter) */}
      <path d="M -6 6 L -13 30 L -6 34 L 0 8 Z" fill={fill} opacity="0.88" />
      {/* Front leg (stepping forward) -- a simple non-self-intersecting
          quad (a 6-point bent-knee version tried earlier self-intersected
          into a bowtie/shard shape instead of a leg -- see git history --
          so this stays a clean tapered quad like the back leg, just
          reaching further forward for the walking stance). */}
      <path d="M 5 6 L 18 26 L 12 30 L 1 10 Z" fill={fill} />
    </g>
  )
}

export function HeroCareerPath({ className = '', simplified = false }: { className?: string; simplified?: boolean }) {
  const points = simplified ? tabletPathPoints : desktopPathPoints
  const person = simplified ? tabletJourneyNodes.person : desktopJourneyNodes.person
  const destination = points[points.length - 1]
  const d = splineD(points)
  const suffix = simplified ? 'simplified' : 'full'
  const gradientId = `hero-path-gradient-${suffix}`
  const glowId = `hero-path-glow-${suffix}`
  const softGlowId = `hero-path-soft-glow-${suffix}`
  const nodeGlowId = `hero-node-glow-${suffix}`
  const figureGlowId = `hero-figure-glow-${suffix}`
  const figureFillId = `hero-figure-fill-${suffix}`

  // Arrowhead direction -- derived from the last two waypoints so it
  // points along the path's actual final heading rather than a fixed
  // angle.
  const prev = points[points.length - 2] ?? destination
  const angle = Math.atan2(destination.y - prev.y, destination.x - prev.x)
  const arrowLength = 5.5
  const arrowSpread = 0.5
  const tip = { x: destination.x + Math.cos(angle) * 1.5, y: destination.y + Math.sin(angle) * 1.5 }
  const left = {
    x: tip.x - arrowLength * Math.cos(angle - arrowSpread),
    y: tip.y - arrowLength * Math.sin(angle - arrowSpread),
  }
  const right = {
    x: tip.x - arrowLength * Math.cos(angle + arrowSpread),
    y: tip.y - arrowLength * Math.sin(angle + arrowSpread),
  }

  return (
    <svg className={className} viewBox="0 0 100 100" preserveAspectRatio="none" fill="none" aria-hidden="true">
      <defs>
        {/* White/pale-blue at the person's feet, warming through the
            brand green and into a warm yellow-green near the arrow --
            "stronger brightness toward the upper-right" per the North
            Star reference. */}
        <linearGradient id={gradientId} x1={person.x} y1={person.y} x2={destination.x} y2={destination.y} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#dbe9f7" />
          <stop offset="0.45" stopColor="#7ee4b6" />
          <stop offset="1" stopColor="#e8f28c" />
        </linearGradient>
        {/* Round 9: subtle dimensional fill for the walking figure --
            near-white catching the light, soft blue-gray in shadow. */}
        <linearGradient id={figureFillId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#c7d6e6" />
        </linearGradient>
        <filter id={glowId} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="3.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id={softGlowId} x="-120%" y="-120%" width="340%" height="340%">
          <feGaussianBlur stdDeviation="1.6" />
        </filter>
        <filter id={nodeGlowId} x="-200%" y="-200%" width="500%" height="500%">
          <feGaussianBlur stdDeviation="1.2" />
        </filter>
        <filter id={figureGlowId} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="1.8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Three solid layers -- wide soft glow, tighter glow, bright solid
          core -- ONE cohesive glowing journey illustration, no separate
          dashed card-to-card connector network and no dashing on the
          core line itself. */}
      <path d={d} stroke={`url(#${gradientId})`} strokeWidth="5.5" strokeLinecap="round" opacity="0.35" filter={`url(#${softGlowId})`} vectorEffect="non-scaling-stroke" />
      <path d={d} stroke={`url(#${gradientId})`} strokeWidth="3.2" strokeLinecap="round" opacity="0.6" filter={`url(#${glowId})`} vectorEffect="non-scaling-stroke" />
      <path className="hero-path-line" d={d} stroke={`url(#${gradientId})`} strokeWidth="1.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />

      {/* Milestone nodes along the path (4-6 visible per the owner's spec,
          counting the person and the arrow as the first/last): the person
          marks the start, FreshFit (rendered by LandingPage.tsx on top of
          this SVG) is embedded mid-path, and larger glowing dots mark 2-3
          more waypoints, ending in an upward arrowhead instead of a plain
          dot. */}
      {!simplified &&
        points.slice(1, -1).map((point, i) => (
          <g key={i}>
            <circle cx={point.x} cy={point.y} r="2.6" fill="#7ee4b6" opacity="0.45" filter={`url(#${nodeGlowId})`} />
            <circle cx={point.x} cy={point.y} r="1.7" fill="#eef9f1" />
          </g>
        ))}
      <path d={`M ${left.x} ${left.y} L ${tip.x} ${tip.y} L ${right.x} ${right.y}`} stroke="#e8f28c" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" filter={`url(#${glowId})`} vectorEffect="non-scaling-stroke" />

      <WalkingFigure at={person} scale={simplified ? 0.16 : 0.24} glowId={figureGlowId} fillId={figureFillId} />
    </svg>
  )
}
