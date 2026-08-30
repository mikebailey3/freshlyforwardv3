
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { MemberLayout } from '@/components/MemberLayout'
import { CircularProgress } from '@/components/CircularProgress'
import { useAuth } from '@/context/AuthContext'
import { useEntitlements } from '@/hooks/useEntitlements'
import { supabase } from '@/lib/supabase'
import { ensureProfile, calculateSearchReadiness, getReadinessFixLink } from '@/lib/profile'
import { getRecentPublishedPosts } from '@/lib/blog'
import { TOOL_TILES } from '@/data/tools'
import {
  FileText, MessageSquare, Briefcase, Calendar, Mail,
  Lightbulb, Flag, Loader2, Sparkles, Lock, Compass, X,
} from 'lucide-react'
import type {
  Application, Message, MockInterview, CalendarEvent,
} from '@/types'
import type { ArchetypeKey } from '@/types/careerCompass'

// Display labels mirror ARCHETYPE_COPY in CareerCompassResultsPage.tsx --
// keep wording identical if that file's labels ever change.
const ARCHETYPE_LABELS: Record<ArchetypeKey, string> = {
  driver: 'Driver',
  connector: 'Connector',
  strategist: 'Strategist',
  builder: 'Builder',
  explorer: 'Explorer',
  creator: 'Creator',
}

interface CompassSummary {
  primary_archetype: ArchetypeKey
  recommended_plan_slug: string | null
}

const TIPS_OF_THE_DAY = [
  'Tailor your resume for each application by matching your experience to the job description. It makes a big difference!',
  'Follow up on applications after one week of silence \u2014 a short, polite note keeps you top of mind.',
  'Practice your 30-second pitch out loud. The more natural it feels, the more confident you will sound.',
  'Research the company\u2019s recent news before an interview \u2014 it gives you great talking points.',
  'Keep a running list of your wins at work. It makes performance reviews and interviews much easier.',
]

const MOTIVATIONS = [
  'Progress, not perfection. Every step forward counts.',
  'Small steps every day add up to big career changes.',
  'You are not behind. You are exactly where your journey needs you to be.',
  'The right opportunity is worth the wait \u2014 keep going.',
]

