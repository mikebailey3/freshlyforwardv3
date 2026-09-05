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
//
// Round 8 (bounded visual-refinement pass, coordinates/positions from
// round 6 are UNCHANGED -- only stroke/fill treatment below is new): the
// owner's side-by-side audit called the path "still too thin/simple."
// Turned out the "crisp foreground" line still carried a leftover
// strokeDasharray from an earlier iteration, making the whole path read
// as dotted/thin no matter how bright the glow layer under it was.
// Rebuilt the rendering as three solid layers -- a wide soft outer glow,
// a tighter mid glow, and a solid (non-dashed) bright core -- all sharing
// one gradient that runs white/pale-blue at the person's feet through the
// brand green and into a warm yellow-green near the arrow, so the path
// visibly brightens toward the upper-right exactly like the reference.
// Waypoint dots grew and picked up their own small glow; the arrowhead
// grew and now uses the gradient's warm end color instead of flat green.
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
// Round 8: bulked up torso/limb widths (a "flat vector pictogram" reads
// as thinner than the reference's more illustrated figure) and added a
// soft glow filter behind it so it visually integrates with the path's
// own glow treatment instead of sitting as a flat white cutout.
function WalkingFigure({ at, scale, glowId }: { at: JourneyPoint; scale: number; glowId: string }) {
  return (
    <g transform={`translate(${at.x}, ${at.y}) scale(${scale})`} filter={`url(#${glowId})`}>
      <circle cx="0" cy="-35" r="9.5" fill="#eef4fa" />
      <path
        d="M -9 -25 C -11.5 -9, -10 4, -5 12 L 5 12 C 7.5 1, 9 -13, 11 -25 C 5 -30, -4 -30, -9 -25 Z"
        fill="#eef4fa"
      />
      <path d="M -5 10 L -16 32 L -8 36 L 1 12 Z" fill="#eef4fa" />
      <path d="M 5 10 L 16 26 L 10 30 L 1 12 Z" fill="#eef4fa" />
      <path d="M 7 -21 L 18 -10 L 14 -5 L 4 -17 Z" fill="#eef4fa" opacity="0.92" />
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
          core line itself (round 6 had accidentally left a
          strokeDasharray on the "crisp" layer, which read as thin/dotted
          no matter how strong the glow underneath was). */}
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

      <WalkingFigure at={person} scale={simplified ? 0.16 : 0.24} glowId={figureGlowId} />
    </svg>
  )
}
