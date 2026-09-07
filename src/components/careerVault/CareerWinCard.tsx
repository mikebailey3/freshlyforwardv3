import { Fragment } from 'react'
import { Trash2 } from 'lucide-react'
import type { CareerWinWithCapabilities } from '@/lib/careerVault/careerWins'

interface CareerWinCardProps {
  careerWin: CareerWinWithCapabilities
  /** Omit for read-only rendering (e.g. the strategist workspace tab) -- only the member's own page passes this. */
  onDelete?: () => void
}

// Once Task 9 renders these in a list, a fixed "Delete Career Win" label on
// every card would be indistinguishable to screen-reader users tabbing
// through multiple entries -- truncate the statement into the label so
// each delete button announces which win it targets (carried forward from
// Task 8's review, fixed here since Task 9 is the first place this becomes
// observable).
function truncate(text: string, maxLength: number): string {
  return text.length > maxLength ? `${text.slice(0, maxLength).trimEnd()}...` : text
}

export function CareerWinCard({ careerWin, onDelete }: CareerWinCardProps) {
  return (
    <div className="border border-border bg-surface-card p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-ink">{careerWin.original_statement}</p>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete Career Win: ${truncate(careerWin.original_statement, 60)}`}
            className="flex-shrink-0 p-1 text-ink-muted hover:text-error-400"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {careerWin.metric_raw && <p className="mt-2 text-xs text-ink-muted">Metric: {careerWin.metric_raw}</p>}
      {careerWin.category && <p className="text-xs text-ink-muted">Category: {careerWin.category}</p>}

      {careerWin.capabilities.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {careerWin.capabilities.map((cap) =>
            cap.inference_reason ? (
              // A focusable button (not a bare span) so the "why this was
              // suggested" reason is reachable by keyboard and announced by
              // screen readers via aria-describedby -- a native `title`
              // attribute alone is mouse-hover-only and unreliable across
              // AT, which would bury exactly the transparency this feature
              // exists to provide. The description lives in a sibling
              // sr-only span (not nested inside the button) so it feeds
              // aria-describedby without also polluting the button's
              // accessible NAME -- nesting it inside would make screen
              // readers announce the reason twice (once as part of the
              // name, once as the description).
              <Fragment key={cap.id}>
                <button
                  type="button"
                  title={cap.inference_reason}
                  aria-describedby={`cap-reason-${cap.id}`}
                  className="rounded-full bg-primary-950 px-3 py-1 text-xs font-medium text-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {cap.skill_name}
                </button>
                <span id={`cap-reason-${cap.id}`} className="sr-only">
                  {cap.inference_reason}
                </span>
              </Fragment>
            ) : (
              <span
                key={cap.id}
                className="rounded-full bg-primary-950 px-3 py-1 text-xs font-medium text-primary-300"
              >
                {cap.skill_name}
              </span>
            )
          )}
        </div>
      )}
    </div>
  )
}
