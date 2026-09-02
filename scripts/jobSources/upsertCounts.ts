/**
 * Pure set-difference for upsert reporting: how many of the ids about to
 * be upserted already exist (-> update) versus are brand new (-> insert).
 * Mirrors the shape of scraped_jobs' own UNIQUE(source, external_id)
 * constraint -- callers pass external_ids already scoped to one source.
 */
export function computeUpsertCounts(
  existingIds: string[],
  incomingIds: string[]
): { inserted: number; updated: number } {
  const existing = new Set(existingIds)
  const inserted = incomingIds.filter((id) => !existing.has(id)).length
  return { inserted, updated: incomingIds.length - inserted }
}
