import { useEffect, useMemo, useState } from 'react'
import { MemberLayout } from '@/components/MemberLayout'
import { SubmitJobModal } from '@/components/SubmitJobModal'
import { MatchFilterBar } from '@/components/opportunityEngine/MatchFilterBar'
import { MatchCard } from '@/components/opportunityEngine/MatchCard'
import { EmptyMatchesState } from '@/components/opportunityEngine/EmptyMatchesState'
import { useAuth } from '@/context/AuthContext'
import { getJobMatches, dismissJobMatch } from '@/lib/opportunityEngine'
import { DEFAULT_FILTER_STATE, filterAndSortMatches, type MatchFilterState } from '@/lib/opportunityEngineFilters'
import { getFreshFitTier, PRESENTATION_TIER_LABELS, type PresentationTier } from '@/lib/opportunityEngineTiers'
import { Loader2, Sparkles, PlusCircle } from 'lucide-react'
import type { JobMatchWithJob } from '@/types'

/** Render order for tier sections -- highest first, so the strongest
 * matches are always what a member sees first regardless of how the
 * underlying list is sorted internally. */
const TIER_ORDER: PresentationTier[] = ['highest', 'stronger', 'other']

export function OpportunityEnginePage() {
  const { user, profile } = useAuth()
  const [matches, setMatches] = useState<JobMatchWithJob[]>([])
  const [loading, setLoading] = useState(true)
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [filters, setFilters] = useState<MatchFilterState>(DEFAULT_FILTER_STATE)

  useEffect(() => {
    if (!user) return
    getJobMatches(user.id).then((data) => {
      setMatches(data)
      setLoading(false)
    })
  }, [user])

  const handleDismiss = async (matchId: string) => {
    await dismissJobMatch(matchId)
    setMatches((prev) => prev.filter((m) => m.id !== matchId))
  }

  const visibleMatches = useMemo(() => filterAndSortMatches(matches, filters), [matches, filters])

  const tierGroups = useMemo(() => {
    const groups: Record<PresentationTier, JobMatchWithJob[]> = { highest: [], stronger: [], other: [] }
    for (const match of visibleMatches) {
      groups[getFreshFitTier(match.fresh_fit_score)].push(match)
    }
    return groups
  }, [visibleMatches])

  if (loading) {
    return (
      <MemberLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      </MemberLayout>
    )
  }

  return (
    <MemberLayout>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 font-display text-2xl font-semibold text-neutral-900 sm:text-3xl">
          <Sparkles className="h-6 w-6 text-primary-600" />
          Opportunity Engine
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          Job postings automatically matched against your Career Profile, scored by FreshFit.
          Strong matches get promoted to your Career Strategist for review.
        </p>
        <button
          onClick={() => setShowSubmitModal(true)}
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
        >
          <PlusCircle className="h-4 w-4" />
          Submit a Job
        </button>
      </div>

      {matches.length === 0 ? (
        <EmptyMatchesState />
      ) : (
        <>
          <MatchFilterBar filters={filters} onChange={setFilters} />

          {visibleMatches.length === 0 ? (
            <p className="mt-6 rounded-xl border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
              No matches found for these filters. Try clearing one to see more.
            </p>
          ) : (
            <div className="mt-6 space-y-8">
              {TIER_ORDER.map((tier) => {
                const tierMatches = tierGroups[tier]
                if (tierMatches.length === 0) return null
                return (
                  <div key={tier}>
                    <h2 className="font-mono text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      {PRESENTATION_TIER_LABELS[tier]}
                    </h2>
                    <div className="mt-3 space-y-4">
                      {tierMatches.map((match) => (
                        <MatchCard key={match.id} match={match} onDismiss={handleDismiss} />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
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
