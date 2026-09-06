
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { MemberLayout } from '@/components/MemberLayout'
import { CircularProgress } from '@/components/CircularProgress'
import { useAuth } from '@/context/AuthContext'
import { useEntitlements } from '@/hooks/useEntitlements'
import { useForwardScore } from '@/hooks/useForwardScore'
import { ForwardScoreWidget } from '@/components/forwardScore/ForwardScoreWidget'
import { NextBestMoveCard } from '@/components/forwardScore/NextBestMoveCard'
import { PillarCard } from '@/components/forwardScore/PillarCard'
import { supabase } from '@/lib/supabase'
import { ensureProfile, calculateSearchReadiness, getReadinessFixLink } from '@/lib/profile'
import { getRecentPublishedPosts } from '@/lib/blog'
import { ARCHETYPE_LABELS } from '@/lib/careerCompass'
import { TOOL_TILES } from '@/data/tools'
import {
  FileText, MessageSquare, Briefcase, Calendar, Mail,
  Lightbulb, Flag, Loader2, Sparkles, Lock, Compass, X, Archive,
} from 'lucide-react'
import type { Message, CalendarEvent } from '@/types'

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
  const [unreadMessages, setUnreadMessages] = useState<Message[]>([])
  const [allMessages, setAllMessages] = useState<Message[]>([])
  const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>([])
  const [recentPosts, setRecentPosts] = useState<Awaited<ReturnType<typeof getRecentPublishedPosts>>>([])
  const [loading, setLoading] = useState(true)
  const [savedBannerDismissed, setSavedBannerDismissed] = useState(false)

  // Forward Score, its 4 pillars, the Next Best Move, and (Task 7) the raw
  // applications/mock_interviews rows and Career Compass summary this page
  // used to fetch itself -- now a single shared fetch instead of two
  // competing queries of the same tables.
  const {
    forwardScore,
    nextBestMove,
    loading: forwardScoreLoading,
    applications,
    mockInterviews,
    hasActiveApplication,
    hasRecentOrUpcomingInterview,
    compassSummary,
  } = useForwardScore(profile)

  useEffect(() => {
    if (!user) return

    const loadData = async () => {
      await ensureProfile(user.id)
      await refreshProfile()

      const [unreadRes, allMsgRes, eventsRes, postsRes] = await Promise.all([
        supabase
          .from('messages')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_read', false)
          .order('created_at', { ascending: false }),
        supabase.from('messages').select('*').eq('user_id', user.id),
        supabase
          .from('calendar_events')
          .select('*')
          .eq('user_id', user.id)
          .gte('start_at', new Date().toISOString())
          .order('start_at', { ascending: true })
          .limit(3),
        getRecentPublishedPosts(3),
      ])

      setUnreadMessages((unreadRes.data as Message[]) || [])
      setAllMessages((allMsgRes.data as Message[]) || [])
      setUpcomingEvents((eventsRes.data as CalendarEvent[]) || [])
      setRecentPosts(postsRes)

      setLoading(false)
    }

    loadData()
  }, [user, refreshProfile])

  // A single combined loading gate -- the page waits on both this effect's
  // own fetches and useForwardScore's fetch before showing content, so the
  // stat cards (which now source applications/mock_interviews data from
  // the hook) never flash a transient "0" before the hook resolves.
  if (loading || forwardScoreLoading) {
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
        <div className="mb-6 flex items-center justify-between gap-3 rounded-xl border border-primary-700 bg-primary-950 px-4 py-3">
          <p className="text-sm font-medium text-primary-300">
            Your Career Compass results have been saved to your account.
          </p>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setSavedBannerDismissed(true)}
            className="flex-shrink-0 rounded-full p-1 text-primary-600 transition-colors hover:bg-primary-900"
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
        <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-primary-600">
          ForwardOS Home
        </p>
        <h1 className="font-display text-2xl font-semibold text-ink sm:text-3xl">
          {greeting()}{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}! \u2615
        </h1>
        <p className="mt-1 text-sm text-ink-muted">Ready to make today a step forward?</p>
      </div>

      {/* Forward Score hero (locked layout position 1) */}
      {forwardScore && <ForwardScoreWidget result={forwardScore} />}

      {/* Next Best Move (locked layout position 2) */}
      {nextBestMove && (
        <div className="mt-6">
          <NextBestMoveCard move={nextBestMove} />
        </div>
      )}

      {/* Forward Score pillars, fixed order (locked layout position 3):
          Forward DNA Depth, Evidence Quality, Career Momentum, Goal
          Alignment -- this is exactly the order computeForwardScore()
          always returns result.pillars in, so no re-sorting needed here. */}
      {forwardScore && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {forwardScore.pillars.map((pillar) => (
            <PillarCard key={pillar.key} pillar={pillar} />
          ))}
        </div>
      )}

      {/* Forward DNA (locked layout position 4) */}
      <div className="mt-6 rounded-xl border border-border bg-surface-card p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-ink">Forward DNA</h2>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-ink">Your professional intelligence profile</p>
            <p className="mt-1 text-xs text-ink-muted">
              Career history, scope, responsibilities, skills, and goals — the real profile behind your resume.
            </p>
          </div>
          <Link
            to="/forward-dna"
            className="flex-shrink-0 rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
          >
            Open
          </Link>
        </div>
      </div>

      {/* Career Vault (locked layout position 5) -- graceful placeholder.
          No Career Vault table/route/component exists on this branch yet
          (unmerged, separate work), so this is intentionally the
          least-polished card on the page: static, prop-less, zero queries,
          and no link at all (there's nothing real to link to yet). */}
      <CareerVaultPlaceholderCard />

      {/* Career Compass (locked layout position 6) */}
      <div className="mt-6 rounded-xl border border-border bg-surface-card p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-ink">Career Compass</h2>
          {!forwardScoreLoading && compassSummary && (
            <Link to="/career-compass" className="font-mono text-xs font-medium text-primary-600 hover:text-primary-400">
              Retake
            </Link>
          )}
        </div>
        {forwardScoreLoading ? (
          <div className="mt-4 flex items-center gap-3" role="status" aria-label="Loading Career Compass">
            <Compass className="h-5 w-5 flex-shrink-0 animate-pulse text-ink-muted" />
            <div className="h-4 w-48 animate-pulse rounded bg-surface-hover" />
          </div>
        ) : compassSummary ? (
          <div className="mt-4 flex items-center gap-3">
            <Compass className="h-5 w-5 flex-shrink-0 text-primary-600" />
            <div>
              <p className="text-sm font-medium text-ink">
                You're a {ARCHETYPE_LABELS[compassSummary.primary_archetype]}.
              </p>
              <p className="mt-1 text-xs text-ink-muted">
                Curious how things have shifted? Retake the free assessment anytime.
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-ink">Discover your Career Compass</p>
              <p className="mt-1 text-xs text-ink-muted">
                Take the free 5-minute assessment to find your career archetype and readiness score.
              </p>
            </div>
            <Link
              to="/career-compass"
              className="flex-shrink-0 rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
            >
              Start Now
            </Link>
          </div>
        )}
      </div>

      {/* Search Readiness (locked layout position 7) -- extracted from the
          old 4-cell stat row into its own card, contents and calculation
          completely untouched (still calculateSearchReadiness(profile)).
          Only change here is CSS: a visually-elevated border/shadow when
          the member has an active application or a recent/upcoming
          interview -- the exact same two booleans useForwardScore already
          derives for the Career Momentum pillar, reused for this UI
          decision only, never a second/competing definition. */}
      <div
        className={`mt-6 rounded-xl border bg-surface-card p-5 ${
          hasActiveApplication || hasRecentOrUpcomingInterview
            ? 'border-primary-700 shadow-md'
            : 'border-border shadow-sm'
        }`}
      >
        <p className="text-sm font-semibold text-ink-muted">Search Readiness</p>
        <div className="mt-3 flex items-center gap-3">
          <CircularProgress value={readiness.score} size={56} strokeWidth={6} label="" />
          <p className="text-xs text-ink-muted">
            {readiness.score >= 80 ? "You're doing great! Keep going." : 'Keep going, you\u2019re getting closer.'}
          </p>
        </div>
        <Link to={readiness.missing.length > 0 ? getReadinessFixLink(readiness.missing) : '/profile'} className="mt-3 inline-block font-mono text-xs font-medium text-primary-600 hover:text-primary-400">
          {readiness.missing.length > 0 ? "Let's fix it" : 'View My Progress'}
        </Link>
      </div>

      {/* Remaining sections (locked layout position 8): supporting career
          tools, unchanged content, repositioned below the fold. */}

      {/* Stat cards */}
      <div className="overflow-hidden rounded-xl border border-border shadow-sm">
        <div className="grid gap-0 lg:grid-cols-3">
          <div className="border-b border-border p-5 lg:border-b-0 lg:border-r">
            <p className="text-sm font-semibold text-ink-muted">Applications</p>
            <p className="mt-2 font-mono text-3xl font-bold text-ink">{activeApplications.length}</p>
            <p className="text-xs text-ink-muted">
              Active applications{newThisWeek > 0 && <span className="text-primary-600"> \u2022 {newThisWeek} new this week</span>}
            </p>
            <Link to="/applications" className="mt-3 inline-block font-mono text-xs font-medium text-primary-600 hover:text-primary-400">
              View Applications
            </Link>
          </div>

          <div className="border-b border-border p-5 lg:border-b-0 lg:border-r">
            <p className="text-sm font-semibold text-ink-muted">Interviews</p>
            <p className="mt-2 font-mono text-3xl font-bold text-ink">{upcomingInterviewApps.length}</p>
            <p className="text-xs text-ink-muted">
              {nextInterview
                ? `Next: ${new Date(nextInterview.interview_date!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
                : 'Upcoming interviews'}
            </p>
            <Link to="/interviews" className="mt-3 inline-block font-mono text-xs font-medium text-primary-600 hover:text-primary-400">
              View Interviews
            </Link>
          </div>

          <div className="p-5">
            <p className="text-sm font-semibold text-ink-muted">Messages</p>
            <p className="mt-2 font-mono text-3xl font-bold text-ink">{unreadMessages.length}</p>
            <p className="text-xs text-ink-muted">Unread messages</p>
            <Link to="/messages" className="mt-3 inline-block font-mono text-xs font-medium text-primary-600 hover:text-primary-400">
              Open Messages
            </Link>
          </div>
        </div>

        <div className="flex flex-col items-start justify-between gap-4 border-t border-border bg-surface-subtle p-5 sm:flex-row sm:items-center">
          <div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-ink-muted">On Call</p>
            <p className="mt-1 text-sm font-semibold text-ink">Your Career Strategist</p>
            <p className="mt-1 text-xs text-ink-muted">Typically replies within 24 hrs.</p>
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
        <div className="rounded-xl border border-dashed border-border bg-surface-subtle p-5 lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-3">
              <Lightbulb className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary-600" />
              <div>
                <p className="text-sm font-semibold text-ink">Tip of the Day</p>
                <p className="mt-1 text-xs text-ink-muted">{tip}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Flag className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary-600" />
              <div>
                <p className="text-sm font-semibold text-ink">Daily Motivation</p>
                <p className="mt-1 text-xs italic text-ink-muted">\u201c{motivation}\u201d</p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-ink">Upcoming</p>
            <Link to="/calendar" className="font-mono text-xs font-medium text-primary-600 hover:text-primary-400">
              View Calendar
            </Link>
          </div>
          {upcomingEvents.length > 0 ? (
            <div className="mt-3 space-y-3">
              {upcomingEvents.map((event) => (
                <div key={event.id} className="flex items-start gap-2">
                  <Calendar className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary-600" />
                  <div>
                    <p className="text-xs font-medium text-ink">{event.title}</p>
                    <p className="text-[11px] text-ink-muted">
                      {new Date(event.start_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })},{' '}
                      {new Date(event.start_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-xs text-ink-muted">Nothing scheduled yet.</p>
          )}
          <Link to="/calendar" className="mt-3 inline-block font-mono text-xs font-medium text-primary-600 hover:text-primary-400">
            See all upcoming &rarr;
          </Link>
        </div>
      </div>

      {/* Recommended + Progress */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-ink">Recommended for You</h2>
            <Link to="/tools" className="font-mono text-xs font-medium text-primary-600 hover:text-primary-400">
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

        <div className="rounded-xl border border-border bg-surface-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-ink">Your Progress This Week</h2>
            <Link to="/timeline" className="font-mono text-xs font-medium text-primary-600 hover:text-primary-400">
              View Full Report
            </Link>
          </div>
          <div className="mt-4 space-y-4">
            <ProgressBar label="Applications Submitted" value={submittedThisWeek} max={applicationsGoal} display={`${submittedThisWeek} / ${applicationsGoal}`} />
            <ProgressBar label="Profile Completeness" value={readiness.score} max={100} display={`${readiness.score}%`} />
            <ProgressBar label="Interview Prep" value={interviewPrepPct} max={100} display={`${interviewPrepPct}%`} />
            <ProgressBar label="Messages Responded" value={messagesRespondedPct} max={100} display={`${messagesRespondedPct}%`} />
          </div>
          <div className="mt-4 rounded-lg border border-dashed border-border p-4">
            <p className="text-sm font-semibold text-ink">Keep the momentum!</p>
            <p className="mt-1 text-xs text-ink-muted">
              You've taken {activeApplications.length + submittedThisWeek} steps forward this week. You're building something great.
            </p>
          </div>
        </div>
      </div>

      {/* Forward Feed */}
      <div className="mt-6 rounded-xl border border-border bg-surface-card p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-ink">The Forward Feed</h2>
          <Link to="/forward-feed" className="font-mono text-xs font-medium text-primary-600 hover:text-primary-400">
            Visit The Forward Feed &rarr;
          </Link>
        </div>
        {recentPosts.length === 0 ? (
          <p className="mt-4 text-sm text-ink-muted">New articles are on the way &mdash; check back soon.</p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {recentPosts.map((post) => (
              <Link
                key={post.id}
                to={`/forward-feed/${post.slug}`}
                className="rounded-lg border border-border border-l-4 border-l-primary-600 p-4 shadow-sm transition-[border-color,box-shadow] hover:border-l-primary-400 hover:shadow-md"
              >
                <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-primary-300">{post.category}</p>
                <p className="mt-1 text-sm font-medium text-ink">{post.title}</p>
                <p className="mt-2 font-mono text-xs text-ink-muted">{post.read_time_minutes} min read</p>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Quick Access Tools */}
      <div className="mt-6 rounded-xl border border-border bg-surface-card p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-ink">Quick Access Tools</h2>
          <Link to="/tools" className="font-mono text-xs font-medium text-primary-600 hover:text-primary-400">
            View All Tools &rarr;
          </Link>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-7">
          {TOOL_TILES.map((tool) => (
            <Link key={tool.label} to={tool.to} className="flex flex-col items-center gap-2 rounded-lg border border-transparent p-3 text-center transition-colors hover:border-border hover:bg-surface-hover">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-surface-subtle">
                <tool.icon className="h-5 w-5 text-ink-muted" />
              </div>
              <span className="text-[11px] font-medium text-ink-muted">{tool.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </MemberLayout>
  )
}

/**
 * Task 7: Career Vault graceful placeholder. This branch has no
 * `career_wins` table, no `/career-vault` route, and no Career Vault
 * component to reuse (that work is unmerged, on a separate branch).
 * Deliberately the least-polished card on the page -- an honest
 * reflection of its actual current state, not something to over-build:
 * static, prop-less, zero queries, and no link/href at all (there's
 * nothing real to link to yet, so no dead `href="#"` either).
 */
function CareerVaultPlaceholderCard() {
  return (
    <div className="mt-6 rounded-xl border border-dashed border-border bg-surface-subtle p-6">
      <div className="flex items-center gap-3">
        <Archive className="h-5 w-5 flex-shrink-0 text-ink-muted" />
        <div>
          <h2 className="font-display text-base font-semibold text-ink-muted">Career Vault — coming soon</h2>
          <p className="mt-1 text-xs text-ink-muted">
            Track evidence-backed career wins here once Career Vault ships.
          </p>
        </div>
      </div>
    </div>
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
    <div className="flex items-center justify-between gap-3 border-l-2 border-border pl-3">
      <div className="flex items-center gap-3">
        <Icon className="h-5 w-5 flex-shrink-0 text-primary-600" />
        <div>
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium text-ink">{title}</p>
            {tag && (
              <span className="rounded-full border border-accent-700 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-accent-300">
                {tag}
              </span>
            )}
            {locked && <Lock className="h-3 w-3 text-ink-muted" />}
          </div>
          <p className="text-xs text-ink-muted">{description}</p>
        </div>
      </div>
      <Link
        to={to}
        className="flex-shrink-0 rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-ink-muted transition-colors hover:border-primary-700 hover:bg-primary-950 hover:text-primary-300"
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
        <p className="text-xs font-medium text-ink-muted">{label}</p>
        <p className="font-mono text-xs font-semibold text-ink">{display}</p>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full border border-border bg-surface-subtle">
        <div className="h-full rounded-full bg-primary-600 transition-all duration-700" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
