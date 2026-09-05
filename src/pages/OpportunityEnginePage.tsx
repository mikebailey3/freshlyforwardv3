import { useEffect, useState } from 'react'
import { MemberLayout } from '@/components/MemberLayout'
import { SubmitJobModal } from '@/components/SubmitJobModal'
import { FreshFitBadge } from '@/components/freshFit/FreshFitBadge'
import { FreshFitDetails } from '@/components/freshFit/FreshFitDetails'
import { useAuth } from '@/context/AuthContext'
import { getJobMatches, dismissJobMatch } from '@/lib/opportunityEngine'
import { isSafeHttpUrl } from '@/lib/url'
import { Loader2, MapPin, DollarSign, ExternalLink, X, Sparkles, PlusCircle } from 'lucide-react'
import type { JobMatchScoreBreakdown, JobMatchWithJob } from '@/types'

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
      <div className="mb-6">
        <h1 className="flex items-center gap-2 font-serif text-2xl font-semibold text-neutral-900 sm:text-3xl">
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
        <div className="border border-neutral-200 bg-white p-12 text-center">
          <Sparkles className="mx-auto h-12 w-12 text-neutral-300" />
          <p className="mt-4 text-sm text-neutral-500">
            No matches yet. Keep your Career Profile (skills, preferred roles) up to date to improve matching.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {matches.map((match) => (
            <div key={match.id} className="border border-neutral-200 border-l-4 border-l-primary-600 bg-white p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <FreshFitBadge score={match.fresh_fit_score} />
                    {match.promoted_opportunity_id && (
                      <span className="border border-accent-300 px-2.5 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wide text-accent-700">
                        Sent to Strategist
                      </span>
                    )}
                  </div>
                  <h3 className="mt-3 font-serif text-lg font-semibold text-neutral-900">{match.scraped_job.title}</h3>
                  <p className="text-sm text-neutral-600">{match.scraped_job.company}</p>

                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-neutral-500">
                    {match.scraped_job.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {match.scraped_job.location}
                      </span>
                    )}
                    {match.scraped_job.salary_text && (
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-3.5 w-3.5" />
                        {match.scraped_job.salary_text}
                      </span>
                    )}
                  </div>

                  {match.matched_skills.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {match.matched_skills.map((skill) => (
                        <span key={skill} className="border border-success-300 px-2 py-0.5 font-mono text-[11px] font-medium text-success-700">
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}

                  {isSafeHttpUrl(match.scraped_job.posting_url) && (
                    <a
                      href={match.scraped_job.posting_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary-600 hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      View Posting
                    </a>
                  )}

                  <FreshFitDetails breakdown={match.score_breakdown as JobMatchScoreBreakdown} />
                </div>

                <button
                  onClick={() => handleDismiss(match.id)}
                  aria-label="Dismiss match"
                  className="p-2 text-neutral-400 transition-colors hover:bg-neutral-50 hover:text-neutral-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
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
