/**
 * OE 2.0 Phase 10 -- scheduling abstraction. Deliberately decoupled from
 * any actual cron/GitHub Actions configuration (unlike
 * `.github/workflows/job-discovery-pipeline.yml`'s fixed cron line) --
 * this is a pure "is this member due for a digest right now" check that
 * `scripts/sendDigests.ts` calls per member, independent of how often
 * the surrounding script itself happens to run. A real scheduled
 * workflow can safely run this script hourly, daily, or on any cadence;
 * this function is what actually enforces "at most once per
 * `frequencyDays`" per member, not the cron expression.
 */

export const DEFAULT_WEEKLY_DIGEST_FREQUENCY_DAYS = 7

/**
 * `lastSentAt === null` (never sent one before) is always due -- a
 * brand-new eligible member should get their first digest the first
 * time the pipeline runs, not wait a full cycle for no reason.
 */
export function isDigestDue(lastSentAt: string | null, now: Date, frequencyDays: number): boolean {
  if (lastSentAt === null) return true

  const lastSentMs = Date.parse(lastSentAt)
  if (Number.isNaN(lastSentMs)) return true // malformed timestamp -- never block a member from ever getting a digest again over bad data

  const elapsedMs = now.getTime() - lastSentMs
  const frequencyMs = frequencyDays * 24 * 60 * 60 * 1000
  return elapsedMs >= frequencyMs
}
