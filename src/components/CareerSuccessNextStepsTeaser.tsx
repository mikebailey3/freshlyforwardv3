import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { getFridayReports } from '@/lib/communication'
import { formatDate } from '@/lib/utils'
import { FileText, Loader2, ArrowRight } from 'lucide-react'
import type { FridayReport } from '@/types'

const CARD_CLASS = 'rounded-2xl border border-border bg-surface-card p-6 shadow-sm'

/**
 * "Your current focus" teaser for Career Success (Sub-Project 7).
 *
 * Real data only -- reuses the exact visibility rule FridayReportsPage.tsx
 * already applies (only approval_status 'approved'/'sent' reports are
 * member-facing; 'draft'/'pending_review' stay internal) and the exact
 * next_steps line-splitting convention FridayReportCard.tsx already uses.
 * Never fabricates next-step content: if no qualifying report exists, or
 * the fetch fails, this renders an honest empty state, not placeholder text.
 */
export function CareerSuccessNextStepsTeaser() {
  const { profile } = useAuth()
  const [report, setReport] = useState<FridayReport | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) {
      setLoading(false)
      return
    }
    let cancelled = false

    getFridayReports(profile.id)
      .then((data) => {
        if (cancelled) return
        const visible = (data as unknown as FridayReport[]).filter(
          (r) => r.approval_status === 'approved' || r.approval_status === 'sent',
        )
        setReport(visible[0] || null)
      })
      .catch((err) => {
        console.error('Error loading Friday Reports for the Next Steps teaser:', err)
        if (!cancelled) setReport(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [profile])

  const steps = report?.next_steps
    ? report.next_steps.split('\n').map((s) => s.trim()).filter(Boolean)
    : []
  const previewSteps = steps.slice(0, 3)
  const remaining = steps.length - previewSteps.length

  return (
    <div className={CARD_CLASS}>
      <div className="flex items-center gap-2">
        <FileText className="h-5 w-5 text-primary-600" />
        <h2 className="font-display !text-lg font-semibold text-ink">Your current focus</h2>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
        </div>
      ) : report && previewSteps.length > 0 ? (
        <div className="mt-3">
          <p className="text-xs text-ink-muted">
            From your {formatDate(report.report_date)} progress report: {report.title}
          </p>
          <ul className="mt-2 space-y-1.5">
            {previewSteps.map((step, i) => (
              <li key={i} className="text-sm text-ink">
                {step}
              </li>
            ))}
          </ul>
          {remaining > 0 && <p className="mt-1 text-xs text-ink-muted">+{remaining} more</p>}
          <Link
            to="/friday-reports"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-400"
          >
            View full report
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-sm text-ink-muted">
            Your strategist hasn&apos;t published a progress report yet.
          </p>
          <Link
            to="/friday-reports"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-400"
          >
            View Friday Reports
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      )}
    </div>
  )
}
