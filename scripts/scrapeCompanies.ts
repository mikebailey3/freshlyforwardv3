/**
 * Multi-source ATS scraper — Greenhouse, Lever, Ashby public job-board
 * APIs. Replaces scrapeIndeed.ts as the production job source: these are
 * public, documented, unauthenticated JSON APIs with no ToS conflict
 * (unlike scraping indeed.com's HTML, which scrapeIndeed.ts already
 * documents as high-risk). scrapeIndeed.ts is left in place as a
 * deprecated, non-scheduled fallback — see its own docstring.
 *
 * Fill in real company slugs in scripts/jobSources/companies.json before
 * running this in production (find each slug from the company's own
 * careers page URL, e.g. boards.greenhouse.io/<slug>).
 *
 * Usage:
 *   npm run scrape:companies
 *
 * Requires env vars (service role key needed to write past RLS):
 *   VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from '@supabase/supabase-js'
import companies from './jobSources/companies.json'
import { fetchGreenhouseJobs } from './jobSources/greenhouse'
import { fetchLeverJobs } from './jobSources/lever'
import { fetchAshbyJobs } from './jobSources/ashby'
import { isStaleByAge, isHealthyFetchResult, nextMissCount, shouldDeactivateForMisses, MAX_CONSECUTIVE_MISSES } from './jobSources/liveness'
import { computeUpsertCounts } from './jobSources/upsertCounts'
import { summarizeRun, type AttemptResult } from './lib/runSummary'
import { getErrorDetail } from './lib/errorDetail'
import { groupDuplicateCandidates } from '../src/lib/opportunityEngine/jobDeduplication'
import type { ScrapedJobInput } from './jobSources/types'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment.')
  process.exit(1)
}

export const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

export const PROVIDERS: Record<string, (slug: string) => Promise<ScrapedJobInput[]>> = {
  greenhouse: fetchGreenhouseJobs,
  lever: fetchLeverJobs,
  ashby: fetchAshbyJobs,
}

// Throws on failure (rather than logging and swallowing) so the per-company
// loop in main() can correctly record this company as failed instead of
// silently treating an unpersisted batch as a success.
async function upsertJobs(jobs: ScrapedJobInput[]): Promise<{ inserted: number; updated: number }> {
  if (jobs.length === 0) return { inserted: 0, updated: 0 }

  const source = jobs[0].source
  const externalIds = jobs.map((job) => job.external_id)
  const { data: existing, error: selectError } = await supabase
    .from('scraped_jobs')
    .select('external_id')
    .eq('source', source)
    .in('external_id', externalIds)
  if (selectError) throw selectError

  const counts = computeUpsertCounts((existing ?? []).map((row) => row.external_id as string), externalIds)

  const rows = jobs.map((job) => ({ ...job, is_active: true, scraped_at: new Date().toISOString() }))
  const { error } = await supabase.from('scraped_jobs').upsert(rows, { onConflict: 'source,external_id' })
  if (error) throw error

  return counts
}

/**
 * OE 2.0 Phase 8 -- conservative stale/closed-role detection.
 *
 * Deliberately does NOT deactivate a job the first time it's missing
 * from a fetch (see liveness.ts's module docs for why the old
 * immediate-deactivation behavior was too trigger-happy). Two
 * independent guards, both from scripts/jobSources/liveness.ts (no
 * parallel logic invented here):
 *   1. `isHealthyFetchResult` -- if this run's fetch came back
 *      suspiciously smaller than what's on file, treat the WHOLE run as
 *      an untrustworthy/likely-outage observation and skip every job in
 *      this company entirely (no miss counted, nothing deactivated).
 *   2. `nextMissCount`/`shouldDeactivateForMisses` -- otherwise, each
 *      individually-missing job's consecutive-miss streak increments by
 *      one; only once a single job's OWN streak reaches
 *      `MAX_CONSECUTIVE_MISSES` does it flip to `is_active = false`.
 *
 * Requires the Phase 8 migration
 * (20260913000000_scraped_jobs_stale_detection.sql) to be applied --
 * until then, the SELECT below fails against the current schema, is
 * caught, logged, and this function safely no-ops (see that migration's
 * own docs). Nothing else in this script depends on these columns, so
 * scraping/upserting/scoring are unaffected either way.
 */