function dayIndex(len: number) {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  )
  return dayOfYear % len
}

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export function DashboardPage() {
  const { user, profile, refreshProfile } = useAuth()
  const { canAccess } = useEntitlements()
  const [searchParams] = useSearchParams()
  const [applications, setApplications] = useState<Application[]>([])
  const [unreadMessages, setUnreadMessages] = useState<Message[]>([])
  const [allMessages, setAllMessages] = useState<Message[]>([])
  const [mockInterviews, setMockInterviews] = useState<MockInterview[]>([])
  const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>([])
  const [recentPosts, setRecentPosts] = useState<Awaited<ReturnType<typeof getRecentPublishedPosts>>>([])
  const [loading, setLoading] = useState(true)
  const [compassResult, setCompassResult] = useState<CompassSummary | null>(null)
  const [compassLoading, setCompassLoading] = useState(true)
  const [savedBannerDismissed, setSavedBannerDismissed] = useState(false)

  useEffect(() => {
    if (!user) return

    const loadData = async () => {
      await ensureProfile(user.id)
      await refreshProfile()

      const [appsRes, unreadRes, allMsgRes, mockRes, eventsRes, postsRes] = await Promise.all([
        supabase.from('applications').select('*').eq('member_id', user.id),
        supabase
          .from('messages')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_read', false)
          .order('created_at', { ascending: false }),
        supabase.from('messages').select('*').eq('user_id', user.id),
        supabase.from('mock_interviews').select('*').eq('user_id', user.id),
        supabase
          .from('calendar_events')
          .select('*')
          .eq('user_id', user.id)
          .gte('start_at', new Date().toISOString())
          .order('start_at', { ascending: true })
          .limit(3),
        getRecentPublishedPosts(3),
      ])

      setApplications((appsRes.data as Application[]) || [])
      setUnreadMessages((unreadRes.data as Message[]) || [])
      setAllMessages((allMsgRes.data as Message[]) || [])
      setMockInterviews((mockRes.data as MockInterview[]) || [])
      setUpcomingEvents((eventsRes.data as CalendarEvent[]) || [])
      setRecentPosts(postsRes)

      setLoading(false)
    }

    loadData()
  }, [user, refreshProfile])

  // Own effect, deliberately not part of the Promise.all above -- a slow or
  // failed Career Compass lookup should never block the rest of the
  // dashboard from rendering.
  useEffect(() => {
    if (!user) return

    let cancelled = false
    supabase
      .from('career_compass_results')
      .select('primary_archetype, recommended_plan_slug')
      .eq('user_id', user.id)
      .eq('is_current', true)
      .maybeSingle()
      .then(
        ({ data, error }) => {
          if (cancelled) return
          setCompassResult(!error && data ? (data as CompassSummary) : null)
          setCompassLoading(false)
        },
        () => {
          if (cancelled) return
          setCompassResult(null)
          setCompassLoading(false)
        },
      )

    return () => {
      cancelled = true
    }
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

  const readiness = profile ? calculateSearchReadiness(profile) : { score: 0, missing: [] }
  const activeApplications = applications.filter((a) => !['rejected', 'closed', 'offer_accepted'].includes(a.status))
  const weekAgo = new Date(Date.now() - 7 * 86400000)
  const newThisWeek = applications.filter((a) => new Date(a.created_at) >= weekAgo).length
  const submittedThisWeek = applications.filter(
    (a) => a.date_submitted && new Date(a.date_submitted) >= weekAgo
  ).length

  const upcomingInterviewApps = applications
    .filter((a) => a.interview_date && new Date(a.interview_date) >= new Date())
    .sort((a, b) => new Date(a.interview_date!).getTime() - new Date(b.interview_date!).getTime())
  const nextInterview = upcomingInterviewApps[0]

  const completedMock = mockInterviews.find((m) => m.status === 'completed' && m.feedback)
  const scheduledMock = mockInterviews.find((m) => m.status === 'scheduled')
  const interviewPrepPct = completedMock ? 100 : scheduledMock ? 50 : 0

  const messagesRespondedPct =
    allMessages.length > 0
      ? Math.round((allMessages.filter((m) => m.is_read).length / allMessages.length) * 100)
      : 100

  const applicationsGoal = 5
  const tip = TIPS_OF_THE_DAY[dayIndex(TIPS_OF_THE_DAY.length)]
  const motivation = MOTIVATIONS[dayIndex(MOTIVATIONS.length)]
  const showSavedBanner = searchParams.get('compass') === 'saved' && !savedBannerDismissed

  return (
    <MemberLayout>
      {showSavedBanner && (
        <div className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-primary-200 bg-primary-50 px-4 py-3">
          <p className="text-sm font-medium text-primary-800">
            Your Career Compass results have been saved to your account.
          </p>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setSavedBannerDismissed(true)}
            className="flex-shrink-0 rounded-full p-1 text-primary-600 transition-colors hover:bg-primary-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {/* Greeting */}
      {/* font-display carries through at a small size on card section titles
          below too (not just this h1) -- the whole point of "Concierge
          Editorial" is a single visual identity across Persuade and Operate
          modes, just quieter here. Dropping it entirely on card headers
          would make this page's typography an unexplained one-off relative
          to both this page's own h1 and every other (not-yet-migrated) page
          in the app, which still uses a heading font throughout. */}
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-neutral-900 sm:text-3xl">
          {greeting()}{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}! \u2615
        </h1>
        <p className="mt-1 text-sm text-neutral-600">Ready to make today a step forward?</p>
      </div>

      {/* Stat cards */}
      <div className="overflow-hidden rounded-xl border border-neutral-200 shadow-sm">
        <div className="grid gap-0 lg:grid-cols-4">
          <div className="border-b border-neutral-200 p-5 lg:border-b-0 lg:border-r">
            <p className="text-sm font-semibold text-neutral-700">Search Readiness</p>
            <div className="mt-3 flex items-center gap-3">
              <CircularProgress value={readiness.score} size={56} strokeWidth={6} label="" />
              <p className="text-xs text-neutral-500">
                {readiness.score >= 80 ? "You're doing great! Keep going." : 'Keep going, you\u2019re getting closer.'}
              </p>
            </div>
            <Link to={readiness.missing.length > 0 ? getReadinessFixLink(readiness.missing) : '/profile'} className="mt-3 inline-block font-mono text-xs font-medium text-primary-600 hover:text-primary-700">
              {readiness.missing.length > 0 ? "Let's fix it" : 'View My Progress'}
            </Link>
          </div>

          <div className="border-b border-neutral-200 p-5 lg:border-b-0 lg:border-r">
            <p className="text-sm font-semibold text-neutral-700">Applications</p>
            <p className="mt-2 font-mono text-3xl font-bold text-neutral-900">{activeApplications.length}</p>
            <p className="text-xs text-neutral-500">
              Active applications{newThisWeek > 0 && <span className="text-primary-600"> \u2022 {newThisWeek} new this week</span>}
            </p>
            <Link to="/applications" className="mt-3 inline-block font-mono text-xs font-medium text-primary-600 hover:text-primary-700">
              View Applications
            </Link>
          </div>

          <div className="border-b border-neutral-200 p-5 lg:border-b-0 lg:border-r">
            <p className="text-sm font-semibold text-neutral-700">Interviews</p>
            <p className="mt-2 font-mono text-3xl font-bold text-neutral-900">{upcomingInterviewApps.length}</p>
            <p className="text-xs text-neutral-500">
              {nextInterview
                ? `Next: ${new Date(nextInterview.interview_date!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                : 'Upcoming interviews'}
            </p>
            <Link to="/interviews" className="mt-3 inline-block font-mono text-xs font-medium text-primary-600 hover:text-primary-700">
              View Interviews
            </Link>
          </div>

          <div className="p-5">
            <p className="text-sm font-semibold text-neutral-700">Messages</p>
            <p className="mt-2 font-mono text-3xl font-bold text-neutral-900">{unreadMessages.length}</p>
            <p className="text-xs text-neutral-500">Unread messages</p>
            <Link to="/messages" className="mt-3 inline-block font-mono text-xs font-medium text-primary-600 hover:text-primary-700">
              Open Messages
            </Link>
          </div>
        </div>

        <div className="flex flex-col items-start justify-between gap-4 border-t border-neutral-200 bg-neutral-50 p-5 sm:flex-row sm:items-center">
          <div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-neutral-500">On Call</p>
            <p className="mt-1 text-sm font-semibold text-neutral-900">Your Career Strategist</p>
            <p className="mt-1 text-xs text-neutral-600">Typically replies within 24 hrs.</p>
          </div>
          <Link
            to="/messages"
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
          >
            <Mail className="h-4 w-4" />
            Send a Message
          </Link>
        </div>
      </div>

      {/* Tip / Motivation / Upcoming */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-dashed border-neutral-300 bg-[var(--cream)] p-5 lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-3">
              <Lightbulb className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary-600" />
              <div>
                <p className="text-sm font-semibold text-neutral-900">Tip of the Day</p>
                <p className="mt-1 text-xs text-neutral-600">{tip}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Flag className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary-600" />
              <div>
                <p className="text-sm font-semibold text-neutral-900">Daily Motivation</p>
                <p className="mt-1 text-xs italic text-neutral-600">\u201c{motivation}\u201d</p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-neutral-900">Upcoming</p>
            <Link to="/calendar" className="font-mono text-xs font-medium text-primary-600 hover:text-primary-700">
              View Calendar
            </Link>
          </div>
          {upcomingEvents.length > 0 ? (
            <div className="mt-3 space-y-3">
              {upcomingEvents.map((event) => (
                <div key={event.id} className="flex items-start gap-2">
                  <Calendar className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary-600" />
                  <div>
                    <p className="text-xs font-medium text-neutral-800">{event.title}</p>
                    <p className="text-[11px] text-neutral-500">
                      {new Date(event.start_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })},{' '}
                      {new Date(event.start_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-xs text-neutral-500">Nothing scheduled yet.</p>
          )}
          <Link to="/calendar" className="mt-3 inline-block font-mono text-xs font-medium text-primary-600 hover:text-primary-700">
            See all upcoming &rarr;
          </Link>
        </div>
      </div>

      {/* Recommended + Progress */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-neutral-900">Recommended for You</h2>
            <Link to="/tools" className="font-mono text-xs font-medium text-primary-600 hover:text-primary-700">
              View All
            </Link>
          </div>
          <div className="mt-4 space-y-4">
            <RecommendationRow
              icon={FileText}
              title="Update Your Career Profile"
              description="Add your work preferences to get better job matches."
              cta="Continue"
              to="/profile"
            />
            <RecommendationRow
              icon={MessageSquare}
              title="Practice for Your Interview"
              description={nextInterview ? 'You have an interview coming up. Want to practice?' : 'Stay ready with a mock interview.'}
              cta="Practice Now"
              to="/mock-interviews"
              locked={!canAccess('mock_interviews')}
            />
            <RecommendationRow
              icon={Briefcase}
              title="Why We Applied"
              description="Help your strategist tailor your applications."
              cta="Start"
              to="/applications"
            />
            <RecommendationRow
              icon={Sparkles}
              title="Workplace Success Coaching"
              description="Get expert guidance for workplace challenges."
              cta="Book a Session"
              to="/career-success"
              tag="Concierge"
              locked={!canAccess('workplace_success_coaching')}
            />
          </div>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-neutral-900">Your Progress This Week</h2>
            <Link to="/timeline" className="font-mono text-xs font-medium text-primary-600 hover:text-primary-700">
              View Full Report
            </Link>
          </div>
          <div className="mt-4 space-y-4">
            <ProgressBar label="Applications Submitted" value={submittedThisWeek} max={applicationsGoal} display={`${submittedThisWeek} / ${applicationsGoal}`} />
            <ProgressBar label="Profile Completeness" value={readiness.score} max={100} display={`${readiness.score}%`} />
            <ProgressBar label="Interview Prep" value={interviewPrepPct} max={100} display={`${interviewPrepPct}%`} />
            <ProgressBar label="Messages Responded" value={messagesRespondedPct} max={100} display={`${messagesRespondedPct}%`} />
          </div>
          <div className="mt-4 rounded-lg border border-dashed border-neutral-300 p-4">
            <p className="text-sm font-semibold text-neutral-900">Keep the momentum!</p>
            <p className="mt-1 text-xs text-neutral-600">
              You've taken {activeApplications.length + submittedThisWeek} steps forward this week. You're building something great.
            </p>
          </div>
        </div>
      </div>

      {/* Forward Feed */}
      <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-neutral-900">The Forward Feed</h2>
          <Link to="/forward-feed" className="font-mono text-xs font-medium text-primary-600 hover:text-primary-700">
            Visit The Forward Feed &rarr;
          </Link>
        </div>
        {recentPosts.length === 0 ? (
          <p className="mt-4 text-sm text-neutral-500">New articles are on the way &mdash; check back soon.</p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {recentPosts.map((post) => (
              <Link
                key={post.id}
                to={`/forward-feed/${post.slug}`}
                className="rounded-lg border border-neutral-200 border-l-4 border-l-primary-600 p-4 shadow-sm transition-[border-color,box-shadow] hover:border-l-primary-800 hover:shadow-md"
              >
                <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-primary-700">{post.category}</p>
                <p className="mt-1 text-sm font-medium text-neutral-900">{post.title}</p>
                <p className="mt-2 font-mono text-xs text-neutral-400">{post.read_time_minutes} min read</p>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Quick Access Tools */}
      <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-neutral-900">Quick Access Tools</h2>
          <Link to="/tools" className="font-mono text-xs font-medium text-primary-600 hover:text-primary-700">
            View All Tools &rarr;
          </Link>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-7">
          {TOOL_TILES.map((tool) => (
            <Link key={tool.label} to={tool.to} className="flex flex-col items-center gap-2 rounded-lg border border-transparent p-3 text-center transition-colors hover:border-neutral-200 hover:bg-neutral-50">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50">
                <tool.icon className="h-5 w-5 text-neutral-600" />
              </div>
              <span className="text-[11px] font-medium text-neutral-700">{tool.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </MemberLayout>
  )
}

function RecommendationRow({
  icon: Icon, title, description, cta, to, tag, locked,
}: {
  icon: typeof FileText
  title: string
  description: string
  cta: string
  to: string
  tag?: string
  locked?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-l-2 border-neutral-200 pl-3">
      <div className="flex items-center gap-3">
        <Icon className="h-5 w-5 flex-shrink-0 text-primary-600" />
        <div>
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium text-neutral-900">{title}</p>
            {tag && (
              <span className="rounded-full border border-accent-300 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-accent-700">
                {tag}
              </span>
            )}
            {locked && <Lock className="h-3 w-3 text-neutral-400" />}
          </div>
          <p className="text-xs text-neutral-500">{description}</p>
        </div>
      </div>
      <Link
        to={to}
        className="flex-shrink-0 rounded-full border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-700 transition-colors hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700"
      >
        {cta}
      </Link>
    </div>
  )
}

function ProgressBar({ label, value, max, display }: { label: string; value: number; max: number; display: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-neutral-700">{label}</p>
        <p className="font-mono text-xs font-semibold text-neutral-900">{display}</p>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full border border-neutral-200 bg-neutral-100">
        <div className="h-full rounded-full bg-primary-600 transition-all duration-700" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
