import type { ScrapedJobInput } from './types'

interface GreenhouseJob {
  id: number
  title: string
  updated_at: string
  location?: { name?: string }
  content?: string
  absolute_url: string
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,!?;:])/g, '$1')
    .trim()
}

export function parseGreenhouseJobs(raw: unknown, companySlug: string): ScrapedJobInput[] {
  const payload = raw as { jobs?: GreenhouseJob[] }
  const jobs = payload.jobs ?? []
  return jobs.map((job) => ({
    source: 'greenhouse',
    external_id: String(job.id),
    title: job.title,
    company: companySlug,
    location: job.location?.name ?? null,
    description: stripHtml(job.content ?? ''),
    salary_text: null,
    employment_type: null,
    posting_url: job.absolute_url,
    posted_at: job.updated_at ? job.updated_at.slice(0, 10) : null,
    search_query: companySlug,
  }))
}

/**
 * Public, unauthenticated, documented Greenhouse Job Board API. No ToS
 * conflict -- unlike scrapeIndeed.ts, this is a JSON endpoint Greenhouse
 * publishes specifically for this purpose.
 */
export async function fetchGreenhouseJobs(companySlug: string): Promise<ScrapedJobInput[]> {
  const response = await fetch(
    `https://boards-api.greenhouse.io/v1/boards/${companySlug}/jobs?content=true`,
    { headers: { 'User-Agent': 'FreshlyForwardOpportunityEngine/1.0' } }
  )
  if (!response.ok) {
    throw new Error(`Greenhouse board "${companySlug}" responded with ${response.status}`)
  }
  return parseGreenhouseJobs(await response.json(), companySlug)
}
