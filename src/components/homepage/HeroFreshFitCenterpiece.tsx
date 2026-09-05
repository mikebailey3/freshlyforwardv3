import { CircularProgress } from '@/components/CircularProgress'
import { getFreshFitTier, PRESENTATION_TIER_LABELS, DEFAULT_PRESENTATION_TIERS } from '@/lib/opportunityEngineTiers'

// Homepage Redesign Phase 1 / Task 3: the hero's FreshFit centerpiece.
//
// SAMPLE DATA ONLY -- this is a hand-authored marketing score, never wired
// to any real member's data. Reuses the real CircularProgress component
// (scaled via its `size` prop) and the real Opportunity Engine tier
// labels/thresholds (opportunityEngineTiers.ts) so the homepage never
// invents scoring language that diverges from the actual feature.
//
// Hard requirement carried over from ForwardScoreWidget.tsx's same
// constraint: never caption this with "hiring probability", "salary
// potential"/"guaranteed salary", "employer", "human worth", or "objective
// prediction" language -- it's a directional fit snapshot, same framing as
// the real Forward Score and FreshFit.
//
// `size`: owner checkpoint round 1 added this so the tablet composition
// can reuse the same component at a smaller footprint instead of a
// duplicate implementation -- compact padding/text kick in automatically
// below 150px.
const SAMPLE_SCORE = 82

export function HeroFreshFitCenterpiece({ size = 168 }: { size?: number }) {
  const tier = getFreshFitTier(SAMPLE_SCORE)
  const tierLabel = PRESENTATION_TIER_LABELS[tier]
  const compact = size < 150

  return (
    <div className="relative flex flex-col items-center gap-1.5">
      {/* Soft radial glow behind the ring instead of a boxed card -- matches
          the North Star's floating centerpiece treatment. */}
      <div
        className="absolute left-1/2 top-1/2 -z-10 h-[140%] w-[140%] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-60 blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(126,228,182,0.35) 0%, rgba(10,26,45,0) 70%)' }}
        aria-hidden="true"
      />
      <p className={`font-mono font-semibold uppercase tracking-wide text-[#7ee4b6] ${compact ? 'text-[10px]' : 'text-[11px]'}`}>
        FreshFit Score
      </p>
      <CircularProgress
        value={SAMPLE_SCORE}
        size={size}
        strokeWidth={compact ? 9 : 12}
        suffix=""
        label={tierLabel}
        tierThresholds={{ success: DEFAULT_PRESENTATION_TIERS.highest, warning: DEFAULT_PRESENTATION_TIERS.stronger }}
      />
      <p className={`text-center font-mono uppercase tracking-wide text-[#7ee4b6]/70 ${compact ? 'text-[9px]' : 'text-[10px]'}`}>
        Sample
      </p>
    </div>
  )
}
