import { normalizeJob, type JobLike } from './jobNormalization'

/**
 * OE 2.0 Phase 7 -- Career-Market Intelligence.
 *
 * IMPORTANT SCOPE NOTE (read before extending this file): the approved
 * plan's Phase 7 deliverable is a new `market_intelligence_snapshots`
 * table plus `scripts/computeMarketIntelligence.ts` to populate it.
 * Per this phase's explicit instructions, creating/applying that new
 * table is a schema decision requiring separate, explicit approval --
 * it has NOT been created or applied. This file therefore contains
 * ONLY the pure, database-free aggregation logic (fully built and
 * tested so the eventual persistence script is a thin wrapper once the
 * table is approved) -- see the Phase 7 completion report for the
 * exact CREATE TABLE statement awaiting a decision.
 *
 * Privacy boundary (locked for this entire module): the only input
 * type accepted anywhere in this file is `JobLike` -- a public
 * job-posting shape (title/company/location/description/salary_text/
 * employment_type/posting_url/posted_at/source). It has no member_id,
 * no member profile field, and no Career Vault/Forward DNA/resume data
 * anywhere on it, so there is no member-keyed join possible here, by
 * construction -- not just by convention. Every output field is either
 * a count, a derived statistic, or text taken verbatim from public job
 * postings, never anything a member typed about themselves.
 *
 * Reuse, not reinvention: bucketing is built entirely on Phase 1's
 * already-tested `normalizeJob()` (title/location/salary/skills
 * normalization) and Phase 2's `findSkillsInText`/`parseSalaryRange`
 * (reused transitively through `normalizeJob`) -- this file adds no
 * new title-canonicalization or location-taxonomy logic of its own.
 * `roleBucket` is `normalizeJob().normalizedTitle` and `locationBucket`
 * is the job's parsed state when available, falling back to the full
 * normalized location text otherwise -- broader buckets read as more
 * useful aggregate market signal than one row per city, without
 * inventing a new geographic taxonomy.
 */

export interface MarketIntelligenceSnapshot {
  roleBucket: string
  locationBucket: string
  sampleSize: number
  /** null when no job in this bucket had a parseable salary -- never fabricated. */
  medianSalaryMin: number | null
  medianSalaryMax: number | null
  /** Most frequent skills across this bucket's postings, most-frequent first. */
  topSkills: string[]
}

/** How many of a bucket's most frequent skills to report -- a small, fixed, documented cap rather than an unbounded list. */
const TOP_SKILLS_PER_BUCKET = 10

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid]
}

interface BucketAccumulator {
  roleBucket: string
  locationBucket: string
  sampleSize: number
  salaryMins: number[]
  salaryMaxes: number[]
  skillCounts: Map<string, number>
}

/**
 * Groups jobs into (roleBucket, locationBucket) buckets and computes
 * each bucket's aggregate statistics. Pure and synchronous -- the
 * caller decides which jobs to pass in (e.g. `is_active`-only, a
 * specific scrape window); this function has no opinion about
 * freshness/staleness and performs no I/O of any kind.
 *
 * A job that normalizes to an empty title or location contributes no
 * bucket key of its own accord (never fabricated) -- it is simply
 * excluded from the aggregate output, same "no signal, no guess"
 * discipline used throughout this codebase's normalization layer.
 */
export function computeMarketIntelligenceSnapshots(jobs: JobLike[]): MarketIntelligenceSnapshot[] {
  const buckets = new Map<string, BucketAccumulator>()

  for (const job of jobs) {
    const normalized = normalizeJob(job)
    const roleBucket = normalized.normalizedTitle
    const locationBucket = normalized.normalizedLocation.state ?? normalized.normalizedLocation.normalized
    if (!roleBucket || !locationBucket) continue

    const bucketKey = JSON.stringify([roleBucket, locationBucket])
    const acc = buckets.get(bucketKey) ?? {
      roleBucket,
      locationBucket,
      sampleSize: 0,
      salaryMins: [],
      salaryMaxes: [],
      skillCounts: new Map<string, number>(),
    }

    acc.sampleSize++
    if (normalized.salaryRange) {
      acc.salaryMins.push(normalized.salaryRange.min)
      acc.salaryMaxes.push(normalized.salaryRange.max)
    }
    for (const skill of normalized.skills) {
      acc.skillCounts.set(skill, (acc.skillCounts.get(skill) ?? 0) + 1)
    }

    buckets.set(bucketKey, acc)
  }

  const snapshots: MarketIntelligenceSnapshot[] = [...buckets.values()].map((acc) => ({
    roleBucket: acc.roleBucket,
    locationBucket: acc.locationBucket,
    sampleSize: acc.sampleSize,
    medianSalaryMin: median(acc.salaryMins),
    medianSalaryMax: median(acc.salaryMaxes),
    topSkills: [...acc.skillCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, TOP_SKILLS_PER_BUCKET)
      .map(([skill]) => skill),
  }))

  return snapshots.sort(
    (a, b) =>
      b.sampleSize - a.sampleSize ||
      a.roleBucket.localeCompare(b.roleBucket) ||
      a.locationBucket.localeCompare(b.locationBucket)
  )
}
