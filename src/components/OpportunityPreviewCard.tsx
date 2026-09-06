import { Sparkles } from 'lucide-react'

export type OpportunityStatus = 'reviewed' | 'submitted'

const STATUS_CONFIG: Record<OpportunityStatus, { label: string; className: string }> = {
  reviewed: { label: 'Reviewed', className: 'bg-surface-subtle text-ink-muted' },
  submitted: { label: 'Submitted', className: 'bg-primary-950 text-primary-300' },
}

export interface OpportunityPreviewCardProps {
  role: string
  company: string
  location: string
  fitNote: string
  status: OpportunityStatus
}

// Same card chrome as FridayReportCard (rounded-2xl/shadow-xl/colored top
// bar) so the two visual families read as one product. Role/company names
// are deliberately generic placeholders, not a real employer or client.
export function OpportunityPreviewCard({ role, company, location, fitNote, status }: OpportunityPreviewCardProps) {
  const config = STATUS_CONFIG[status]

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface-card shadow-xl shadow-black/20">
      <div className="h-1.5 bg-primary-600" aria-hidden="true" />
      <div className="p-6 sm:p-7">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-primary-400">Opportunity</p>
          <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-ink-muted">
            Sample
          </span>
        </div>

        <h3 className="mt-4 font-display text-xl font-semibold leading-snug text-ink">{role}</h3>
        <p className="mt-1 text-sm text-ink-muted">
          {company} &middot; {location}
        </p>

        <div className="mt-5 flex items-start gap-2.5 rounded-xl bg-surface-subtle p-4 text-sm text-ink">
          <Sparkles className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary-600" aria-hidden="true" />
          <p>{fitNote}</p>
        </div>

        <div className="mt-5 flex items-center border-t border-border pt-5">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[11px] font-semibold uppercase ${config.className}`}
          >
            {config.label}
          </span>
        </div>
      </div>
    </div>
  )
}