async function deactivateGoneJobs(source: string, companySlug: string, seenIds: string[]): Promise<void> {
  const { data, error } = await supabase
    .from('scraped_jobs')
    .select('external_id, missed_run_count')
    .eq('source', source)
    .eq('search_query', companySlug)
    .eq('is_active', true)

  if (error) {
    console.error(`Error reading existing ${source}/${companySlug} jobs for stale detection:`, error)
    return
  }

  const existingRows = (data ?? []) as Array<{ external_id: string; missed_run_count: number }>
  if (existingRows.length === 0) return

  if (!isHealthyFetchResult(existingRows.length, seenIds.length)) {
    console.warn(
      `${source}/${companySlug}: fetch returned ${seenIds.length}/${existingRows.length} previously-active job(s) -- ` +
        'treating as a suspected feed outage, not real closures. Skipping stale detection this run.'
    )
    return
  }

  const seen = new Set(seenIds)
  const nowIso = new Date().toISOString()
  const seenExternalIds: string[] = []
  const stillMissing: Array<{ externalId: string; missCount: number }> = []
  const nowClosed: string[] = []

  for (const row of existingRows) {
    const wasSeen = seen.has(row.external_id)
    if (wasSeen) {
      seenExternalIds.push(row.external_id)
      continue
    }
    const missCount = nextMissCount(row.missed_run_count, false)
    if (shouldDeactivateForMisses(missCount)) {
      nowClosed.push(row.external_id)
    } else {
      stillMissing.push({ externalId: row.external_id, missCount })
    }
  }

  if (seenExternalIds.length > 0) {
    const { error: seenError } = await supabase
      .from('scraped_jobs')
      .update({ last_seen_at: nowIso, missed_run_count: 0 })
      .eq('source', source)
      .in('external_id', seenExternalIds)
    if (seenError) console.error(`Error updating last_seen_at for ${source}/${companySlug}:`, seenError)
  }

  // Grouped by resulting count (usually just one or two distinct values
  // per run) so this doesn't turn into one round-trip per missing job.
  const idsByMissCount = new Map<number, string[]>()
  for (const { externalId, missCount } of stillMissing) {
    idsByMissCount.set(missCount, [...(idsByMissCount.get(missCount) ?? []), externalId])
  }
  for (const [missCount, ids] of idsByMissCount.entries()) {
    const { error: missError } = await supabase
      .from('scraped_jobs')
      .update({ missed_run_count: missCount })
      .eq('source', source)
      .in('external_id', ids)
    if (missError) console.error(`Error updating missed_run_count for ${source}/${companySlug}:`, missError)
  }

  if (nowClosed.length > 0) {
    const { error: closeError } = await supabase
      .from('scraped_jobs')
      .update({ is_active: false, missed_run_count: MAX_CONSECUTIVE_MISSES })
      .eq('source', source)
      .in('external_id', nowClosed)
    if (closeError) console.error(`Error deactivating gone ${source}/${companySlug} jobs:`, closeError)
    else
      console.log(
        `Deactivated ${nowClosed.length} ${source}/${companySlug} job(s) missing for ${MAX_CONSECUTIVE_MISSES} consecutive healthy runs.`
      )
  }
}

async function deactivateStaleJobs(maxAgeDays: number): Promise<void> {
  // Deliberately global (no source filter): covers legacy scrapeIndeed.ts
  // rows and, once Task Group 4 ships, member-submitted jobs too -- any
  // scraped_jobs row not re-confirmed in maxAgeDays goes inactive.
  const { data, error } = await supabase.from('scraped_jobs').select('id, scraped_at').eq('is_active', true)

  if (error) {
    console.error('Error reading scraped_jobs for staleness sweep:', error)
    return
  }

  const staleIds = (data ?? [])
    .filter((row) => isStaleByAge(row.scraped_at as string, maxAgeDays))
    .map((row) => row.id as string)

  if (staleIds.length === 0) return

  const { error: updateError } = await supabase.from('scraped_jobs').update({ is_active: false }).in('id', staleIds)
  if (updateError) console.error('Error deactivating stale jobs:', updateError)
  else console.log(`Deactivated ${staleIds.length} stale job(s) not re-confirmed in ${maxAgeDays} days.`)
}

