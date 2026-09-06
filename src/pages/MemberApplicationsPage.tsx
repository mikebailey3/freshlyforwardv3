import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MemberLayout } from '@/components/MemberLayout'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { formatDate, timeAgo } from '@/lib/utils'
import {
  FileText, Loader2, MapPin, Calendar, ExternalLink,
  ArrowRight, Briefcase, CheckCircle2, Clock,
} from 'lucide-react'
import type { Application } from '@/types'

const statusLabels: Record<string, string> = {
  preparing_resume: 'Preparing Resume',
  preparing_cover_letter: 'Preparing Cover Letter',
  waiting_on_member: 'Waiting on You',
  ready_to_submit: 'Ready to Submit',
  submitted: 'Submitted',
  employer_viewed: 'Employer Viewed',
  follow_up_needed: 'Follow-Up Needed',
  interview_requested: 'Interview Requested',
  interview_scheduled: 'Interview Scheduled',
  rejected: 'Rejected',
  offer_received: 'Offer Received',
  offer_accepted: 'Offer Accepted',
  closed: 'Closed',
}

const statusColors: Record<string, string> = {
  preparing_resume: 'border-border text-ink-muted',
  preparing_cover_letter: 'border-border text-ink-muted',
  waiting_on_member: 'border-warning-500 text-warning-300',
  ready_to_submit: 'border-accent-500 text-accent-300',
  submitted: 'border-primary-600 bg-primary-600 text-white',
  employer_viewed: 'border-primary-500 text-primary-300',
  follow_up_needed: 'border-warning-500 text-warning-300',
  interview_requested: 'border-primary-500 text-primary-300',
  interview_scheduled: 'border-primary-600 bg-primary-600 text-white',
  rejected: 'border-error-500 text-error-300',
  offer_received: 'border-success-500 text-success-300',
  offer_accepted: 'border-success-600 bg-success-600 text-white',
  closed: 'border-border text-ink-muted',
}

export function MemberApplicationsPage() {
  const { user } = useAuth()
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    supabase
      .from('applications')
      .select('*')
      .eq('member_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error('Error loading applications:', error)
        setApplications((data as Application[]) || [])
        setLoading(false)
      })
  }, [user])

  if (loading) {
    return (
      <MemberLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      </MemberLayout>
    )
  }

  const active = applications.filter((a) => !['rejected', 'closed', 'offer_accepted'].includes(a.status))
  const completed = applications.filter((a) => ['rejected', 'closed', 'offer_accepted'].includes(a.status))

  return (
    <MemberLayout>
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-semibold text-ink sm:text-3xl">Applications</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Every application is hand-crafted and personally submitted by your Career Strategist.
        </p>
      </div>

      {applications.length === 0 ? (
        <div className="border border-border bg-surface-card p-12 text-center">
          <FileText className="mx-auto h-12 w-12 text-ink-muted" />
          <p className="mt-4 text-sm text-ink-muted">
            No applications yet. Your Career Strategist will begin preparing applications once opportunities are approved.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {active.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-serif text-lg font-semibold text-ink">Active Applications</h2>
              {active.map((app) => (
                <ApplicationCard key={app.id} app={app} />
              ))}
            </div>
          )}

          {completed.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-serif text-lg font-semibold text-ink">Completed</h2>
              {completed.map((app) => (
                <ApplicationCard key={app.id} app={app} />
              ))}
            </div>
          )}
        </div>
      )}
    </MemberLayout>
  )
}

function ApplicationCard({ app }: { app: Application }) {
  return (
    <div className="border border-border border-l-4 border-l-primary-600 bg-surface-card p-6 transition-colors hover:border-l-primary-400">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className={`border-2 px-2.5 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wide ${statusColors[app.status] || 'border-border text-ink-muted'}`}>
              {statusLabels[app.status] || app.status}
            </span>
          </div>
          <h3 className="mt-3 font-serif text-lg font-semibold text-ink">{app.job_title}</h3>
          <p className="text-sm text-ink-muted">{app.employer}</p>

          <div className="mt-3 flex flex-wrap gap-3 font-mono text-xs text-ink-muted">
            {app.date_submitted && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                Submitted: {formatDate(app.date_submitted)}
              </span>
            )}
            {app.interview_date && (
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                Interview: {formatDate(app.interview_date)}
              </span>
            )}
            {app.follow_up_date && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                Follow-up: {formatDate(app.follow_up_date)}
              </span>
            )}
          </div>

          {app.member_notes && (
            <p className="mt-3 border border-dashed border-border bg-surface-subtle p-3 text-sm text-ink-muted">{app.member_notes}</p>
          )}
        </div>

        {app.status === 'submitted' && (
          <Link
            to={`/why-we-applied/${app.id}`}
            className="flex flex-shrink-0 items-center gap-1.5 border border-primary-600 px-4 py-2 text-sm font-medium text-primary-300 transition-colors hover:bg-primary-950"
          >
            Why We Applied
            <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>
    </div>
  )
}
