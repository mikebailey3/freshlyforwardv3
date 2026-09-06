import { CircularProgress } from '@/components/CircularProgress'

export interface ProfileStrengthCardProps {
  name: string
  headline: string
  strength: number
  forwardScore: number
}

/** Sample Forward Profile summary for the homepage's Intelligence section.
 * Never wired to real member data -- explicitly labeled Sample, matching
 * the FridayReportCard/OpportunityPreviewCard convention. */
export function ProfileStrengthCard({ name, headline, strength, forwardScore }: ProfileStrengthCardProps) {
  return (
    <div className="rounded-2xl border border-border bg-surface-card p-6">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-wide text-primary-400">Forward Profile</span>
        <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-ink-muted">
          Sample
        </span>
      </div>
      <h3 className="mt-4 font-display text-lg font-semibold text-ink">{name}</h3>
      <p className="text-sm text-ink-muted">{headline}</p>
      <div className="mt-5 flex items-center gap-6 border-t border-border pt-5">
        <CircularProgress value={strength} size={64} strokeWidth={6} label="Strength" />
        <div>
          <p className="font-mono text-2xl font-bold text-ink">{forwardScore}</p>
          <p className="text-xs text-ink-muted">Forward Score</p>
        </div>
      </div>
    </div>
  )
}
