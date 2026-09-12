import { AlertTriangle } from 'lucide-react'

/**
 * Shared "this match has a confirmed hard-constraint blocker" indicator.
 * One visual/textual vocabulary for "needs a closer look" everywhere in
 * the Opportunity Engine -- the strategist grid (OE 2.0 Phase 3) and the
 * member-facing Top Opportunities feed (Phase 4) both render exactly this,
 * rather than each surface inventing its own copy/styling for the same
 * underlying `hasHardBlocker()` signal.
 */
export function NeedsReviewBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-warning-700 bg-warning-950 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-warning-300">
      <AlertTriangle className="h-3 w-3" />
      Needs review
    </span>
  )
}
