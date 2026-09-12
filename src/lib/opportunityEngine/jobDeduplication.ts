import { normalizeJobKey, getSourceReliability } from './jobNormalization'

/**
 * OE 2.0 Phase 1 -- conservative, exact-match-only job deduplication.
 *
 * Deliberately no fuzzy/embedding matching (per the brief): two jobs
 * are only ever considered the same posting when they produce an
 * identical `normalizeJobKey`. This will miss some true duplicates
 * (typos, wildly different location text for the same office), but it
 * can never collapse two genuinely distinct openings into one --
 * exactly the safer failure mode the brief asked for.
 *
 * This module is pure/read-only. It does not write `canonical_job_id`
 * anywhere -- that column does not exist in production yet (see
 * supabase/migrations/20260911000000_scraped_jobs_dedup.sql, prepared
 * for review, not applied). `scrapeCompanies.ts` currently uses this
 * only for a dry-run console report (`reportLikelyDuplicates`); wiring
 * `groupDuplicateCandidates`'s output into a real `canonical_job_id`
 * write, and having `syncFreshFitScores.ts` skip non-canonical rows, is
 * the follow-up once that migration is applied -- see this file's
 * `.test.ts` and the OE 2.0 plan doc for the exact next step.
 */

export interface JobKeyFields {
  title: string
  company: string
  location: string | null
}

export interface DedupCandidate extends JobKeyFields {
  id: string
  source: string
  postedAt: string | null
}

export interface DuplicateGroup {
  dedupeKey: string
  canonicalId: string
  duplicateIds: string[]
}

/**
 * Exact-key lookup: does `newJob` match any already-known canonical
 * job? Returns that job's id, or null if this is a genuinely new
 * posting. O(n) linear scan is intentional -- this runs once per newly
 * discovered job against a bounded "currently canonical" set, not a
 * hot path; an index-backed lookup is a query-layer concern for once
 * `canonical_job_id`/`normalized_key` are real columns.
 */
export function findDuplicateCandidate(
  newJob: JobKeyFields,
  existingCanonicalJobs: (JobKeyFields & { id: string })[]
): string | null {
  const key = normalizeJobKey(newJob.title, newJob.company, newJob.location)
  const match = existingCanonicalJobs.find(
    (job) => normalizeJobKey(job.title, job.company, job.location) === key
  )
  return match?.id ?? null
}

/**
 * Deterministic canonical pick between two jobs sharing a dedupe key:
 * 1. Prefer the more reliable source (SOURCE_RELIABILITY).
 * 2. Tie -> prefer the earliest posted date (first-seen wins).
 * 3. Still tied (e.g. both dates null) -> lower id wins, purely so the
 *    result is fully deterministic and never depends on array/object
 *    iteration order.
 */
export function pickCanonicalJob<T extends { id: string; source: string; postedAt: string | null }>(a: T, b: T): T {
  const reliabilityDiff = getSourceReliability(b.source) - getSourceReliability(a.source)
  if (reliabilityDiff !== 0) return reliabilityDiff > 0 ? b : a

  const aTime = a.postedAt ? new Date(a.postedAt).getTime() : Number.POSITIVE_INFINITY
  const bTime = b.postedAt ? new Date(b.postedAt).getTime() : Number.POSITIVE_INFINITY
  if (aTime !== bTime) return aTime < bTime ? a : b

  return a.id <= b.id ? a : b
}

/**
 * Groups an arbitrary batch of jobs (e.g. every currently active
 * `scraped_jobs` row, across every source) by exact dedupe key, and
 * picks one canonical job per group. Purely read-only/reporting --
 * never mutates its input or any store. Groups of size 1 (no
 * duplicate) are omitted from the result.
 */
export function groupDuplicateCandidates<T extends DedupCandidate>(jobs: T[]): DuplicateGroup[] {
  const byKey = new Map<string, T[]>()
  for (const job of jobs) {
    const key = normalizeJobKey(job.title, job.company, job.location)
    byKey.set(key, [...(byKey.get(key) ?? []), job])
  }

  const groups: DuplicateGroup[] = []
  for (const [dedupeKey, group] of byKey) {
    if (group.length < 2) continue
    const canonical = group.reduce((best, candidate) => pickCanonicalJob(best, candidate))
    groups.push({
      dedupeKey,
      canonicalId: canonical.id,
      duplicateIds: group.filter((job) => job.id !== canonical.id).map((job) => job.id),
    })
  }
  return groups
}
