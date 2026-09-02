import type { ScrapedJobInput } from './types'

interface WorkdayJobPosting {
  title: string
  externalPath: string
  locationsText?: string
  bulletFields?: string[]
}

interface WorkdaySearchResponse {
  total?: number
  jobPostings?: WorkdayJobPosting[]
}

interface WorkdaySlug {
  tenant: string
  wdHost: string
  site: string
}

/**
 * Workday slugs pack three IDs into one string ("tenant:wdHost:site")
 * because, unlike Greenhouse/Lever/Ashby, a Workday board's hostname isn't
 * derivable from the company name alone -- e.g. Walmart's board lives at
 * walmart.wd504.myworkdayjobs.com/WalmartExternal. Read these three values
 * off the company's own careers URL: https://<tenant>.<wdHost>.myworkdayjobs.com/<site>
 */
export function parseWorkdaySlug(slug: string): WorkdaySlug {
  const [tenant, wdHost, site] = slug.split(':')
  if (!tenant || !wdHost || !site) {
    throw new Error(
      `Invalid Workday slug "${slug}" -- expected "tenant:wdHost:site", e.g. "walmart:wd504:WalmartExternal".`
    )
  }
  return { tenant, wdHost, site }
}

function extractRequisitionId(posting: WorkdayJobPosting): string {
  const fromBullets = (posting.bulletFields ?? []).find((f) => /^[A-Z]*-?\d+$/i.test(f.trim()))
  if (fromBullets) return fromBullets.trim()
  const segments = posting.externalPath.split('_')
  return segments[segments.length - 1] || posting.externalPath
}

export function parseWorkdayJobs(raw: unknown, slug: string): ScrapedJobInput[] {
  const { tenant, wdHost, site } = parseWorkdaySlug(slug)
  const payload = raw as WorkdaySearchResponse
  const postings = payload.jobPostings ?? []
  const baseUrl = `https://${tenant}.${wdHost}.myworkdayjobs.com/${site}`
  return postings.map((posting) => ({
    source: 'workday',
    external_id: extractRequisitionId(posting),
    title: posting.title,
    company: tenant,
    location: posting.locationsText ?? null,
    // Workday's list/search endpoint doesn't return job descriptions --
    // only a per-job detail call does, and firing one detail request per
    // posting isn't viable for an employer with thousands of open reqs.
    // Left blank rather than guessed at.
    description: '',
    salary_text: null,
    employment_type: null,
    posting_url: `${baseUrl}${posting.externalPath}`,
    // postedOn is relative text ("Posted 3 Days Ago", "Posted 30+ Days
    // Ago"), not resolvable to a real date -- left null rather than guessed.
    posted_at: null,
    search_query: slug,
  }))
}

const PAGE_SIZE = 20
const MAX_PAGES = 25 // caps a single run at 500 postings per company

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Public Workday CXS job-search endpoint. Undocumented by Workday itself
 * but stable and widely relied on -- it's what every myworkdayjobs.com
 * careers site's own search box calls under the hood. No auth required.
 *
 * NOTE: this has not been exercised against a live Workday tenant (this
 * fetcher was written in a sandbox with no network access to
 * myworkdayjobs.com) -- verify the request/response shape against the
 * real endpoint before relying on it in production.
 */
export async function fetchWorkdayJobs(slug: string): Promise<ScrapedJobInput[]> {
  const { tenant, wdHost, site } = parseWorkdaySlug(slug)
  const endpoint = `https://${tenant}.${wdHost}.myworkdayjobs.com/wday/cxs/${tenant}/${site}/jobs`

  const results: ScrapedJobInput[] = []
  for (let page = 0; page < MAX_PAGES; page++) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'FreshlyForwardOpportunityEngine/1.0',
      },
      body: JSON.stringify({ appliedFacets: {}, limit: PAGE_SIZE, offset: page * PAGE_SIZE, searchText: '' }),
    })
    if (!response.ok) {
      throw new Error(`Workday board "${slug}" responded with ${response.status}`)
    }
    const json = (await response.json()) as WorkdaySearchResponse
    const pageJobs = parseWorkdayJobs(json, slug)
    results.push(...pageJobs)

    const total = json.total ?? 0
    if (pageJobs.length === 0 || results.length >= total) break
    await sleep(300)
  }
  return results
}
