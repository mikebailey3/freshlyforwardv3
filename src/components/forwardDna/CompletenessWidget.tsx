import { CircularProgress } from '@/components/CircularProgress'
import { calculateForwardDnaCompleteness } from '@/lib/forwardDna/completeness'
import type { ForwardDnaCompletenessInput } from '@/lib/forwardDna/completeness'

export function CompletenessWidget({ input }: { input: ForwardDnaCompletenessInput }) {
  const { score, missing } = calculateForwardDnaCompleteness(input)

  return (
    <div className="border border-border bg-surface-card p-6">
      <h3 className="font-serif text-base font-semibold text-ink">Forward DNA Completeness</h3>
      <p className="mt-1 text-xs text-ink-muted">How complete your professional intelligence profile is.</p>
      <div className="mt-6 flex items-center justify-center">
        <CircularProgress value={score} size={128} strokeWidth={8} />
      </div>
      {missing.length > 0 && (
        <ul className="mt-6 space-y-2">
          {missing.map((item) => (
            <li key={item.key} className="text-sm text-ink-muted">{item.label}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
