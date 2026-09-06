import { getFreshFitTier, FRESHFIT_TIER_LABELS, FRESHFIT_TIER_STYLES } from '@/lib/freshFitScore/tiers'

export interface FreshFitBadgeProps {
  score: number
}

/** Thin presentational wrapper over the existing FreshFit tier utilities --
 * reuses the same thresholds/labels/styles as the Opportunity Engine pages
 * so the homepage never drifts out of sync with the real scoring tiers. */
export function FreshFitBadge({ score }: FreshFitBadgeProps) {
  const tier = getFreshFitTier(score)
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-xs font-semibold ${FRESHFIT_TIER_STYLES[tier]}`}
    >
      FreshFit {score} &middot; {FRESHFIT_TIER_LABELS[tier]}
    </span>
  )
}
