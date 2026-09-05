import { getFreshFitTier, FRESHFIT_TIER_STYLES } from '@/lib/freshFitScore'

/**
 * Shared FreshFit score badge -- single source of truth for the
 * score-color mapping that used to be duplicated as an inline
 * `scoreColor()` function in both OpportunityEnginePage.tsx and
 * StrategistOpportunityEnginePage.tsx (75/50 two-color cutoffs, drifting
 * independently). Works for both v1 and v2-scored matches since it only
 * needs the numeric score -- tier is always derived the same way.
 */
export function FreshFitBadge({ score }: { score: number }) {
  const tier = getFreshFitTier(score)
  return (
    <span
      className={`border px-2.5 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wide ${FRESHFIT_TIER_STYLES[tier]}`}
    >
      FreshFit {score}
    </span>
  )
}
