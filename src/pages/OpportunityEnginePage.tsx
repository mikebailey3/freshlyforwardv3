import { useEffect, useState } from 'react'
import { MemberLayout } from '@/components/MemberLayout'
import { SubmitJobModal } from '@/components/SubmitJobModal'
import { JobMatchCard } from '@/components/opportunityEngine/JobMatchCard'
import { useAuth } from '@/context/AuthContext'
import { getJobMatches, dismissJobMatch } from '@/lib/opportunityEngine'
import { Loader2, Sparkles, PlusCircle } from 'lucide-react'
import type { JobMatchWithJob } from '@/types'

export function OpportunityEnginePage() {
  const { user, profile } = useAuth()
  const [matches, setMatches] = useState<JobMatchWithJob[]>([])
  const [loading, setLoading] = useState(true)
  const [showSubmitModal, setShowSubmitModal] = useState(false)

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
        <div className="space-y-5">
          {matches.map((match) => (
            <JobMatchCard key={match.id} match={match} onDismiss={handleDismiss} />
          ))}
        </div>
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
