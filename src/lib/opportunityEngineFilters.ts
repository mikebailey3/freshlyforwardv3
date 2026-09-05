import type { JobMatchWithJob } from '@/types'
import { getFreshFitTier, type PresentationTier, type PresentationTierThresholds, DEFAULT_PRESENTATION_TIERS } from './opportunityEngineTiers'

const MS_PER_DAY = 86400000

export type MatchSortBy = 'score' | 'newest'

/** Client-side filter/sort state for the Opportunity Engine matches list.
 * Everything here operates on data already fetched by `getJobMatches` --
 * no new Supabase queries, no backend changes. */
export interface MatchFilterState {
  sortBy: MatchSortBy
  /** Only show matches whose presentation tier is at or above this one
   * (highest > stronger > other). Undefined means no tier filtering. */
  minTier: PresentationTier | undefined
  locationText: string
  remoteOnly: boolean
  salaryListedOnly: boolean
  newThisWeekOnly: boolean
  employmentType: string | undefined
}

export const DEFAULT_FILTER_STATE: MatchFilterState = {
  sortBy: 'score',
  minTier: undefined,
  locationText: '',
  remoteOnly: false,
  salaryListedOnly: false,
  newThisWeekOnly: false,
  employmentType: undefined,
}

const TIER_RANK: Record<PresentationTier, number> = { other: 0, stronger: 1, highest: 2 }

export function isRemoteLocation(location: string | null): boolean {
  if (!location) return false
  return location.toLowerCase().includes('remote')
}

/** The best available "when is this" timestamp for a match: `posted_at`
 * when the source ATS provided one, otherwise `scraped_at` (always
 * present, reflects when our own pipeline first saw it). */
export function getMatchDate(match: JobMatchWithJob): string {
  return match.scraped_job.posted_at ?? match.scraped_job.scraped_at
}

export function isNewThisWeek(match: JobMatchWithJob): boolean {
  const date = getMatchDate(match)
  if (!date) return false
  return Date.now() - new Date(date).getTime() <= 7 * MS_PER_DAY
}

export function filterAndSortMatches(
  matches: JobMatchWithJob[],
  filters: MatchFilterState,
  tierThresholds: PresentationTierThresholds = DEFAULT_PRESENTATION_TIERS
): JobMatchWithJob[] {
  const filtered = matches.filter((match) => {
    const job = match.scraped_job

    if (filters.minTier) {
      const tier = getFreshFitTier(match.fresh_fit_score, tierThresholds)
      if (TIER_RANK[tier] < TIER_RANK[filters.minTier]) return false
    }

    if (filters.locationText.trim()) {
      const needle = filters.locationText.trim().toLowerCase()
      if (!job.location?.toLowerCase().includes(needle)) return false
    }

    if (filters.remoteOnly && !isRemoteLocation(job.location)) return false
    if (filters.salaryListedOnly && !job.salary_text) return false
    if (filters.newThisWeekOnly && !isNewThisWeek(match)) return false
    if (filters.employmentType && job.employment_type !== filters.employmentType) return false

    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    if (filters.sortBy === 'newest') {
      const dateA = getMatchDate(a)
      const dateB = getMatchDate(b)
      if (!dateA && !dateB) return 0
      if (!dateA) return 1
      if (!dateB) return -1
      return new Date(dateB).getTime() - new Date(dateA).getTime()
    }
    return b.fresh_fit_score - a.fresh_fit_score
  })

  return sorted
}
