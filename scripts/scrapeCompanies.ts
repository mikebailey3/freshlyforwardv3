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
import { selectJobsToDeactivate, isStaleByAge } from './jobSources/liveness'
import { computeUpsertCounts } from './jobSources/upsertCounts'
import { summarizeRun, type AttemptResult } from './lib/runSummary'
import { getErrorDetail } from './lib/errorDetail'
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

async function deactivateGoneJobs(source: string, companySlug: string, seenIds: string[]): Promise<void> {
  const { data, error } = await supabase
    .from('scraped_jobs')
    .select('external_id')
    .eq('source', source)
    .eq('search_query', companySlug)
    .eq('is_active', true)

  if (error) {
    console.error(`Error reading existing ${source}/${companySlug} jobs:`, error)
    return
  }

  const existingIds = (data ?? []).map((row) => row.external_id as string)
  const toDeactivate = selectJobsToDeactivate(existingIds, seenIds)
  if (toDeactivate.length === 0) return

  const { error: updateError } = await supabase
    .from('scraped_jobs')
    .update({ is_active: false })
    .eq('source', source)
    .in('external_id', toDeactivate)

  if (updateError) console.error(`Error deactivating gone ${source}/${companySlug} jobs:`, updateError)
  else console.log(`Deactivated ${toDeactivate.length} ${source}/${companySlug} job(s) no longer listed.`)
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
