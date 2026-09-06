import type { JobMatchScoreBreakdown } from '@/types'

const STATUS_LABELS: Record<string, string> = {
  strong: 'Strong',
  moderate: 'Moderate',
  weak: 'Weak',
  'no-data': 'Not enough data',
}

/**
 * Expandable "why this score?" panel -- the core FreshFit 2.0 UI
 * deliverable (dimension-by-dimension evidence, confirmed gaps kept
 * visually distinct from unknowns, and blocked hard constraints
 * surfaced first). Renders nothing for a match scored by the pre-2.0
 * engine (no `breakdown.v2`) -- there's no richer data to show, and a
 * button that expands to an empty box would be worse than no button.
 *
 * Uses a native <details>/<summary> element rather than custom
 * open/close state so keyboard and screen-reader disclosure semantics
 * come for free (WCAG 2.2 AA).
 */
export function FreshFitDetails({ breakdown }: { breakdown: JobMatchScoreBreakdown }) {
  const v2 = breakdown?.v2
  if (!v2) return null

  const blockedConstraints = v2.hardConstraints.filter((c) => c.status === 'hard_blocker')

  return (
    <details className="mt-3">
      <summary className="cursor-pointer text-sm font-medium text-primary-400 hover:underline">
        Why this score?
      </summary>
      <div className="mt-3 space-y-4 border-t border-border pt-3">
        <div>
          <p className="text-sm font-semibold text-ink">{v2.recommendation.headline}</p>
          <p className="text-xs text-ink-muted">{v2.recommendation.detail}</p>
        </div>

        {blockedConstraints.length > 0 && (
          <div className="border border-warning-600 bg-warning-950 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-warning-300">Worth reading first</p>
            <ul className="mt-1 space-y-1 text-xs text-warning-200">
              {blockedConstraints.map((c) => (
                <li key={c.key}>{c.reason}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-3">
          {v2.dimensions.map((dim) => (
            <div key={dim.key}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-ink-muted">{dim.label}</p>
                <span className="text-xs text-ink-muted">{STATUS_LABELS[dim.status] ?? dim.status}</span>
              </div>
              <p className="mt-0.5 text-xs text-ink-muted">{dim.explanation}</p>
              {dim.gaps.length > 0 && (
                <p className="mt-1 text-xs text-ink-muted">
                  <span className="font-medium">Confirmed gaps:</span> {dim.gaps.join(', ')}
                </p>
              )}
              {dim.unknowns.length > 0 && (
                <p className="mt-1 text-xs text-ink-muted">
                  <span className="font-medium">Not enough info to confirm:</span> {dim.unknowns.join(', ')}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </details>
  )
}
