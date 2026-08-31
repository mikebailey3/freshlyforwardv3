import { Sparkles } from 'lucide-react'

export type OpportunityStatus = 'reviewed' | 'submitted'

const STATUS_CONFIG: Record<OpportunityStatus, { label: string; className: string }> = {
  reviewed: { label: 'Reviewed', className: 'bg-neutral-100 text-neutral-700' },
  submitted: { label: 'Submitted', className: 'bg-primary-50 text-primary-700' },
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
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xl shadow-neutral-900/5">
      <div className="h-1.5 bg-primary-600" aria-hidden="true" />
      <div className="p-6 sm:p-7">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-primary-700">Opportunity</p>
          <span className="rounded-full border border-neutral-300 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-neutral-500">
            Sample
          </span>
        </div>

        <h3 className="mt-4 font-display text-xl font-semibold leading-snug text-neutral-900">{role}</h3>
        <p className="mt-1 text-sm text-neutral-500">
          {company} &middot; {location}
        </p>

        <div className="mt-5 flex items-start gap-2.5 rounded-xl bg-neutral-50 p-4 text-sm text-neutral-700">
          <Sparkles className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary-600" aria-hidden="true" />
          <p>{fitNote}</p>
        </div>

        <div className="mt-5 flex items-center border-t border-neutral-100 pt-5">
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
