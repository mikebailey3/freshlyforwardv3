import type { ScrapedJobInput } from './types'

interface AshbyJob {
  id: string
  title: string
  location?: string
  descriptionPlain?: string
  jobUrl: string
  publishedAt: string
  employmentType?: string
}

export function parseAshbyJobs(raw: unknown, companySlug: string): ScrapedJobInput[] {
  const payload = raw as { jobs?: AshbyJob[] }
  const jobs = payload.jobs ?? []
  return jobs.map((job) => ({
    source: 'ashby',
    external_id: job.id,
    title: job.title,
    company: companySlug,
    location: job.location ?? null,
    description: job.descriptionPlain ?? '',
    salary_text: null,
    employment_type: job.employmentType ?? null,
    posting_url: job.jobUrl,
    posted_at: job.publishedAt ? job.publishedAt.slice(0, 10) : null,
    search_query: companySlug,
  }))
}

/** Public, unauthenticated, documented Ashby Job Board API. */
export async function fetchAshbyJobs(companySlug: string): Promise<ScrapedJobInput[]> {
  const response = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${companySlug}`, {
    headers: { 'User-Agent': 'FreshlyForwardOpportunityEngine/1.0' },
  })
  if (!response.ok) {
    throw new Error(`Ashby board "${companySlug}" responded with ${response.status}`)
  }
  return parseAshbyJobs(await response.json(), companySlug)
}
