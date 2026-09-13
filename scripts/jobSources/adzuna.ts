import type { ScrapedJobInput } from './types'

/**
 * Adzuna job search API adapter.
 *
 * Mirrors the greenhouse/lever/ashby adapters: a PURE `parseAdzunaJobs()`
 * that can be unit-tested against a fixture with no network or credentials,
 * plus a thin `fetchAdzunaJobs()` that does the I/O. Adzuna was previously
 * the only source with its mapping welded inline in `scripts/scrapeJobs.ts`,
 * which is precisely why it was the only source without tests.
 *
 * Adzuna is a licensed aggregator with a free developer tier and a documented
 * JSON API -- no scraping, no ToS gray area. Credentials:
 * https://developer.adzuna.com/
 */

export interface AdzunaResult {
  id: string
  title: string
  redirect_url: string
  description: string
  created: string
  company?: { display_name?: string }
  location?: { display_name?: string }
  salary_min?: number
  salary_max?: number
  salary_is_predicted?: string | number | boolean
  contract_time?: string
  contract_type?: string
}

export interface AdzunaResponse {
  results: AdzunaResult[]
  count: number
}

/**
 * Adzuna reports `salary_is_predicted: "1"` when the figure is its own
 * ML estimate rather than a number the employer published. We drop those.
 *
 * Rationale: FreshFit's compensation dimension is member-facing and must be
 * evidence-grounded. Presenting an aggregator's guess as a posted salary is
 * exactly the kind of fabrication the charter forbids -- and a wrong salary
 * silently skews scoring. Absent is honest; invented is not.
 */
export function isPredictedSalary(result: Pick<AdzunaResult, 'salary_is_predicted'>): boolean {
  return result.salary_is_predicted === '1' || result.salary_is_predicted === 1 || result.salary_is_predicted === true
}

const ADZUNA_SALARY_FORMATS: Record<string, { locale: string; symbol: string }> = {
  us: { locale: 'en-US', symbol: '$' },
  gb: { locale: 'en-GB', symbol: '£' },
  au: { locale: 'en-AU', symbol: 'A$' },
  ca: { locale: 'en-CA', symbol: 'C$' },
  nz: { locale: 'en-NZ', symbol: 'NZ$' },
  ie: { locale: 'en-IE', symbol: '€' },
  fr: { locale: 'fr-FR', symbol: '€' },
  de: { locale: 'de-DE', symbol: '€' },
  es: { locale: 'es-ES', symbol: '€' },
  it: { locale: 'it-IT', symbol: '€' },
  nl: { locale: 'nl-NL', symbol: '€' },
  be: { locale: 'nl-BE', symbol: '€' },
  ch: { locale: 'de-CH', symbol: 'CHF' },
  pl: { locale: 'pl-PL', symbol: 'zł' },
  ro: { locale: 'ro-RO', symbol: 'lei' },
  ru: { locale: 'ru-RU', symbol: '₽' },
  za: { locale: 'en-ZA', symbol: 'R' },
  in: { locale: 'en-IN', symbol: '₹' },
  at: { locale: 'de-AT', symbol: '€' },
}

/**
 * Adzuna does not expose a currency field in the result shape we document
 * here. We use a tiny country -> currency map for the country codes Adzuna
 * supports instead of hardcoding USD everywhere; if we do not recognize a
 * country, we omit the symbol rather than inventing one.
 */
export function formatSalary(min?: number, max?: number, country = 'us'): string | null {
  if (!min && !max) return null

  const format = ADZUNA_SALARY_FORMATS[country.toLowerCase()] ?? { locale: 'en-US', symbol: '' }
  const fmt = (n: number) => {
    const amount = Math.round(n).toLocaleString(format.locale)
    return format.symbol ? `${format.symbol}${amount}` : amount
  }

  if (min && max) return min === max ? fmt(min) : `${fmt(min)} - ${fmt(max)}`
  return fmt((min ?? max) as number)
}

/**
 * Adzuna sends UNDERSCORED employment values (`full_time`, `part_time`) while
 * the shared `normalizeEmploymentType()` matcher expects the hyphen/space
 * forms every other provider uses (`full-time`, `full time`, `fte`).
 *
 * Left alone, every Adzuna row normalizes to `unknown` and silently degrades
 * FreshFit. We convert underscores to spaces HERE, at the provider boundary,
 * rather than teaching the shared normalizer about one vendor's dialect --
 * adapters own provider quirks; the canonical layer stays canonical.
 *
 * `contract_time` (full/part time) is preferred over `contract_type`
 * (permanent/contract) because it maps onto more of the canonical enum;
 * `contract_type` is the fallback.
 */
