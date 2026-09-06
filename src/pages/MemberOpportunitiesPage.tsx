import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MemberLayout } from '@/components/MemberLayout'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { createFeedback } from '@/lib/operations'
import { isSafeHttpUrl } from '@/lib/url'
import {
  Search, Check, X, MessageSquare, AlertCircle, Loader2,
  MapPin, DollarSign, Briefcase, Calendar, ExternalLink,
  ThumbsUp, ThumbsDown, Frown, Ban, ArrowRight,
} from 'lucide-react'
import type { Opportunity, MemberProfile } from '@/types'

const statusLabels: Record<string, string> = {
  researching: 'Researching',
  needs_review: 'Needs Review',
  recommended: 'Recommended',
  awaiting_member_approval: 'Awaiting Your Approval',
  approved: 'Approved',
  declined: 'Declined',
  preparing_application: 'Preparing Application',
  submitted: 'Application Submitted',
  expired: 'Expired',
  archived: 'Archived',
}

const statusColors: Record<string, string> = {
  researching: 'border-border text-ink-muted',
  needs_review: 'border-border text-ink-muted',
  recommended: 'border-primary-700 text-primary-300',
  awaiting_member_approval: 'border-warning-700 text-warning-300',
  approved: 'border-success-700 text-success-300',
  declined: 'border-error-700 text-error-300',
  preparing_application: 'border-accent-700 text-accent-300',
  submitted: 'rounded-full bg-primary-600 text-white',
  expired: 'border-border text-ink-muted',
  archived: 'border-border text-ink-muted',
}

