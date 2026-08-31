import type { ScrapedJobInput } from './types'

interface LeverPosting {
  id: string
  text: string
  categories?: { location?: string; commitment?: string }
  descriptionPlain?: string
  hostedUrl: string
  createdAt: number
}

export function parseLeverJobs(raw: unknown, companySlug: string): ScrapedJobInput[] {
  const postings = (raw as LeverPosting[]) ?? []
  return postings.map((posting) => ({
    source: 'lever',
    external_id: posting.id,
    title: posting.text,
    company: companySlug,
    location: posting.categories?.location ?? null,
    description: posting.descriptionPlain ?? '',
    salary_text: null,
    employment_type: posting.categories?.commitment ?? null,
    posting_url: posting.hostedUrl,
    posted_at: posting.createdAt ? new Date(posting.createdAt).toISOString().slice(0, 10) : null,
    search_query: companySlug,
  }))
}

/** Public, unauthenticated, documented Lever Postings API (`?mode=json`). */
export async function fetchLeverJobs(companySlug: string): Promise<ScrapedJobInput[]> {
  const response = await fetch(`https://api.lever.co/v0/postings/${companySlug}?mode=json`, {
    headers: { 'User-Agent': 'FreshlyForwardOpportunityEngine/1.0' },
  })
  if (!response.ok) {
    throw new Error(`Lever board "${companySlug}" responded with ${response.status}`)
  }
  return parseLeverJobs(await response.json(), companySlug)
}
