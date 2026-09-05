import { CircularProgress } from '@/components/CircularProgress'
import { isSafeHttpUrl } from '@/lib/url'
import { getFreshFitTier } from '@/lib/opportunityEngineTiers'
import { MapPin, DollarSign, ExternalLink, X } from 'lucide-react'
import type { JobMatchWithJob } from '@/types'

/** Tier -> left-accent color, matched to the same neutral presentation
 * tiers used for grouping (see opportunityEngineTiers.ts). Promoted
 * matches override this with a muted neutral treatment regardless of
 * tier -- de-emphasis, not a fourth tier. */
const TIER_ACCENT: Record<string, string> = {
  highest: 'border-l-success-500',
  stronger: 'border-l-primary-500',
  other: 'border-l-neutral-300',
}

export function MatchCard({ match, onDismiss }: { match: JobMatchWithJob; onDismiss: (matchId: string) => void }) {
  const job = match.scraped_job
  const isPromoted = !!match.promoted_opportunity_id
  const tier = getFreshFitTier(match.fresh_fit_score)

  return (
    <div
      className={`rounded-xl border border-neutral-200 border-l-4 bg-white p-6 shadow-sm transition-opacity ${
        isPromoted ? 'border-l-neutral-300 opacity-70' : TIER_ACCENT[tier]
      }`}
    >
      {/* Score + dismiss stay on one top row even on mobile; the job
          details flow full-width below -- avoids squeezing a 56px badge,
          multi-line text, and a button into one row on narrow screens. */}
      <div className="flex items-start justify-between gap-4">
        <CircularProgress value={match.fresh_fit_score} size={56} strokeWidth={5} suffix="" label="FreshFit" />
        <button
          onClick={() => onDismiss(match.id)}
          aria-label="Dismiss match"
          className="flex-shrink-0 rounded-full p-2 text-neutral-400 transition-colors hover:bg-neutral-50 hover:text-neutral-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3">
        {isPromoted && (
          <span className="rounded-full border border-accent-300 px-2.5 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wide text-accent-700">
            Sent to Strategist
          </span>
        )}
        <h3 className="mt-1 font-display text-lg font-semibold text-neutral-900">{job.title}</h3>
        <p className="text-sm text-neutral-600">{job.company}</p>

        <div className="mt-3 flex flex-wrap gap-3 text-xs text-neutral-500">
          {job.location && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {job.location}
            </span>
          )}
          {job.salary_text && (
            <span className="flex items-center gap-1">
              <DollarSign className="h-3.5 w-3.5" />
              {job.salary_text}
            </span>
          )}
        </div>

        {match.matched_skills.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {match.matched_skills.map((skill) => (
              <span key={skill} className="rounded-full border border-success-300 px-2 py-0.5 font-mono text-[11px] font-medium text-success-700">
                {skill}
              </span>
            ))}
          </div>
        )}

        {isSafeHttpUrl(job.posting_url) && (
          <a
            href={job.posting_url}
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
  )
}
