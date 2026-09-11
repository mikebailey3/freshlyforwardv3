/** Pure set-difference: ids that were active before but weren't seen in this run. */
export function selectJobsToDeactivate(existingActiveIds: string[], seenIdsThisRun: string[]): string[] {
  const seen = new Set(seenIdsThisRun)
  return existingActiveIds.filter((id) => !seen.has(id))
}

/** True when a posting hasn't been re-confirmed in longer than maxAgeDays. */
export function isStaleByAge(scrapedAt: string, maxAgeDays: number, now: Date = new Date()): boolean {
  const scrapedAtMs = new Date(scrapedAt).getTime()
  const ageMs = now.getTime() - scrapedAtMs
  return ageMs > maxAgeDays * 24 * 60 * 60 * 1000
}

// ---------------------------------------------------------------------
// OE 2.0 Phase 8 -- conservative stale/closed-role detection.
//
// `selectJobsToDeactivate` above is a same-run, single-observation set
// difference -- fine for reporting, but too trigger-happy to drive
// `is_active` directly: one successful-but-incomplete fetch (a
// pagination bug, a provider truncating results, a partial feed outage
// that still returns 200 OK) would otherwise mass-close jobs that never
// actually disappeared. The functions below add two independent guards
// on top of that same primitive:
//   1. isHealthyFetchResult -- refuses to trust a suspiciously-empty/
//      degraded fetch as evidence of anything at all.
//   2. nextMissCount/shouldDeactivateForMisses -- requires the SAME job
//      to be missing across MAX_CONSECUTIVE_MISSES separate healthy
//      runs (not one), so a single bad run -- healthy-looking or not --
//      can never by itself close a real opening.
// ---------------------------------------------------------------------

/**
 * Consecutive HEALTHY runs a job must be absent from before it's presumed
 * closed. 3 (not 1) at the existing ~6-hour scrape cadence -- ~18 hours --
 * matching the approved plan's own conservative threshold. A named,
 * exported constant rather than a number buried in a conditional, so
 * tuning it later is a one-line, fully-tested change.
 */
export const MAX_CONSECUTIVE_MISSES = 3

/**
 * A fetch is only trusted as real evidence of closures when it isn't
 * suspiciously smaller than what's already on file -- guards against a
 * provider returning 200 OK with an empty/truncated body, a pagination
 * bug silently dropping most results, or an entire employer feed being
 * temporarily unavailable while still returning syntactically valid (but
 * empty) JSON. An outright thrown fetch error is already excluded further
 * upstream (scrapeCompanies.ts's try/catch never reaches miss-counting at
 * all when the fetch itself throws) -- this catches the quieter failure
 * mode where the fetch "succeeds" but the data can't be trusted.
 *
 * Deliberately permissive at small scale (fewer than 5 previously-active
 * postings): a genuine 1-job or 2-job employer going to zero is a normal,
 * unremarkable event, and a proportional threshold would be noise at that
 * size. Once there's a meaningful sample, a result retaining under 20% of
 * what was previously on file reads as "the feed broke," not "20 roles
 * all closed in the same 6-hour window."
 */
export function isHealthyFetchResult(previouslyActiveCount: number, seenThisRunCount: number): boolean {
  if (previouslyActiveCount === 0) return true
  if (previouslyActiveCount < 5) return true
  const retainedFraction = seenThisRunCount / previouslyActiveCount
  return retainedFraction >= 0.2
}

/**
 * Pure state transition for one job's consecutive-miss streak. Seeing the
 * job resets the streak to 0 (a job that reappears after a transient miss
 * gets a clean slate, not partial credit) -- confirmed presence is always
 * unambiguous, unlike absence.
 */
export function nextMissCount(currentMissCount: number, seenThisRun: boolean): number {
  return seenThisRun ? 0 : currentMissCount + 1
}

/** True once a job's consecutive-miss streak reaches the documented threshold. */
export function shouldDeactivateForMisses(missCount: number): boolean {
  return missCount >= MAX_CONSECUTIVE_MISSES
}
