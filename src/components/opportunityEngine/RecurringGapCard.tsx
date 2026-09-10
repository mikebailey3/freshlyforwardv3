import { Link } from 'react-router-dom'
import { Target } from 'lucide-react'
import type { RecurringGap } from '@/lib/opportunityEngine/recurringGaps'

// Beyond the headline gap, name at most this many more -- a wall of
// skill names reads as noise, not insight.
const MAX_ADDITIONAL_GAPS_NAMED = 2

/**
 * OE 2.0 Phase 6 -- "you keep missing X" insight card. Renders nothing
 * (never a fabricated/empty card) unless `gaps` already contains at
 * least one recurring, confirmed skill gap -- see
 * `recurringGaps.ts::getRecurringGaps` for how that list is computed
 * and why it can never include Unknown/missing evidence, only confirmed
 * gaps that showed up more than once.
 */
export function RecurringGapCard({ gaps }: { gaps: RecurringGap[] }) {
  if (gaps.length === 0) return null

  const [topGap, ...rest] = gaps
  const otherGapNames = rest.slice(0, MAX_ADDITIONAL_GAPS_NAMED).map((g) => g.skill)

  return (
    <div className="mb-8 rounded-2xl border border-border bg-surface-card p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary-950">
          <Target className="h-5 w-5 text-primary-500" />
        </div>
        <div>
          <p className="font-display text-sm font-semibold text-ink">
            You keep missing &ldquo;{topGap.skill}&rdquo;
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            This showed up as a confirmed gap in {topGap.frequency} of your recent matches
            {otherGapNames.length > 0 && <> -- along with {otherGapNames.join(', ')}</>}.
            Adding evidence to your Forward DNA could open up more strong matches.
          </p>
          <Link
            to="/forward-dna"
            className="mt-3 inline-block font-mono text-xs font-medium text-primary-600 hover:text-primary-400"
          >
            Add skill evidence to Forward DNA
          </Link>
        </div>
      </div>
    </div>
  )
}