export function MemberOpportunitiesPage() {
  const { user } = useAuth()
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedOpp, setSelectedOpp] = useState<Opportunity | null>(null)
  const [feedbackLoading, setFeedbackLoading] = useState(false)

  useEffect(() => {
    if (!user) return
    supabase
      .from('opportunities')
      .select('*')
      .eq('member_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error('Error loading opportunities:', error)
        setOpportunities((data as Opportunity[]) || [])
        setLoading(false)
      })
  }, [user])

  const handleApprove = async (opp: Opportunity) => {
    setFeedbackLoading(true)
    await supabase.from('opportunities').update({ status: 'approved', updated_at: new Date().toISOString() }).eq('id', opp.id)
    setOpportunities((prev) => prev.map((o) => (o.id === opp.id ? { ...o, status: 'approved' } : o)))
    setSelectedOpp(null)
    setFeedbackLoading(false)
  }

  const handleDecline = async (opp: Opportunity) => {
    setFeedbackLoading(true)
    await supabase.from('opportunities').update({ status: 'declined', updated_at: new Date().toISOString() }).eq('id', opp.id)
    await createFeedback({
      member_id: opp.member_id,
      opportunity_id: opp.id,
      feedback_type: 'not_interested',
    })
    setOpportunities((prev) => prev.map((o) => (o.id === opp.id ? { ...o, status: 'declined' } : o)))
    setSelectedOpp(null)
    setFeedbackLoading(false)
  }

  const handleFeedback = async (opp: Opportunity, feedbackType: string) => {
    setFeedbackLoading(true)
    await createFeedback({
      member_id: opp.member_id,
      opportunity_id: opp.id,
      feedback_type: feedbackType,
    })
    setFeedbackLoading(false)
  }

  if (loading) {
    return (
      <MemberLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      </MemberLayout>
    )
  }

  const pendingApproval = opportunities.filter((o) => o.status === 'awaiting_member_approval')
  const active = opportunities.filter((o) => !['declined', 'expired', 'archived'].includes(o.status))

  return (
    <MemberLayout>
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-semibold text-ink sm:text-3xl">Opportunities</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Hand-selected opportunities researched by your Career Strategist.
        </p>
      </div>

      {pendingApproval.length > 0 && (
        <div className="mb-6 border border-warning-700 border-l-4 border-l-warning-500 bg-warning-950 p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-warning-600" />
            <p className="text-sm font-medium text-warning-300">
              {pendingApproval.length} opportunit{pendingApproval.length === 1 ? 'y' : 'ies'} awaiting your approval.
            </p>
          </div>
        </div>
      )}

      {active.length === 0 ? (
        <div className="border border-border bg-surface-card p-12 text-center">
          <Search className="mx-auto h-12 w-12 text-ink-muted" />
          <p className="mt-4 text-sm text-ink-muted">
            Your Career Strategist is researching opportunities for you. Check back soon!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {active.map((opp) => (
            <div key={opp.id} className="border border-border border-l-4 border-l-primary-600 bg-surface-card p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`border px-2.5 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wide ${statusColors[opp.status] || 'border-border text-ink-muted'}`}>
                      {statusLabels[opp.status] || opp.status}
                    </span>
                  </div>
                  <h3 className="mt-3 font-serif text-lg font-semibold text-ink">{opp.job_title}</h3>
                  <p className="text-sm text-ink-muted">{opp.employer}</p>

                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-ink-muted">
                    {opp.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {opp.location}
                      </span>
                    )}
                    {opp.salary_text && (
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-3.5 w-3.5" />
                        {opp.salary_text}
                      </span>
                    )}
                    {opp.employment_type && (
                      <span className="flex items-center gap-1">
                        <Briefcase className="h-3.5 w-3.5" />
                        {opp.employment_type}
                      </span>
                    )}
                    {opp.work_arrangement && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {opp.work_arrangement}
                      </span>
                    )}
                  </div>

                  {opp.member_visible_notes && (
                    <p className="mt-3 border-l-2 border-border bg-surface-subtle p-3 text-sm text-ink-muted">
                      {opp.member_visible_notes}
                    </p>
                  )}

                  {opp.why_it_matches && (
                    <div className="mt-3">
                      <p className="text-xs font-semibold text-ink-muted">Why This Matches You</p>
                      <p className="mt-1 text-sm text-ink-muted">{opp.why_it_matches}</p>
                    </div>
                  )}

                  {isSafeHttpUrl(opp.posting_url) && (
                    <a
                      href={opp.posting_url ?? undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      View Posting
                    </a>
                  )}
                </div>
              </div>

              {/* Approval actions */}
              {opp.status === 'awaiting_member_approval' && (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
                  <button
                    onClick={() => handleApprove(opp)}
                    disabled={feedbackLoading}
                    className="flex items-center gap-1.5 rounded-full bg-success-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-success-700 disabled:opacity-60"
                  >
                    <Check className="h-4 w-4" />
                    Approve
                  </button>
                  <button
                    onClick={() => handleDecline(opp)}
                    disabled={feedbackLoading}
                    className="flex items-center gap-1.5 border border-error-700 bg-error-950 px-4 py-2 text-sm font-semibold text-error-300 transition-colors hover:bg-error-900 disabled:opacity-60"
                  >
                    <X className="h-4 w-4" />
                    Decline
                  </button>
                  <Link
                    to="/messages"
                    className="flex items-center gap-1.5 border border-border px-4 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-hover"
                  >
                    <MessageSquare className="h-4 w-4" />
                    Ask Questions
                  </Link>
                </div>
              )}

              {/* Feedback for approved/submitted */}
              {(opp.status === 'approved' || opp.status === 'submitted' || opp.status === 'preparing_application') && (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
                  <span className="text-xs text-ink-muted">Your feedback:</span>
                  <button
                    onClick={() => handleFeedback(opp, 'great_fit')}
                    className="flex items-center gap-1 border border-success-700 px-2.5 py-1 text-xs font-medium text-success-300 hover:bg-success-950"
                  >
                    <ThumbsUp className="h-3 w-3" />
                    Great Fit
                  </button>
                  <button
                    onClick={() => handleFeedback(opp, 'good_fit')}
                    className="flex items-center gap-1 border border-primary-700 px-2.5 py-1 text-xs font-medium text-primary-300 hover:bg-primary-950"
                  >
                    <ThumbsUp className="h-3 w-3" />
                    Good Fit
                  </button>
                  <button
                    onClick={() => handleFeedback(opp, 'not_interested')}
                    className="flex items-center gap-1 border border-border px-2.5 py-1 text-xs font-medium text-ink-muted hover:bg-surface-hover"
                  >
                    <Frown className="h-3 w-3" />
                    Not Interested
                  </button>
                  <button
                    onClick={() => handleFeedback(opp, 'avoid_similar')}
                    className="flex items-center gap-1 border border-error-700 px-2.5 py-1 text-xs font-medium text-error-300 hover:bg-error-950"
                  >
                    <Ban className="h-3 w-3" />
                    Avoid Similar
                  </button>
                  <Link
                    to="/messages"
                    className="flex items-center gap-1 border border-border px-2.5 py-1 text-xs font-medium text-ink-muted hover:bg-surface-hover"
                  >
                    <MessageSquare className="h-3 w-3" />
                    Message Strategist
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </MemberLayout>
  )
}
