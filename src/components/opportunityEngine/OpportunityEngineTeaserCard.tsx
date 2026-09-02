import { Link } from 'react-router-dom'
import { CircularProgress } from '@/components/CircularProgress'
import { Sparkles } from 'lucide-react'
import type { JobMatchWithJob } from '@/types'

/**
 * Dashboard's "light" Opportunity Engine integration (Phase 1): a clear
 * entry point, the strongest active match surfaced where one exists, and
 * one obvious CTA -- visually built from the same Opportunity Engine 2.0
 * design system (rounded-xl/shadow-sm card, extended CircularProgress).
 * Deliberately does not duplicate the full matches experience -- that
 * lives entirely on OpportunityEnginePage.
 */
export function OpportunityEngineTeaserCard({ topMatch }: { topMatch: JobMatchWithJob | null }) {
  return (
    <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-base font-semibold text-neutral-900">
          <Sparkles className="h-4 w-4 text-primary-600" />
          Opportunity Engine
        </h2>
      </div>

      {topMatch ? (
        <div className="mt-4 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <CircularProgress value={topMatch.fresh_fit_score} size={56} strokeWidth={5} suffix="" label="FreshFit" />
            <div>
              <p className="text-sm font-medium text-neutral-900">{topMatch.scraped_job.title}</p>
              <p className="text-xs text-neutral-500">{topMatch.scraped_job.company}</p>
            </div>
          </div>
          <Link
            to="/opportunity-engine"
            className="w-full flex-shrink-0 rounded-full bg-primary-600 px-4 py-2 text-center text-sm font-semibold text-white transition-colors hover:bg-primary-700 sm:w-auto"
          >
            View Opportunity Engine
          </Link>
        </div>
      ) : (
        <div className="mt-4 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-neutral-500">
            Job postings matched to your Career Profile, scored by FreshFit, will show up here.
          </p>
          <Link
            to="/opportunity-engine"
            className="w-full flex-shrink-0 rounded-full bg-primary-600 px-4 py-2 text-center text-sm font-semibold text-white transition-colors hover:bg-primary-700 sm:w-auto"
          >
            Open Opportunity Engine
          </Link>
        </div>
      )}
    </div>
  )
}
