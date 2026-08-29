import { ArrowRight, Calendar, FileCheck, Search } from 'lucide-react'
import type { FridayReport } from '@/types'

export type FridayReportCardData = Pick<
  FridayReport,
  | 'title'
  | 'report_date'
  | 'summary'
  | 'opportunities_reviewed'
  | 'applications_submitted'
  | 'interviews_scheduled'
  | 'next_steps'
  | 'approval_status'
>

export interface FridayReportCardProps {
  report: FridayReportCardData
  isSample?: boolean
}

// approval_status is a real column (friday_reports.approval_status, see
// src/lib/fridayReports.ts) tracking the draft -> review -> approved -> sent
// workflow. We surface it as a member-facing "delivery" label rather than
// inventing a new field, per PRODUCT.md's no-fabricated-evidence principle.
const STATUS_LABEL: Record<string, string> = {
  draft: 'In Progress',
  pending_review: 'In Review',
  approved: 'Approved',
  sent: 'Delivered',
}

export function FridayReportCard({ report, isSample = false }: FridayReportCardProps) {
  const steps = report.next_steps
    ? report.next_steps.split('\n').map((s) => s.trim()).filter(Boolean)
    : []
  const statusLabel = STATUS_LABEL[report.approval_status] ?? report.approval_status

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xl shadow-neutral-900/5">
      <div className="h-1.5 bg-primary-600" aria-hidden="true" />
      <div className="p-6 sm:p-7">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-primary-700">
            Friday Report
          </p>
          {isSample && (
            <span className="rounded-full border border-neutral-300 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-neutral-500">
              Sample
            </span>
          )}
        </div>
        <p className="mt-1 font-mono text-xs text-neutral-500">
          {new Date(report.report_date).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })}
        </p>

        <h3 className="mt-4 font-display text-xl font-semibold leading-snug text-neutral-900">
          {report.title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600">{report.summary}</p>

        <div className="mt-6 grid grid-cols-3 gap-3 border-t border-neutral-100 pt-5">
          <Stat icon={Search} label="Reviewed" value={report.opportunities_reviewed} />
          <Stat icon={FileCheck} label="Submitted" value={report.applications_submitted} />
          <Stat icon={Calendar} label="Interviews" value={report.interviews_scheduled} />
        </div>

        <div className="mt-6 border-t border-neutral-100 pt-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Next Steps</p>
            <span className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase text-primary-700">
              <span className="h-1.5 w-1.5 rounded-full bg-primary-500" aria-hidden="true" />
              {statusLabel}
            </span>
          </div>
          {steps.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {steps.map((step) => (
                <li key={step} className="flex items-start gap-2.5 text-sm text-neutral-700">
                  <ArrowRight className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-primary-500" aria-hidden="true" />
                  {step}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-neutral-500">No next steps recorded yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Search
  label: string
  value: number
}) {
  return (
    <div className="flex flex-col items-start gap-1">
      <Icon className="h-4 w-4 text-primary-600" aria-hidden="true" />
      <p className="font-mono text-2xl font-bold leading-none text-neutral-900">{value}</p>
      <p className="text-[11px] text-neutral-500">{label}</p>
    </div>
  )
}