/**
 * OE 2.0 Phase 1 -- dry-run duplicate detection ONLY. Reports (via
 * console log) the same real posting appearing more than once across
 * sources/re-scrapes, using the exact-match `groupDuplicateCandidates`
 * from jobDeduplication.ts. Deliberately does NOT write anything --
 * `scraped_jobs` has no `canonical_job_id`/`normalized_key` column in
 * production yet (see supabase/migrations/20260911000000_scraped_jobs_dedup.sql,
 * prepared for review, not applied). Once that migration is applied,
 * this becomes a real write (set canonical_job_id on the non-canonical
 * rows) instead of a log line -- until then, this is safe to run
 * against the current, unmigrated production schema because it only
 * ever reads existing columns.
 */
async function reportLikelyDuplicates(): Promise<void> {
  const { data, error } = await supabase
    .from('scraped_jobs')
    .select('id, source, title, company, location, posted_at')
    .eq('is_active', true)

  if (error) {
    console.error('Error reading scraped_jobs for duplicate detection:', error)
    return
  }

  const candidates = (data ?? []).map((row) => ({
    id: row.id as string,
    source: row.source as string,
    title: row.title as string,
    company: row.company as string,
    location: row.location as string | null,
    postedAt: row.posted_at as string | null,
  }))

  const groups = groupDuplicateCandidates(candidates)
  if (groups.length === 0) {
    console.log('Duplicate detection (dry-run): no likely duplicates found across active jobs.')
    return
  }

  const duplicateCount = groups.reduce((sum, g) => sum + g.duplicateIds.length, 0)
  console.log(
    `Duplicate detection (dry-run): ${groups.length} likely-duplicate group(s), ${duplicateCount} duplicate row(s) total. ` +
      'No rows were modified -- apply the prepared dedup migration to persist canonical_job_id.'
  )
}

async function main() {
  const results: AttemptResult[] = []
  let totalDiscovered = 0
  let totalInserted = 0
  let totalUpdated = 0

  for (const [providerName, slugs] of Object.entries(companies as Record<string, string[]>)) {
    const fetchJobs = PROVIDERS[providerName]
    if (!fetchJobs) {
      console.warn(`Unknown provider "${providerName}" in companies.json, skipping.`)
      continue
    }

    for (const slug of slugs) {
      const label = `${providerName}/${slug}`
      try {
        console.log(`Fetching ${label}...`)
        const jobs = await fetchJobs(slug)
        const { inserted, updated } = await upsertJobs(jobs)
        await deactivateGoneJobs(providerName, slug, jobs.map((j) => j.external_id))

        totalDiscovered += jobs.length
        totalInserted += inserted
        totalUpdated += updated
        // A successful fetch that legitimately found zero open jobs right
        // now is still a success -- it is not the same thing as a failure
        // to reach/parse the board, which is caught below instead.
        console.log(`${label}: found ${jobs.length} job(s), ${inserted} new, ${updated} already known.`)
        results.push({ label, status: 'success' })
      } catch (err) {
        const detail = getErrorDetail(err)
        console.error(`Failed on ${label}: ${detail}`)
        results.push({ label, status: 'failure', detail })
      }
    }
  }

  await deactivateStaleJobs(45)
  await reportLikelyDuplicates()

  const summary = summarizeRun(results)
  console.log('')
  console.log('=== Job Discovery: Scrape Summary ===')
  console.log(`Companies attempted: ${summary.total} (succeeded: ${summary.succeeded}, failed: ${summary.failed})`)
  console.log(`Jobs discovered this run: ${totalDiscovered} (${totalInserted} new, ${totalUpdated} already known)`)
  console.log(`Status: ${summary.status.toUpperCase()}`)
  console.log('======================================')

  // A company/provider having zero open jobs right now is not a failure --
  // only a genuine fetch/parse error counts against it (see the catch
  // block above). This only fires when NOTHING could be processed at all:
  // either every configured company failed, or companies.json is empty --
  // both mean the pipeline did not actually do its job this run.
  if (summary.status === 'failed') {
    console.error('Every configured company/provider failed -- nothing could be scraped this run.')
    process.exit(1)
  }
  if (summary.status === 'empty') {
    console.error('No companies are configured in companies.json -- nothing was scraped. Failing so this misconfiguration is visible.')
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('Fatal error running company scrape:', err)
  process.exit(1)
})
