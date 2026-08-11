import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MemberLayout } from '@/components/MemberLayout'
import { SearchReadinessWidget } from '@/components/SearchReadinessWidget'
import { useAuth } from '@/context/AuthContext'
import { useEntitlements } from '@/hooks/useEntitlements'
import { supabase } from '@/lib/supabase'
import { ensureProfile, getTimeline } from '@/lib/profile'
import { timeAgo } from '@/lib/utils'
import {
  User, CreditCard, Calendar, MessageSquare, FileText, TrendingUp,
  Sparkles, ArrowRight, Mail, Clock, CheckCircle2, FileCheck,
  Lock,
} from 'lucide-react'
import type {
  MemberProfile, CareerTimelineEvent, FridayReport, Message,
  MockInterview, MemberDocument, MembershipPlan,
} from '@/types'

export function DashboardPage() {
  const { user, profile, refreshProfile } = useAuth()
  const { canAccess } = useEntitlements()
  const [plan, setPlan] = useState<MembershipPlan | null>(null)
  const [timeline, setTimeline] = useState<CareerTimelineEvent[]>([])
  const [latestReport, setLatestReport] = useState<FridayReport | null>(null)
  const [unreadMessages, setUnreadMessages] = useState<Message[]>([])
  const [upcomingInterview, setUpcomingInterview] = useState<MockInterview | null>(null)
  const [documents, setDocuments] = useState<MemberDocument[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return

    const loadData = async () => {
      const prof = await ensureProfile(user.id)
      await refreshProfile()

      const [timelineData, reportData, messageData, interviewData, docData] = await Promise.all([
        getTimeline(user.id),
        supabase
          .from('friday_reports')
          .select('*')
          .eq('user_id', user.id)
          .order('report_date', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('messages')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_read', false)
          .order('created_at', { ascending: false }),
        supabase
          .from('mock_interviews')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'scheduled')
          .gte('scheduled_at', new Date().toISOString())
          .order('scheduled_at', { ascending: true })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('member_documents')
          .select('*')
          .eq('user_id', user.id)
          .order('uploaded_at', { ascending: false })
          .limit(3),
      ])

      setTimeline(timelineData)
      setLatestReport((reportData.data as FridayReport) || null)
      setUnreadMessages((messageData.data as Message[]) || [])
      setUpcomingInterview((interviewData.data as MockInterview) || null)
      setDocuments((docData.data as MemberDocument[]) || [])

      if (prof?.plan_id) {
        const { data: planData } = await supabase
          .from('membership_plans')
          .select('*')
          .eq('id', prof.plan_id)
          .maybeSingle()
        setPlan(planData as MembershipPlan | null)
      }

      setLoading(false)
    }

    loadData()
  }, [user, refreshProfile])

  if (loading) {
    return (
      <MemberLayout>
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
        </div>
      </MemberLayout>
    )
  }

  return (
    <MemberLayout>
      {/* Welcome */}
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-semibold text-neutral-900 sm:text-3xl">
          Welcome back{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          Here is what is happening with your career search.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column - main content */}
        <div className="space-y-6 lg:col-span-2">
          {/* Assigned Career Strategist */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100">
                <User className="h-5 w-5 text-primary-600" />
              </div>
              <div>
                <h3 className="font-serif text-base font-semibold text-neutral-900">Your Career Strategist</h3>
                <p className="text-xs text-neutral-500">Your dedicated point of contact</p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-4 rounded-xl bg-neutral-50 p-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary-100 to-secondary-100">
                <User className="h-7 w-7 text-primary-600" />
              </div>
              <div>
                <p className="font-serif text-sm font-semibold text-neutral-900">Your Strategist</p>
                <p className="text-xs text-neutral-600">
                  Your dedicated Career Strategist will be assigned shortly and will reach out via message.
                </p>
              </div>
            </div>
            <Link
              to="/messages"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700"
            >
              <Mail className="h-4 w-4" />
              Message your Strategist
            </Link>
          </div>

          {/* Latest Friday Report */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100">
                  <FileText className="h-5 w-5 text-primary-600" />
                </div>
                <div>
                  <h3 className="font-serif text-base font-semibold text-neutral-900">Latest Friday Report</h3>
                  <p className="text-xs text-neutral-500">Weekly progress update</p>
                </div>
              </div>
            </div>
            {latestReport ? (
              <div className="mt-4 rounded-xl bg-neutral-50 p-4">
                <p className="font-serif text-sm font-semibold text-neutral-900">{latestReport.title}</p>
                <p className="mt-1 text-sm text-neutral-600">{latestReport.summary}</p>
                {latestReport.next_steps && (
                  <div className="mt-3 border-t border-neutral-200 pt-3">
                    <p className="text-xs font-semibold text-neutral-700">Next Steps:</p>
                    <p className="mt-1 text-xs text-neutral-600">{latestReport.next_steps}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-4 rounded-xl bg-neutral-50 p-4 text-center">
                <p className="text-sm text-neutral-500">
                  Your first Friday Progress Report will arrive soon. Your Strategist is reviewing your profile.
                </p>
              </div>
            )}
          </div>

          {/* Career Timeline */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100">
                  <Calendar className="h-5 w-5 text-primary-600" />
                </div>
                <div>
                  <h3 className="font-serif text-base font-semibold text-neutral-900">Career Timeline</h3>
                  <p className="text-xs text-neutral-500">Your FreshlyForward journey</p>
                </div>
              </div>
              <Link to="/timeline" className="text-sm font-medium text-primary-600 hover:text-primary-700">
                View all
              </Link>
            </div>
            {timeline.length > 0 ? (
              <div className="mt-4 space-y-3">
                {timeline.slice(0, 4).map((event) => (
                  <div key={event.id} className="flex items-start gap-3">
                    <div className="mt-1 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary-100">
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-neutral-900">{event.event_title}</p>
                      {event.event_description && (
                        <p className="text-xs text-neutral-600">{event.event_description}</p>
                      )}
                      <p className="mt-0.5 text-xs text-neutral-400">{timeAgo(event.event_date)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-xl bg-neutral-50 p-4 text-center">
                <p className="text-sm text-neutral-500">Your timeline will populate as your career journey progresses.</p>
              </div>
            )}
          </div>

          {/* Recent Documents */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100">
                  <FileCheck className="h-5 w-5 text-primary-600" />
                </div>
                <div>
                  <h3 className="font-serif text-base font-semibold text-neutral-900">Recent Documents</h3>
                  <p className="text-xs text-neutral-500">Resume and other files</p>
                </div>
              </div>
              <Link to="/profile" className="text-sm font-medium text-primary-600 hover:text-primary-700">
                Manage
              </Link>
            </div>
            {documents.length > 0 ? (
              <div className="mt-4 space-y-2">
                {documents.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-3 rounded-lg border border-neutral-200 p-3">
                    <FileText className="h-4 w-4 text-neutral-400" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-neutral-900">{doc.file_name}</p>
                      <p className="text-xs text-neutral-500">
                        {doc.document_type.replace('_', ' ')} — {timeAgo(doc.uploaded_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-xl bg-neutral-50 p-4 text-center">
                <p className="text-sm text-neutral-500">
                  No documents yet. Upload your resume from your Career Profile.
                </p>
              </div>
            )}
          </div>

          {/* Career Success */}
          <div className="rounded-2xl border border-primary-200 bg-gradient-to-br from-primary-50 to-neutral-50 p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100">
                <Sparkles className="h-5 w-5 text-primary-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">\n                  <h3 className="font-serif text-base font-semibold text-neutral-900">Career Success</h3>
                  {!canAccess('workplace_success_coaching') && (
                    <Lock className="h-3.5 w-3.5 text-neutral-400" />
                  )}
                </div>
                <p className="text-xs text-neutral-500">Long-term career growth tools</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-neutral-600">
              FreshlyForward continues helping you long after you secure employment. Explore tools for promotion
              planning, leadership coaching, salary growth, and more.
            </p>
            <Link
              to="/career-success"
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary-600 hover:text-primary-700"
            >
              Explore Career Success
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Right column - sidebar widgets */}
        <div className="space-y-6">
          {/* Membership */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100">
                <CreditCard className="h-5 w-5 text-primary-600" />
              </div>
              <div>
                <h3 className="font-serif text-base font-semibold text-neutral-900">Membership</h3>
                <p className="text-xs text-neutral-500">Your current plan</p>
              </div>
            </div>
            <div className="mt-4">
              <p className="font-serif text-lg font-semibold text-neutral-900">{plan?.name || 'No plan selected'}</p>
              <p className="text-sm text-neutral-600 capitalize">
                Status: <span className={profile?.subscription_status === 'active' ? 'text-success-600' : 'text-neutral-900'}>
                  {profile?.subscription_status || 'pending'}
                </span>
              </p>
            </div>
            <Link
              to="/membership"
              className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
            >
              Manage Membership
            </Link>
          </div>

          {/* Search Readiness */}
          <SearchReadinessWidget profile={profile} />

          {/* Messages */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100">
                  <MessageSquare className="h-5 w-5 text-primary-600" />
                </div>
                <div>
                  <h3 className="font-serif text-base font-semibold text-neutral-900">Messages</h3>
                  <p className="text-xs text-neutral-500">From your Strategist</p>
                </div>
              </div>
              {unreadMessages.length > 0 && (
                <span className="rounded-full bg-primary-600 px-2 py-0.5 text-xs font-semibold text-white">
                  {unreadMessages.length}
                </span>
              )}
            </div>
            {unreadMessages.length > 0 ? (
              <div className="mt-4 space-y-2">
                {unreadMessages.slice(0, 3).map((msg) => (
                  <div key={msg.id} className="rounded-lg bg-neutral-50 p-3">
                    <p className="text-sm text-neutral-700">{msg.body.slice(0, 80)}…</p>
                    <p className="mt-1 text-xs text-neutral-400">{timeAgo(msg.created_at)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-xl bg-neutral-50 p-4 text-center">
                <p className="text-sm text-neutral-500">No new messages. Your Strategist will reach out soon.</p>
              </div>
            )}
            <Link
              to="/messages"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700"
            >
              View all messages
            </Link>
          </div>

          {/* Upcoming Mock Interview */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100">
                <Clock className="h-5 w-5 text-primary-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-serif text-base font-semibold text-neutral-900">Mock Interview</h3>
                  {!canAccess('mock_interviews') && (
                    <Lock className="h-3.5 w-3.5 text-neutral-400" />
                  )}
                </div>
                <p className="text-xs text-neutral-500">Upcoming session</p>
              </div>
            </div>
            {canAccess('mock_interviews') && upcomingInterview ? (
              <div className="mt-4 rounded-xl bg-neutral-50 p-4">
                <p className="text-sm font-medium text-neutral-900">
                  {new Date(upcomingInterview.scheduled_at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </p>
                <p className="text-sm text-neutral-600">
                  {new Date(upcomingInterview.scheduled_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </p>
                {upcomingInterview.focus_area && (
                  <p className="mt-2 text-xs text-neutral-500">Focus: {upcomingInterview.focus_area}</p>
                )}
              </div>
            ) : canAccess('mock_interviews') ? (
              <div className="mt-4 rounded-xl bg-neutral-50 p-4 text-center">
                <p className="text-sm text-neutral-500">No mock interviews scheduled yet.</p>
              </div>
            ) : (
              <div className="mt-4 rounded-xl bg-neutral-50 p-4 text-center">
                <p className="text-sm text-neutral-500">
                  Mock interviews are available with Career Growth and Concierge plans.
                </p>
                <Link to="/pricing" className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700">
                  Upgrade to unlock <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </MemberLayout>
  )
}
