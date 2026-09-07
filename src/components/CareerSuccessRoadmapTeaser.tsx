import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { getTimeline } from '@/lib/profile'
import { Map, Loader2, ArrowRight } from 'lucide-react'
import type { CareerTimelineEvent } from '@/types'

const CARD_CLASS = 'rounded-2xl border border-border bg-surface-card p-6 shadow-sm'

// Identical filter to RoadmapPage.tsx, copied verbatim rather than
// reimplemented -- this teaser must never diverge from what /roadmap itself
// considers a "roadmap milestone."
function isRoadmapEvent(event: CareerTimelineEvent) {
  return event.event_type === 'career_roadmap' || event.event_type === 'promotion_coaching'
}

/**
 * "Your roadmap" teaser for Career Success (Sub-Project 7).
 *
 * Honest link-out only -- per the approved spec, this sub-project does not
 * fix the underlying data-gap where nothing in the codebase currently
 * writes a 'career_roadmap'/'promotion_coaching' timeline event, so this
 * teaser will show its true-empty state for every real member today. That
 * is expected and must read as a normal, in-progress relationship with a
 * strategist -- not as an error. No fake milestone content is ever shown.
 */
export function CareerSuccessRoadmapTeaser() {
  const { user } = useAuth()
  const [milestones, setMilestones] = useState<CareerTimelineEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }
    let cancelled = false

    getTimeline(user.id)
      .then((data) => {
        if (cancelled) return
        setMilestones(data.filter(isRoadmapEvent))
      })
      .catch((err) => {
        console.error('Error loading timeline for the Roadmap teaser:', err)
        if (!cancelled) setMilestones([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [user])

  const mostRecent = milestones[0]

  return (
    <div className={CARD_CLASS}>
      <div className="flex items-center gap-2">
        <Map className="h-5 w-5 text-primary-600" />
        <h2 className="font-display !text-lg font-semibold text-ink">Your roadmap</h2>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
        </div>
      ) : milestones.length > 0 && mostRecent ? (
        <div className="mt-3">
          <p className="text-sm text-ink">
            You have {milestones.length} roadmap milestone{milestones.length === 1 ? '' : 's'}.
          </p>
          <p className="mt-1 text-sm text-ink-muted">Most recent: {mostRecent.event_title}</p>
          <Link
            to="/roadmap"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-400"
          >
            View your roadmap
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-sm text-ink-muted">
            Your roadmap hasn&apos;t been built yet. Ask your Career Strategist to build one.
          </p>
          <Link
            to="/roadmap"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-400"
          >
            View your roadmap
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      )}
    </div>
  )
}
