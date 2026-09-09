import { Loader2, Sparkles } from 'lucide-react'
import type { ResumeDimensionResult, ResumeIntelligenceResult } from '@/types/resume'

interface ResumeAnalysisPanelProps {
  analysis: ResumeIntelligenceResult | null
  busy: boolean
  onRunAnalysis: () => void | Promise<void>
}

const SEVERITY_STYLES: Record<string, string> = {
  error: 'border-l-error-600 text-error-300',
  warning: 'border-l-warning-600 text-warning-300',
  info: 'border-l-border text-ink-muted',
}

/**
 * Renders all six Resume Intelligence dimensions, each independently --
 * never a single blended score (locked product decision, enforced by the
 * type itself: `ResumeIntelligenceResult` has no top-level score field).
 */
export function ResumeAnalysisPanel({ analysis, busy, onRunAnalysis }: ResumeAnalysisPanelProps) {
  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={onRunAnalysis}
        disabled={busy}
        className="flex items-center gap-2 rounded-full bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {analysis ? 'Re-run analysis' : 'Analyze my Master Resume'}
      </button>

      {analysis && (
        <div className="grid gap-4 sm:grid-cols-2">
          {analysis.dimensions.map((dimension) => (
            <DimensionCard key={dimension.key} dimension={dimension} />
          ))}
        </div>
      )}
    </div>
  )
}

function DimensionCard({ dimension }: { dimension: ResumeDimensionResult }) {
  return (
    <div className="border border-border bg-surface-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-sm font-semibold text-ink">{dimension.label}</h3>
        {dimension.status === 'scored' ? (
          <span className="font-mono text-lg font-semibold text-primary-600">{dimension.score}</span>
        ) : (
          <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">Unavailable</span>
        )}
      </div>

      {dimension.status === 'unavailable' && (
        <p className="mt-2 text-xs text-ink-muted">{dimension.unavailableReason}</p>
      )}

      {dimension.findings.length === 0 ? (
        dimension.status === 'scored' && <p className="mt-2 text-xs text-ink-muted">No issues found.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {dimension.findings.map((finding, i) => (
            <li key={i} className={`border-l-2 pl-2 text-xs ${SEVERITY_STYLES[finding.severity]}`}>
              <p className="font-medium">{finding.meaning}</p>
              <p className="mt-0.5 text-ink-muted">Evidence: “{finding.evidence}”</p>
              <p className="mt-0.5 text-ink-muted">{finding.action}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
