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
import { createClient } from '@supabase/supabase-js'

import {
  ADZUNA_RESULTS_PER_PAGE,
  fetchAdzunaPage,
  parseAdzunaJobs,
} from './jobSources/adzuna'
import type { ScrapedJobInput } from './jobSources/types'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ADZUNA_APP_ID = process.env.ADZUNA_APP_ID
const ADZUNA_APP_KEY = process.env.ADZUNA_APP_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment.')
  process.exit(1)
}

if (!ADZUNA_APP_ID || !ADZUNA_APP_KEY) {
  console.error('Missing ADZUNA_APP_ID or ADZUNA_APP_KEY in the environment. Get a free key at https://developer.adzuna.com/')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

function parseArgs() {
  const args = process.argv.slice(2)
  const get = (flag: string, fallback: string) => {
    const idx = args.indexOf(flag)
    return idx >= 0 && args[idx + 1] ? args[idx + 1] : fallback
  }
  return {
    query: get('--query', 'customer service'),
    location: get('--location', ''),
    pages: parseInt(get('--pages', '1'), 10),
    country: get('--country', 'us'),
  }
}

async function upsertJobs(jobs: ScrapedJobInput[]): Promise<void> {
  if (jobs.length === 0) return

  const scrapedAt = new Date().toISOString()
  const rows = jobs.map((job) => ({ ...job, is_active: true, scraped_at: scrapedAt }))

  const { error } = await supabase
    .from('scraped_jobs')
    .upsert(rows, { onConflict: 'source,external_id' })

  if (error) {
    console.error('Error upserting scraped jobs:', error)
  } else {
    console.log(`Upserted ${rows.length} job(s).`)
  }
}

async function main() {
  const { query, location, pages, country } = parseArgs()
  console.log(`Fetching Adzuna (${country}) jobs for "${query}" in "${location || 'anywhere'}" (${pages} page(s))...`)

  let totalFound = 0

  for (let page = 1; page <= pages; page++) {
    try {
      const response = await fetchAdzunaPage({
        country,
        page,
        query,
        location,
        appId: ADZUNA_APP_ID as string,
        appKey: ADZUNA_APP_KEY as string,
      })

      const jobs = parseAdzunaJobs(response, query)
      totalFound += jobs.length
      await upsertJobs(jobs)

      if (jobs.length === 0 || page * ADZUNA_RESULTS_PER_PAGE >= response.count) {
        console.log('No more results available, stopping early.')
        break
      }
    } catch (err) {
      console.error(`Failed on page ${page}:`, err)
      break
    }
  }

  console.log(`Done. Found ${totalFound} job(s) across requested pages.`)
}

main().catch((err) => {
  console.error('Fatal error running job sync:', err)
  process.exit(1)
})