export function normalizeAdzunaEmploymentType(result: AdzunaResult): string | null {
  const raw = result.contract_time ?? result.contract_type ?? null
  if (!raw) return null
  return raw.replace(/_/g, ' ').trim() || null
}

const MAX_ADZUNA_TITLE_LENGTH = 300
const MAX_ADZUNA_DESCRIPTION_LENGTH = 20_000

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function trimAndCap(value: string, maxLength: number): string {
  const trimmed = value.trim()
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed
}

function isAdzunaResult(raw: unknown): raw is AdzunaResult {
  if (!raw || typeof raw !== 'object') return false

  const candidate = raw as Partial<AdzunaResult>
  return (
    isNonEmptyString(candidate.id) &&
    isNonEmptyString(candidate.title) &&
    isNonEmptyString(candidate.redirect_url) &&
    isNonEmptyString(candidate.description) &&
    isNonEmptyString(candidate.created)
  )
}

/** Maps a raw Adzuna search response into canonical `ScrapedJobInput` rows. Pure. */
export function parseAdzunaJobs(raw: unknown, searchQuery: string, country = 'us'): ScrapedJobInput[] {
  const results = Array.isArray((raw as { results?: unknown } | null | undefined)?.results)
    ? ((raw as { results: unknown[] }).results)
    : []

  return results.flatMap((result) => {
    if (!isAdzunaResult(result)) return []

    return [{
      source: 'adzuna',
      external_id: result.id.trim(),
      title: trimAndCap(result.title, MAX_ADZUNA_TITLE_LENGTH),
      company: typeof result.company?.display_name === 'string' ? result.company.display_name.trim() : '',
      location: typeof result.location?.display_name === 'string' && result.location.display_name.trim().length > 0
        ? result.location.display_name.trim()
        : null,
      description: trimAndCap(result.description, MAX_ADZUNA_DESCRIPTION_LENGTH),
      salary_text: isPredictedSalary(result)
        ? null
        : formatSalary(result.salary_min, result.salary_max, country),
      employment_type: normalizeAdzunaEmploymentType(result),
      posting_url: result.redirect_url.trim(),
      posted_at: result.created.trim().slice(0, 10),
      search_query: searchQuery,
    }]
  })
}

export const ADZUNA_RESULTS_PER_PAGE = 20
export const ADZUNA_REQUEST_TIMEOUT_MS = 15_000

export interface AdzunaFetchOptions {
  country: string
  page: number
  query: string
  location?: string
  appId: string
  appKey: string
  resultsPerPage?: number
}

/**
 * Fetches one page of Adzuna results.
 *
 * Credentials are passed in rather than read from `process.env` here so this
 * stays a pure-ish function the caller can test and so secrets have exactly
 * one read site (the script entry point).
 */
export async function fetchAdzunaPage(options: AdzunaFetchOptions): Promise<AdzunaResponse> {
  const {
    country,
    page,
    query,
    location,
    appId,
    appKey,
    resultsPerPage = ADZUNA_RESULTS_PER_PAGE,
  } = options

  const url = new URL(`https://api.adzuna.com/v1/api/jobs/${country.toLowerCase()}/search/${page}`)
  url.searchParams.set('app_id', appId)
  url.searchParams.set('app_key', appKey)
  url.searchParams.set('results_per_page', String(resultsPerPage))
  url.searchParams.set('what', query)
  if (location) url.searchParams.set('where', location)
  url.searchParams.set('content-type', 'application/json')

  // Adzuna review (N3-adjacent, Ryan Mitchell): without a bounded timeout, a
  // hung/stalled connection blocks this page -- and every page after it,
  // since scrapeJobs.ts awaits pages sequentially -- for the life of the
  // process. AbortSignal.timeout is the platform-native fetch cancellation;
  // no extra dependency needed.
  const response = await fetch(url.toString(), {
    headers: { 'User-Agent': 'FreshlyForwardOpportunityEngine/1.0' },
    signal: AbortSignal.timeout(ADZUNA_REQUEST_TIMEOUT_MS),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    // Never echo the URL back in the error -- it carries app_id/app_key.
    throw new Error(
      `Adzuna ${country} page ${page} responded with ${response.status}: ${body.slice(0, 200)}`,
    )
  }

  return (await response.json()) as AdzunaResponse
}

/** Convenience wrapper: fetch one page and map it to canonical rows. */
export async function fetchAdzunaJobs(options: AdzunaFetchOptions): Promise<ScrapedJobInput[]> {
  const response = await fetchAdzunaPage(options)
  return parseAdzunaJobs(response, options.query, options.country)
}
