/**
 * Job sourcing sync — pulls listings from the Adzuna job search API and
 * upserts them into `scraped_jobs`. This replaced an earlier Indeed HTML
 * scraper (see git history / 20260821000000_opportunity_engine.sql for
 * why that was a ToS-risk stopgap): `scraped_jobs` was designed source-
 * agnostic from day one, so swapping the data source only touches this
 * file — nothing downstream (job_matches, freshFitScore.ts, the
 * Opportunity Engine UI) needed to change.
 *
 * Adzuna is a licensed job aggregator with a free developer tier and a
 * straightforward JSON API — no scraping, no ToS gray area.
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

const RESULTS_PER_PAGE = 20

interface ScrapedJobInput {
  external_id: string
  title: string
  company: string
  location: string | null
  description: string
  salary_text: string | null
  employment_type: string | null
  posting_url: string
  posted_at: string | null
}

interface AdzunaResult {
  id: string
  title: string
  redirect_url: string
  description: string
  created: string
  company?: { display_name?: string }
  location?: { display_name?: string }
  salary_min?: number
  salary_max?: number
  contract_time?: string
  contract_type?: string
}

interface AdzunaResponse {
  results: AdzunaResult[]
  count: number
}

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

function formatSalary(min?: number, max?: number): string | null {
  if (!min && !max) return null
  const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`
  if (min && max) return `${fmt(min)} - ${fmt(max)}`
  return fmt((min ?? max) as number)
}

async function fetchSearchPage(
  country: string,
  page: number,
  query: string,
  location: string,
): Promise<AdzunaResponse> {
  const url = new URL(`https://api.adzuna.com/v1/api/jobs/${country}/search/${page}`)
  url.searchParams.set('app_id', ADZUNA_APP_ID as string)
  url.searchParams.set('app_key', ADZUNA_APP_KEY as string)
  url.searchParams.set('results_per_page', String(RESULTS_PER_PAGE))
  url.searchParams.set('what', query)
  if (location) url.searchParams.set('where', location)
  url.searchParams.set('content-type', 'application/json')

  const response = await fetch(url.toString())

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Adzuna responded with ${response.status}: ${body.slice(0, 200)}`)
  }

  return response.json() as Promise<AdzunaResponse>
}

function mapResults(results: AdzunaResult[]): ScrapedJobInput[] {
  return results.map((r) => ({
    external_id: r.id,
    title: r.title,
    company: r.company?.display_name ?? '',
    location: r.location?.display_name ?? null,
    description: r.description,
    salary_text: formatSalary(r.salary_min, r.salary_max),
    employment_type: r.contract_time ?? r.contract_type ?? null,
    posting_url: r.redirect_url,
    posted_at: r.created ? r.created.slice(0, 10) : null,
  }))
}

async function upsertJobs(jobs: ScrapedJobInput[], searchQuery: string): Promise<void> {
  if (jobs.length === 0) return

  const rows = jobs.map((job) => ({
    source: 'adzuna',
    external_id: job.external_id,
    title: job.title,
    company: job.company,
    location: job.location,
    description: job.description,
    salary_text: job.salary_text,
    employment_type: job.employment_type,
    posting_url: job.posting_url,
    posted_at: job.posted_at,
    search_query: searchQuery,
    is_active: true,
    scraped_at: new Date().toISOString(),
  }))

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
      const { results, count } = await fetchSearchPage(country, page, query, location)
      totalFound += results.length
      await upsertJobs(mapResults(results), query)

      if (results.length === 0 || page * RESULTS_PER_PAGE >= count) {
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
