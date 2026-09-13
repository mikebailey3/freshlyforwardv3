
/**
 * Job sourcing sync -- pulls listings from the Adzuna job search API and
 * upserts them into `scraped_jobs`. This replaced an earlier Indeed HTML
 * scraper (see git history / 20260821000000_opportunity_engine.sql for
 * why that was a ToS-risk stopgap): `scraped_jobs` was designed source-
 * agnostic from day one, so swapping the data source only touches this
 * file -- nothing downstream (job_matches, freshFitScore.ts, the
 * Opportunity Engine UI) needed to change.
 *
 * The provider mapping lives in `scripts/jobSources/adzuna.ts`, matching
 * the greenhouse/lever/ashby adapters, so it can be unit-tested against a
 * fixture with no network and no credentials. This file owns only I/O:
 * argument parsing, secret loading, pagination, and the upsert.
 *
 * Adzuna is a licensed job aggregator with a free developer tier and a
 * straightforward JSON API -- no scraping, no ToS gray area.
 * Sign up for app_id/app_key at https://developer.adzuna.com/
 *
 * Usage:
 *   npm run scrape:jobs -- --query "customer service" --location "Dallas, TX" --pages 2
 *   npm run scrape:jobs -- --query "data analyst" --country gb --pages 1
 *
 * Requires env vars (service role key needed to write past RLS):
 *   VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   ADZUNA_APP_ID
 *   ADZUNA_APP_KEY
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { pathToFileURL } from 'node:url'

import { fetchAdzunaPage, parseAdzunaJobs } from './jobSources/adzuna'
import type { ScrapedJobInput } from './jobSources/types'
import { summarizeRun, type AttemptResult } from './lib/runSummary'
import { getErrorDetail } from './lib/errorDetail'

export interface ParsedArgs {
  query: string
  location: string
  pages: number
  country: string
}

function readFlagValue(args: string[], flag: string, fallback: string): string {
  const idx = args.indexOf(flag)
  if (idx === -1) return fallback

  const value = args[idx + 1]
  if (!value || value.startsWith('--')) {
    throw new Error(`Invalid ${flag} value: expected a value after ${flag}.`)
  }

  return value
}

const MAX_ADZUNA_PAGES = 50

export function parseArgs(args = process.argv.slice(2)): ParsedArgs {
  const query = readFlagValue(args, '--query', 'customer service')
  const location = readFlagValue(args, '--location', '')
  const country = readFlagValue(args, '--country', 'us')
  const pagesRaw = readFlagValue(args, '--pages', '1')

  if (!/^[1-9]\d*$/.test(pagesRaw)) {
    throw new Error(`Invalid --pages value "${pagesRaw}". Expected a positive integer.`)
  }

  const pages = Number(pagesRaw)
  if (pages > MAX_ADZUNA_PAGES) {
    throw new Error(`Invalid --pages value "${pagesRaw}". Expected a positive integer no greater than ${MAX_ADZUNA_PAGES}.`)
  }

  return {
    query,
    location,
    pages,
    country,
  }
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing ${name} in the environment.`)
  }
  return value
}

function createSupabaseClient(): SupabaseClient {
  return createClient(
    requireEnv('VITE_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  )
}

function requireAdzunaCredentials(): { appId: string; appKey: string } {
  return {
    appId: requireEnv('ADZUNA_APP_ID'),
    appKey: requireEnv('ADZUNA_APP_KEY'),
  }
}

// Deliberately does NOT run its own consecutive-miss/closed-role detection
// (unlike scrapeCompanies.ts's deactivateGoneJobs) -- Adzuna is a ranked
// search API, not a fixed company-board dump, so "missing from this run's
// paginated results" is a much weaker signal than "missing from a full
// board fetch" and would risk false-deactivating still-open roles that
// simply ranked off-page this run. Adzuna rows are NOT exempt from
// staleness overall, though: scrapeCompanies.ts's deactivateStaleJobs(45)
// sweep is deliberately global (no source filter), and scrapeCompanies.ts
// IS scheduled (every 6 hours -- see docs/job-discovery-pipeline.md), so it
// still ages out Adzuna rows even though this script itself is NOT in that
// schedule (Adzuna stays manual-invocation-only pending the licensing-tier
// decision -- see the same doc). Practical consequence: Adzuna rows are
// only *re-confirmed* (scraped_at bumped) when a human runs this script by
// hand; coverage decays toward inactive without manual runs, which is the
// fail-safe direction.
async function upsertJobs(client: SupabaseClient, jobs: ScrapedJobInput[]): Promise<void> {
  if (jobs.length === 0) return

  const scrapedAt = new Date().toISOString()
  const rows = jobs.map((job) => ({ ...job, is_active: true, scraped_at: scrapedAt }))

  const { error } = await client
    .from('scraped_jobs')
    .upsert(rows, { onConflict: 'source,external_id' })

  if (error) throw error

  console.log(`Upserted ${rows.length} job(s).`)
}

export async function main() {
  const supabase = createSupabaseClient()
  const { appId, appKey } = requireAdzunaCredentials()
  const { query, location, pages, country } = parseArgs()

  console.log(`Fetching Adzuna (${country}) jobs for "${query}" in "${location || 'anywhere'}" (${pages} page(s))...`)

  const results: AttemptResult[] = []
  let totalFound = 0

  for (let page = 1; page <= pages; page++) {
    const label = `page ${page}`
    try {
      const response = await fetchAdzunaPage({
        country,
        page,
        query,
        location,
        appId,
        appKey,
      })

      const jobs = parseAdzunaJobs(response, query, country)
      await upsertJobs(supabase, jobs)
      totalFound += jobs.length
      results.push({ label, status: 'success' })

      const responseCount = typeof response.count === 'number' ? response.count : null
      if (jobs.length === 0 || (responseCount !== null && totalFound >= responseCount)) {
        console.log('No more results available, stopping early.')
        break
      }
    } catch (err) {
      const detail = getErrorDetail(err)
      console.error(`Failed on ${label}: ${detail}`)
      results.push({ label, status: 'failure', detail })
    }
  }

  const summary = summarizeRun(results)
  console.log('')
  console.log('=== Job Discovery: Scrape Summary ===')
  console.log(`Pages attempted: ${summary.total} (succeeded: ${summary.succeeded}, failed: ${summary.failed})`)
  console.log(`Jobs discovered this run: ${totalFound}`)
  console.log(`Status: ${summary.status.toUpperCase()}`)
  console.log('======================================')

  if (summary.failed > 0) {
    console.error('One or more Adzuna pages failed -- failing the run so the outage is visible.')
    process.exit(1)
  }
  if (summary.status === 'empty') {
    console.error('No Adzuna pages completed successfully -- failing the run so the outage is visible.')
    process.exit(1)
  }
}

const isMainModule = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false

if (isMainModule) {
  main().catch((err) => {
    console.error('Fatal error running job sync:', getErrorDetail(err))
    process.exit(1)
  })
}
