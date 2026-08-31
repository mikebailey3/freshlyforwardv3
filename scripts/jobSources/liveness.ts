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
