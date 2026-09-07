import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MemberLayout } from '@/components/MemberLayout'
import { useAuth } from '@/context/AuthContext'
import { useBadges } from '@/hooks/useBadges'
import { AchievementBadgeCircle } from '@/components/Badges'
import { getRoadmapMilestones, groupRoadmapMilestones, formatRoadmapEventDate } from '@/lib/roadmap'
import { Map, Loader2, MessageSquare, Flag, CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react'
import type { CareerTimelineEvent } from '@/types'

// Same rounded-2xl + shadow-sm card chrome introduced on Opportunity Engine
// (Sub-Project 3) and carried through every subsequent redesigned surface --
// RoadmapPage was the one page still on the old flat, shadow-less treatment
// before this pass.
const CARD_CLASS = 'rounded-2xl border border-border bg-surface-card p-6 shadow-sm'

function MilestoneRow({ milestone, overdue = false }: { milestone: CareerTimelineEvent; overdue?: boolean }) {
  return (
    <div
      className={`flex items-start gap-3 border-l-4 ${overdue ? 'border-l-error-500' : 'border-l-primary-600'} ${CARD_CLASS}`}
    >
      <Flag
        className={`mt-0.5 h-5 w-5 flex-shrink-0 ${overdue ? 'text-error-500' : 'text-primary-600'}`}
        aria-hidden="true"
      />
      <div>
        <p className="text-sm font-semibold text-ink">{milestone.event_title}</p>
        {milestone.event_description && <p className="text-sm text-ink-muted">{milestone.event_description}</p>}
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <p className="text-xs text-ink-muted">{formatRoadmapEventDate(milestone.event_date)}</p>
          {overdue && (
            <span className="inline-flex items-center gap-1 rounded-full bg-error-950 px-2 py-0.5 text-[11px] font-semibold text-error-400">
              <AlertTriangle className="h-3 w-3" aria-hidden="true" />
              Overdue
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export function RoadmapPage() {
  const { user } = useAuth()
  const { earnedBadges, hasBadge } = useBadges(user?.id)
  const [milestones, setMilestones] = useState<CareerTimelineEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    if (!user) return
    setLoading(true)
    setError(null)
    getRoadmapMilestones(user.id).then(({ milestones: data, error: fetchError }) => {
      if (fetchError) {
        setError(fetchError)
      } else {
        setMilestones(data)
      }
      setLoading(false)
    })
    // Deliberately depends on the primitive id, not the `user` object
    // itself -- some auth context implementations (and this page's own
    // test mocks) return a new object identity on every render, which
    // would otherwise re-trigger this effect on every re-render instead
    // of only when the signed-in user actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  useEffect(() => {
    load()
  }, [load])

  const careerBuilderBadge = earnedBadges.find((mb) => mb.badge?.slug === 'career-builder')?.badge
  const { next, upcoming, overdue } = groupRoadmapMilestones(milestones, new Date())
  const hasAnyMilestones = milestones.length > 0

  return (
    <MemberLayout>
      <div className="mb-6 flex items-center gap-2">
        <Map className="h-6 w-6 text-primary-600" aria-hidden="true" />
        <div>
          <h1 className="font-serif text-2xl font-semibold text-ink sm:text-3xl">Career Roadmap</h1>
          <p className="mt-1 text-sm text-ink-muted">
            A long-term, personalized plan for where your career goes next.
          </p>
        </div>
      </div>

      {careerBuilderBadge && (
        <div className={`mb-6 flex items-center gap-4 border-l-4 border-l-accent-500 ${CARD_CLASS}`}>
          <AchievementBadgeCircle badge={careerBuilderBadge} size="md" />
          <div>
            <p className="font-serif text-sm font-semibold text-ink">Career Builder badge earned!</p>
            <p className="text-xs text-ink-muted">You completed a full Career Roadmap with your strategist.</p>
          </div>
        </div>
      )}

      <div aria-live="polite">
        {loading ? (
          <div role="status" className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary-600" aria-hidden="true" />
            <span className="sr-only">Loading your roadmap&hellip;</span>
          </div>
        ) : error ? (
          <div role="alert" className={`${CARD_CLASS} text-center`}>
            <AlertCircle className="mx-auto h-8 w-8 text-error-500" aria-hidden="true" />
            <p className="mt-3 text-sm text-ink">We couldn&apos;t load your roadmap right now.</p>
            <button
              type="button"
              onClick={load}
              className="mt-4 rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
            >
              Try again
            </button>
          </div>
        ) : !hasAnyMilestones ? (
          <div className={`${CARD_CLASS} p-12 text-center`}>
            <Map className="mx-auto h-12 w-12 text-ink-muted" aria-hidden="true" />
            <p className="mt-4 text-sm text-ink-muted">
              Your roadmap hasn&apos;t been built yet. Your Career Strategist will work with you to map out
              promotion timelines, skill goals, and long-term milestones.
            </p>
            <Link
              to="/messages"
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700"
            >
              <MessageSquare className="h-4 w-4" aria-hidden="true" />
              Ask your Strategist to build one
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {next && (
              <div>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  Next milestone
                </h2>
                <MilestoneRow milestone={next} />
              </div>
            )}

            {!next && overdue.length > 0 && (
              <div className="flex items-center gap-2 rounded-2xl border border-warning-700 bg-warning-950 p-4 text-sm text-warning-300">
                <AlertTriangle className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                <p>
                  You have no upcoming milestones -- check in with your Career Strategist about the
                  {overdue.length === 1 ? ' one that is' : ' ones that are'} past due.
                </p>
              </div>
            )}

            {upcoming.length > 0 && (
              <div>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Upcoming</h2>
                <div className="space-y-3">
                  {upcoming.map((m) => (
                    <MilestoneRow key={m.id} milestone={m} />
                  ))}
                </div>
              </div>
            )}

            {overdue.length > 0 && (
              <div>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Overdue</h2>
                <div className="space-y-3">
                  {overdue.map((m) => (
                    <MilestoneRow key={m.id} milestone={m} overdue />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {hasBadge('goal-achieved') && (
        <div className="mt-6 flex items-center gap-2 rounded-2xl border border-success-700 bg-success-950 p-4 text-success-300">
          <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
          <p className="text-sm font-medium">You&apos;ve achieved a major career goal on your roadmap. Nicely done.</p>
        </div>
      )}
    </MemberLayout>
  )
}
