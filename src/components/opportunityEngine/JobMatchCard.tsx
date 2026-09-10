import { MapPin, DollarSign, ExternalLink, X, Sparkles } from 'lucide-react'
import { FreshFitBadge } from '@/components/freshFit/FreshFitBadge'
import { FreshFitDetails } from '@/components/freshFit/FreshFitDetails'
import { NeedsReviewBadge } from '@/components/opportunityEngine/NeedsReviewBadge'
import { isSafeHttpUrl } from '@/lib/url'
import type { JobMatchScoreBreakdown, JobMatchWithJob } from '@/types'

/**
 * Presentational match card, extracted from OpportunityEnginePage so the
 * premium card treatment (rounded surface, depth, hover state) lives in
 * one reusable place -- the same pattern this sub-project intentionally
 * sets up for Dashboard/Career Profile/Achievement Vault to adopt next,
 * rather than reinventing card chrome per page.
 *
 * FreshFitBadge/FreshFitDetails are consumed as-is (FreshFit 2.0 scope,
 * not touched here) -- only the surrounding card chrome changed.
 *
 * `topPick`/`needsReview`/`rankHighlight` are OE 2.0 Phase 4 additions,
 * all optional and default to nothing rendered -- existing callers with
 * just `match`/`onDismiss` are byte-for-byte unaffected.
 */
export function JobMatchCard({
  match,
  onDismiss,
  topPick = false,
  needsReview = false,
  rankHighlight = null,
}: {
  match: JobMatchWithJob
  onDismiss: (matchId: string) => void
  /** OE 2.0 Phase 4: this match is one of the member's top-ranked opportunities for today. Never shown alongside `needsReview` -- a flagged match is never presented as a shining pick, even if it mathematically survives near the top of a very short list. */
  topPick?: boolean
  /** OE 2.0 Phase 4: mirrors StrategistOpportunityEnginePage's identical flag/badge (Phase 3) -- same underlying `hasHardBlocker()` signal, same visual language, member-facing surface. */
  needsReview?: boolean
  /** OE 2.0 Phase 4: one-line "why this ranked here" hint from `buildRankHighlight()`, null when nothing about the match is a ranking standout. */
  rankHighlight?: string | null
}) {
  const job = match.scraped_job

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-surface-card p-6 shadow-sm transition-shadow hover:shadow-lg hover:shadow-black/20">
      {/* Score-tinted accent bar replaces the old flat border-l-4 --
          same "this card carries a score" signal, but as a soft top-edge
          glow consistent with the rounded-2xl surface instead of a sharp
          square-cornered stripe. */}
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary-600 via-primary-500 to-transparent" aria-hidden="true" />

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <FreshFitBadge score={match.fresh_fit_score} />
            {topPick && !needsReview && (
              <span className="inline-flex items-center gap-1 rounded-full border border-accent-700 bg-accent-950/40 px-2.5 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wide text-accent-300">
                <Sparkles className="h-3 w-3" />
                Top Pick
              </span>
            )}
            {needsReview && <NeedsReviewBadge />}
            {match.promoted_opportunity_id && (
              <span className="rounded-full border border-accent-700 px-2.5 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wide text-accent-300">
                Sent to Strategist
              </span>
            )}
          </div>

          <h3 className="mt-3 font-display text-lg font-semibold text-ink">{job.title}</h3>
          <p className="text-sm font-medium text-ink-muted">{job.company}</p>

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-muted">
            {job.location && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-primary-500" />
                {job.location}
              </span>
            )}
            {job.salary_text && (
              <span className="flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5 text-primary-500" />
                {job.salary_text}
              </span>
            )}
          </div>

          {rankHighlight && (
            <p className="mt-2 text-xs italic text-ink-muted">Why it's ranked here: {rankHighlight}</p>
          )}

          {match.matched_skills.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {match.matched_skills.map((skill) => (
                <span
                  key={skill}
                  className="rounded-full border border-success-700 bg-success-950/40 px-2.5 py-0.5 font-mono text-[11px] font-medium text-success-300"
                >
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
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary-400 transition-colors hover:text-primary-300 hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              View Posting
            </a>
          )}

          <FreshFitDetails breakdown={match.score_breakdown as JobMatchScoreBreakdown} />
        </div>

        <button
          onClick={() => onDismiss(match.id)}
          aria-label="Dismiss match"
          className="flex-shrink-0 rounded-full p-2 text-ink-muted opacity-60 transition-all hover:bg-surface-hover hover:text-ink hover:opacity-100 focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
