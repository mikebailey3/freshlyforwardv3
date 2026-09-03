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
    <div
      className={`flex flex-col items-center gap-3 rounded-[var(--radius)] bg-[var(--navy-soft)] shadow-[var(--shadow)] ${compact ? 'p-5' : 'p-8'}`}
    >
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
      <p className={`text-center text-[#bac8d6] ${compact ? 'max-w-[160px] text-[11px]' : 'max-w-[220px] text-xs'}`}>
        A directional snapshot of how well a role fits you right now -- illustrative sample, not live data.
      </p>
    </div>
  )
}
