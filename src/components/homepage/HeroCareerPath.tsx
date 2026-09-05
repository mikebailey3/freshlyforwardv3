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
// pairs of bezier control points by feel. Coordinates were measured
// directly from the reference image (its hero graphic cluster treated as
// its own 0-100% coordinate box):
//   - FreshFit ring center ~(38, 44) -- center-left of the cluster.
//   - The path starts at the person's feet (~34, 92), winds up past the
//     ring's right side, and exits top-right with an arrowhead (~90, 8).
//   - 8 card slots, matching the reference's own layout roles (see
//     `desktopJourneyNodes`' named anchors below) -- LandingPage.tsx
//     renders the actual card content at these coordinates.
export interface JourneyPoint {
  x: number
  y: number
}

export const desktopJourneyNodes = {
  freshFit: { x: 38, y: 44 } as JourneyPoint,
  person: { x: 34, y: 92 } as JourneyPoint,
  // Card anchor points -- measured from the reference's own layout slots.
  topOpportunity: { x: 1, y: 2 } as JourneyPoint,
  careerVault: { x: 53, y: 2 } as JourneyPoint,
  searchReadiness: { x: 0, y: 36 } as JourneyPoint,
  skillGap: { x: 1, y: 58 } as JourneyPoint,
  goalProgress: { x: 12, y: 83 } as JourneyPoint,
  applications: { x: 68, y: 28 } as JourneyPoint,
  nextMilestone: { x: 68, y: 55 } as JourneyPoint,
  strategistSupport: { x: 53, y: 78 } as JourneyPoint,
}

// The path's own waypoints -- deliberately more numerous/winding than the
// card anchors above (the reference's path visibly changes direction
// several times, independent of exactly where each card sits).
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

// Stylized "person moving forward" pictogram -- a leaning torso + a
// mid-stride leg split + one forward-swinging arm reads as motion, not a
// generic avatar icon. Large enough to matter in the composition (per the
// owner's explicit round-6 requirement) while staying secondary to the
// dashboard cards, not dominating them.
function WalkingFigure({ at, scale }: { at: JourneyPoint; scale: number }) {
  return (
    <g transform={`translate(${at.x}, ${at.y}) scale(${scale})`}>
      <circle cx="0" cy="-34" r="8" fill="#e4ecf3" />
      <path
        d="M -7 -24 C -9 -10, -8 2, -4 10 L 4 10 C 6 0, 7 -12, 9 -24 C 4 -28, -3 -28, -7 -24 Z"
        fill="#e4ecf3"
      />
      <path d="M -4 8 L -14 30 L -8 33 L 0 10 Z" fill="#e4ecf3" />
      <path d="M 4 8 L 14 24 L 9 28 L 0 10 Z" fill="#e4ecf3" />
      <path d="M 6 -20 L 16 -10 L 13 -6 L 4 -16 Z" fill="#e4ecf3" opacity="0.9" />
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

  // Arrowhead direction -- derived from the last two waypoints so it
  // points along the path's actual final heading rather than a fixed
  // angle.
  const prev = points[points.length - 2] ?? destination
  const angle = Math.atan2(destination.y - prev.y, destination.x - prev.x)
  const arrowLength = 4.5
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
        <linearGradient id={gradientId} x1={person.x} y1={person.y} x2={destination.x} y2={destination.y} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#5b8cb8" />
          <stop offset="1" stopColor="#7ee4b6" />
        </linearGradient>
        {/* Restrained but obvious glow -- the reference's path is one of
            the hero's dominant visual elements, not a faint connector. */}
        <filter id={glowId} x="-70%" y="-70%" width="240%" height="240%">
          <feGaussianBlur stdDeviation="2.4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Glow layer, then the crisp foreground line -- ONE cohesive
          journey illustration, no separate dashed card-to-card connector
          network. */}
      <path d={d} stroke={`url(#${gradientId})`} strokeWidth="2.6" strokeLinecap="round" opacity="0.5" filter={`url(#${glowId})`} vectorEffect="non-scaling-stroke" />
      <path className="hero-path-line" d={d} stroke={`url(#${gradientId})`} strokeWidth="1.1" strokeLinecap="round" strokeDasharray="0.6 2.2" vectorEffect="non-scaling-stroke" />

      {/* Milestone nodes along the path (4-6 visible per the owner's spec,
          counting the person and the arrow as the first/last): the person
          marks the start, FreshFit (rendered by LandingPage.tsx on top of
          this SVG) is embedded mid-path, and small dots mark 2-3 more
          waypoints, ending in an upward arrowhead instead of a plain dot. */}
      {!simplified &&
        points.slice(1, -1).map((point, i) => (
          <circle key={i} cx={point.x} cy={point.y} r="1.4" fill="#7ee4b6" />
        ))}
      <path d={`M ${left.x} ${left.y} L ${tip.x} ${tip.y} L ${right.x} ${right.y}`} stroke="#7ee4b6" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />

      <WalkingFigure at={person} scale={simplified ? 0.16 : 0.24} />
    </svg>
  )
}
