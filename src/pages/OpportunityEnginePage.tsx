import { useEffect, useState } from 'react'
import { MemberLayout } from '@/components/MemberLayout'
import { SubmitJobModal } from '@/components/SubmitJobModal'
import { JobMatchCard } from '@/components/opportunityEngine/JobMatchCard'
import { RecurringGapCard } from '@/components/opportunityEngine/RecurringGapCard'
import { useAuth } from '@/context/AuthContext'
import { getJobMatches, dismissJobMatch } from '@/lib/opportunityEngine'
import { rankOpportunities, buildRankHighlight } from '@/lib/opportunityEngine/ranking'
import { getRecurringGaps, type RecurringGap } from '@/lib/opportunityEngine/recurringGaps'
import { Loader2, Sparkles, PlusCircle } from 'lucide-react'
import type { JobMatchWithJob } from '@/types'

// OE 2.0 Phase 4: below this many total matches, a "Top Opportunities /
// More Matches" split adds section-header noise without adding value
// (e.g. "top 3 of 2") -- progressive disclosure, same principle already
// used for StrategistOpportunityEnginePage's "Show flagged only" toggle.
const TOP_FEED_SIZE = 3

export function OpportunityEnginePage() {
  const { user, profile } = useAuth()
  const [matches, setMatches] = useState<JobMatchWithJob[]>([])
  const [recurringGaps, setRecurringGaps] = useState<RecurringGap[]>([])
  const [loading, setLoading] = useState(true)
  const [showSubmitModal, setShowSubmitModal] = useState(false)

  useEffect(() => {
    if (!user) return
    // OE 2.0 Phase 6: fetched alongside matches, not blocking on them --
    // the recurring-gap insight is a read-only aggregation over the
    // member's own already-scored history, independent of whichever
    // matches happen to be persisted right now.
    Promise.all([getJobMatches(user.id), getRecurringGaps(user.id)]).then(([matchData, gapData]) => {
      setMatches(matchData)
      setRecurringGaps(gapData)
      setLoading(false)
    })
  }, [user])

  const handleDismiss = async (matchId: string) => {
    await dismissJobMatch(matchId)
    setMatches((prev) => prev.filter((m) => m.id !== matchId))
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

  // OE 2.0 Phase 4: personalized ranking (FreshFit score + career-goal
  // alignment + posting freshness + qualification risk + evidence
  // strength -- see ranking.ts) replaces plain fresh_fit_score ordering
  // for display. The underlying `getJobMatches` fetch/persistence policy
  // is untouched; this only re-orders what's already been fetched.
  const ranked = rankOpportunities(matches)
  const showTopSection = ranked.length > TOP_FEED_SIZE
  const topOpportunities = showTopSection ? ranked.slice(0, TOP_FEED_SIZE) : []
  const remaining = showTopSection ? ranked.slice(TOP_FEED_SIZE) : ranked

  return (
    <MemberLayout>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-primary-500">
            Opportunity Intelligence
          </p>
          <h1 className="mt-1 flex items-center gap-2 font-display !text-2xl font-semibold text-ink sm:!text-3xl">
            <Sparkles className="h-6 w-6 flex-shrink-0 text-primary-500" />
            Opportunity Engine
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-muted">
            Job postings automatically matched against your Career Profile, scored by FreshFit.
            Strong matches get promoted to your Career Strategist for review.
          </p>
        </div>
        <button
          onClick={() => setShowSubmitModal(true)}
          className="inline-flex flex-shrink-0 items-center gap-2 rounded-full bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
        >
          <PlusCircle className="h-4 w-4" />
          Submit a Job
        </button>
      </div>

      {matches.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface-card p-12 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-950">
            <Sparkles className="h-8 w-8 text-primary-500" />
          </div>
          <p className="mx-auto mt-4 max-w-sm text-sm text-ink-muted">
            No matches yet. Keep your Career Profile (skills, preferred roles) up to date to improve matching,
            or submit a job you've found yourself below.
          </p>
        </div>
      ) : (
        <>
          <RecurringGapCard gaps={recurringGaps} />

          {showTopSection && (
            <div className="mb-8">
              <h2 className="mb-3 font-display text-lg font-semibold text-ink">Top Opportunities For You</h2>
              <div className="space-y-5">
                {topOpportunities.map(({ match, rank }) => (
                  <JobMatchCard
                    key={match.id}
                    match={match}
                    onDismiss={handleDismiss}
                    topPick
                    needsReview={rank.needsReview}
                    rankHighlight={buildRankHighlight(rank)}
                  />
                ))}
              </div>
            </div>
          )}

          <div>
            {showTopSection && <h2 className="mb-3 font-display text-lg font-semibold text-ink">More Matches</h2>}
            <div className="space-y-5">
              {remaining.map(({ match, rank }) => (
                <JobMatchCard
                  key={match.id}
                  match={match}
                  onDismiss={handleDismiss}
                  needsReview={rank.needsReview}
                  rankHighlight={buildRankHighlight(rank)}
                />
              ))}
            </div>
          </div>
        </>
      )}

      {showSubmitModal && profile && (
        <SubmitJobModal
          profile={profile}
          onClose={() => setShowSubmitModal(false)}
          onSubmitted={(match) => {
            setMatches((prev) => [match, ...prev])
            setShowSubmitModal(false)
          }}
        />
      )}
    </MemberLayout>
  )
}
