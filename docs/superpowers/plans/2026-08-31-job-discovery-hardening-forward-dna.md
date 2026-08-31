# Job Discovery Hardening + Forward DNA Matching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the ToS-risky Indeed scraper with legal ATS-API sources, add a job-liveness sweep, wire the unused Forward DNA tables into FreshFit scoring, and give members a way to submit their own job leads into the existing Opportunity Engine pipeline.

**Architecture:** Entirely additive to the existing Opportunity Engine (`scraped_jobs` / `job_matches` / `computeFreshFitScore` / `promoteMatchToOpportunity`). No new services, no new hosting, no LLM calls. New job sources write into the same `scraped_jobs` table via the `source` column; new Forward DNA scoring factors are additive bonus points capped at the existing 0-100 range; member-submitted jobs reuse the same scoring pipeline through two narrowly-scoped new RLS policies.

**Tech Stack:** TypeScript, Node (`tsx` scripts), React + Vite, Supabase (Postgres + RLS), Vitest + @testing-library/react.

**Spec:** `docs/audit/2026-job-search-oss-audit.md` (Sections E, F, I, J, K)

## Global Constraints

- No new runtime dependencies — Greenhouse, Lever, and Ashby all expose plain public JSON APIs reachable with the built-in `fetch`.
- No LLM calls, no paid APIs anywhere in this plan — must stay $0 marginal cost per the audit's Section G.
- No code copied from `swiss-job-hunter` (AGPL-3.0) or any repo with an unconfirmed license — ideas only, always reimplemented from scratch, per the audit's Section H.
- Supabase-calling functions must accept an injectable `client: SupabaseClient = defaultClient` parameter so they stay unit-testable, matching the existing pattern in `src/lib/forwardDna/scope.ts` and `src/lib/forwardDna/skills.ts`.
- Tests are colocated as `<name>.test.ts` / `<name>.test.tsx` next to the file they test, using `describe`/`it`/`expect` from Vitest — the existing convention throughout `src/`.
- `computeFreshFitScore`'s existing return shape and the four original `JobMatchScoreBreakdown` keys must stay backward compatible — old stored `job_matches.score_breakdown` rows won't have the new keys.
- Migrations follow the existing `YYYYMMDDHHMMSS_description.sql` naming convention and are additive only (no `ALTER`/`DROP` of existing tables, columns, or policies), matching `20260831000000_forward_dna.sql`.
- Files stay under 600 lines; split further if a task would push one over that.

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `scripts/jobSources/types.ts` | Create | Shared `ScrapedJobInput` type for all ATS providers |
| `scripts/jobSources/greenhouse.ts` | Create | Fetch + parse the public Greenhouse Job Board API |
| `scripts/jobSources/lever.ts` | Create | Fetch + parse the public Lever Postings API |
| `scripts/jobSources/ashby.ts` | Create | Fetch + parse the public Ashby Job Board API |
| `scripts/jobSources/liveness.ts` | Create | Pure staleness/deactivation helpers |
| `scripts/jobSources/companies.json` | Create | Config: which companies to scan per provider |
| `scripts/scrapeCompanies.ts` | Create | Orchestrator: runs all providers, upserts, deactivates gone/stale jobs |
| `package.json` | Modify | Add `scrape:companies` npm script |
| `src/types/index.ts` | Modify | Add `dnaSkillEvidence`/`scopeFit` to `JobMatchScoreBreakdown` |
| `src/lib/forwardDna/matching.ts` | Create | Pure `scoreSkillEvidence` / `scoreScopeFit` functions |
| `src/lib/freshFitScore.ts` | Modify | Wire the two new factors into `computeFreshFitScore` |
| `src/lib/freshFitScore.test.ts` | Create | Baseline + Forward DNA-aware characterization tests |
| `scripts/syncFreshFitScores.ts` | Modify | Fetch `career_skills`/`career_scope` per member, pass through |
| `src/lib/opportunityEngine.ts` | Modify | Add `buildWhyItMatches` + `submitMemberJob` |
| `src/lib/opportunityEngine.test.ts` | Create | Tests for the two new functions above |
| `src/lib/jobSubmission.ts` | Create | Pure validation for the member job-submission form |
| `src/lib/jobSubmission.test.ts` | Create | Tests for validation |
| `supabase/migrations/20260901000000_member_submitted_jobs.sql` | Create | RLS INSERT policies for member-submitted rows |
| `src/components/SubmitJobModal.tsx` | Create | Member-facing "Submit a Job" form |
| `src/components/SubmitJobModal.test.tsx` | Create | Tests for the modal |
| `src/pages/OpportunityEnginePage.tsx` | Modify | Wire the new modal into the existing member page |

---

## Task Group 1: ATS Job Sources (replace Indeed as the production source)

### Task 1: Greenhouse provider

**Files:**
- Create: `scripts/jobSources/types.ts`
- Create: `scripts/jobSources/greenhouse.ts`
- Test: `scripts/jobSources/greenhouse.test.ts`

**Interfaces:**
- Produces: `ScrapedJobInput` (shared shape used by every provider in this group), `parseGreenhouseJobs(raw: unknown, companySlug: string): ScrapedJobInput[]`, `fetchGreenhouseJobs(companySlug: string): Promise<ScrapedJobInput[]>`

- [ ] **Step 1: Write the failing test**

```ts
// scripts/jobSources/greenhouse.test.ts
import { describe, it, expect } from 'vitest'
import { parseGreenhouseJobs } from './greenhouse'

const fixture = {
  jobs: [
    {
      id: 4020394,
      title: 'Backend Engineer',
      updated_at: '2024-05-01T12:00:00-04:00',
      location: { name: 'Remote - US' },
      content: '<p>We are looking for a <strong>backend engineer</strong>.</p>',
      absolute_url: 'https://boards.greenhouse.io/acme/jobs/4020394',
    },
  ],
}

describe('parseGreenhouseJobs', () => {
  it('maps a Greenhouse job board response into ScrapedJobInput rows', () => {
    const result = parseGreenhouseJobs(fixture, 'acme')
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      source: 'greenhouse',
      external_id: '4020394',
      title: 'Backend Engineer',
      company: 'acme',
      location: 'Remote - US',
      description: 'We are looking for a backend engineer.',
      salary_text: null,
      employment_type: null,
      posting_url: 'https://boards.greenhouse.io/acme/jobs/4020394',
      posted_at: '2024-05-01',
      search_query: 'acme',
    })
  })

  it('returns an empty array when the board has no jobs', () => {
    expect(parseGreenhouseJobs({ jobs: [] }, 'acme')).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/jobSources/greenhouse.test.ts`
Expected: FAIL — `./greenhouse` does not exist yet.

- [ ] **Step 3: Write the shared type and the minimal implementation**

```ts
// scripts/jobSources/types.ts
export interface ScrapedJobInput {
  source: string
  external_id: string
  title: string
  company: string
  location: string | null
  description: string
  salary_text: string | null
  employment_type: string | null
  posting_url: string
  posted_at: string | null
  search_query: string
}
```

```ts
// scripts/jobSources/greenhouse.ts
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
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
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
 * conflict — unlike scrapeIndeed.ts, this is a JSON endpoint Greenhouse
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/jobSources/greenhouse.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Verify the live API shape**

Run: `curl "https://boards-api.greenhouse.io/v1/boards/stripe/jobs?content=true" | head -c 500`
Confirm the `jobs[]` fields (`id`, `title`, `location.name`, `content`, `absolute_url`, `updated_at`) match what `parseGreenhouseJobs` expects. Adjust the fixture/implementation together if Greenhouse has changed its shape since this plan was written.

- [ ] **Step 6: Commit**

```bash
git add scripts/jobSources/types.ts scripts/jobSources/greenhouse.ts scripts/jobSources/greenhouse.test.ts
git commit -m "feat: add Greenhouse job source provider"
```

### Task 2: Lever provider

**Files:**
- Create: `scripts/jobSources/lever.ts`
- Test: `scripts/jobSources/lever.test.ts`

**Interfaces:**
- Consumes: `ScrapedJobInput` (Task 1)
- Produces: `parseLeverJobs(raw: unknown, companySlug: string): ScrapedJobInput[]`, `fetchLeverJobs(companySlug: string): Promise<ScrapedJobInput[]>`

- [ ] **Step 1: Write the failing test**

```ts
// scripts/jobSources/lever.test.ts
import { describe, it, expect } from 'vitest'
import { parseLeverJobs } from './lever'

const fixture = [
  {
    id: 'a1b2c3',
    text: 'Senior Product Manager',
    categories: { location: 'New York, NY', commitment: 'Full-time' },
    descriptionPlain: 'We are looking for a senior product manager.',
    hostedUrl: 'https://jobs.lever.co/acme/a1b2c3',
    createdAt: 1714521600000,
  },
]

describe('parseLeverJobs', () => {
  it('maps a Lever postings response into ScrapedJobInput rows', () => {
    const result = parseLeverJobs(fixture, 'acme')
    expect(result).toEqual([
      {
        source: 'lever',
        external_id: 'a1b2c3',
        title: 'Senior Product Manager',
        company: 'acme',
        location: 'New York, NY',
        description: 'We are looking for a senior product manager.',
        salary_text: null,
        employment_type: 'Full-time',
        posting_url: 'https://jobs.lever.co/acme/a1b2c3',
        posted_at: '2024-05-01',
        search_query: 'acme',
      },
    ])
  })

  it('returns an empty array for an empty postings list', () => {
    expect(parseLeverJobs([], 'acme')).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/jobSources/lever.test.ts`
Expected: FAIL — `./lever` does not exist yet.

- [ ] **Step 3: Write the minimal implementation**

```ts
// scripts/jobSources/lever.ts
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
    posted_at: new Date(posting.createdAt).toISOString().slice(0, 10),
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/jobSources/lever.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Verify the live API shape**

Run: `curl "https://api.lever.co/v0/postings/netflix?mode=json" | head -c 500`
Confirm field names still match; adjust together with the fixture if Lever has changed shape.

- [ ] **Step 6: Commit**

```bash
git add scripts/jobSources/lever.ts scripts/jobSources/lever.test.ts
git commit -m "feat: add Lever job source provider"
```

### Task 3: Ashby provider

**Files:**
- Create: `scripts/jobSources/ashby.ts`
- Test: `scripts/jobSources/ashby.test.ts`

**Interfaces:**
- Consumes: `ScrapedJobInput` (Task 1)
- Produces: `parseAshbyJobs(raw: unknown, companySlug: string): ScrapedJobInput[]`, `fetchAshbyJobs(companySlug: string): Promise<ScrapedJobInput[]>`

- [ ] **Step 1: Write the failing test**

```ts
// scripts/jobSources/ashby.test.ts
import { describe, it, expect } from 'vitest'
import { parseAshbyJobs } from './ashby'

const fixture = {
  jobs: [
    {
      id: 'xyz-1',
      title: 'Data Analyst',
      location: 'Remote',
      descriptionPlain: 'We are looking for a data analyst.',
      jobUrl: 'https://jobs.ashbyhq.com/acme/xyz-1',
      publishedAt: '2024-05-01T00:00:00.000Z',
      employmentType: 'FullTime',
    },
  ],
}

describe('parseAshbyJobs', () => {
  it('maps an Ashby job board response into ScrapedJobInput rows', () => {
    const result = parseAshbyJobs(fixture, 'acme')
    expect(result).toEqual([
      {
        source: 'ashby',
        external_id: 'xyz-1',
        title: 'Data Analyst',
        company: 'acme',
        location: 'Remote',
        description: 'We are looking for a data analyst.',
        salary_text: null,
        employment_type: 'FullTime',
        posting_url: 'https://jobs.ashbyhq.com/acme/xyz-1',
        posted_at: '2024-05-01',
        search_query: 'acme',
      },
    ])
  })

  it('returns an empty array when the board has no jobs', () => {
    expect(parseAshbyJobs({ jobs: [] }, 'acme')).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/jobSources/ashby.test.ts`
Expected: FAIL — `./ashby` does not exist yet.

- [ ] **Step 3: Write the minimal implementation**

```ts
// scripts/jobSources/ashby.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/jobSources/ashby.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Verify the live API shape**

Run: `curl "https://api.ashbyhq.com/posting-api/job-board/ashby" | head -c 500`
Confirm field names still match; adjust together with the fixture if Ashby has changed shape.

- [ ] **Step 6: Commit**

```bash
git add scripts/jobSources/ashby.ts scripts/jobSources/ashby.test.ts
git commit -m "feat: add Ashby job source provider"
```

### Task 4: companies.json config + scrapeCompanies.ts orchestrator

**Files:**
- Create: `scripts/jobSources/companies.json`
- Create: `scripts/scrapeCompanies.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `fetchGreenhouseJobs`, `fetchLeverJobs`, `fetchAshbyJobs` (Tasks 1-3), `ScrapedJobInput` (Task 1)
- Produces: a runnable `npm run scrape:companies` script; a `PROVIDERS` map later reused by Task 6

This orchestrator is an I/O shell (network + Supabase writes), matching the existing, deliberately untested `scripts/scrapeIndeed.ts` in this repo — there is no unit test for this task, consistent with that established convention. Verification is manual (Step 4 below).

- [ ] **Step 1: Add the companies config**

```json
// scripts/jobSources/companies.json
{
  "greenhouse": ["REPLACE_WITH_REAL_COMPANY_SLUG"],
  "lever": ["REPLACE_WITH_REAL_COMPANY_SLUG"],
  "ashby": ["REPLACE_WITH_REAL_COMPANY_SLUG"]
}
```

This config is intentionally empty of real targets — replace the placeholder slugs with the companies FreshlyForward actually wants to track (find each company's board-token/slug from their own careers page URL, e.g. `boards.greenhouse.io/<slug>`, `jobs.lever.co/<slug>`, `jobs.ashbyhq.com/<slug>`) before running this in production.

- [ ] **Step 2: Write the orchestrator**

```ts
// scripts/scrapeCompanies.ts
/**
 * Multi-source ATS scraper — Greenhouse, Lever, Ashby public job-board
 * APIs. Replaces scrapeIndeed.ts as the production job source: these are
 * public, documented, unauthenticated JSON APIs with no ToS conflict
 * (unlike scraping indeed.com's HTML, which scrapeIndeed.ts already
 * documents as high-risk). scrapeIndeed.ts is left in place as a
 * deprecated, non-scheduled fallback — see its own docstring.
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

async function upsertJobs(jobs: ScrapedJobInput[]): Promise<void> {
  if (jobs.length === 0) return
  const rows = jobs.map((job) => ({ ...job, is_active: true, scraped_at: new Date().toISOString() }))
  const { error } = await supabase.from('scraped_jobs').upsert(rows, { onConflict: 'source,external_id' })
  if (error) console.error('Error upserting scraped jobs:', error)
  else console.log(`Upserted ${rows.length} job(s).`)
}

async function main() {
  for (const [providerName, slugs] of Object.entries(companies as Record<string, string[]>)) {
    const fetchJobs = PROVIDERS[providerName]
    if (!fetchJobs) {
      console.warn(`Unknown provider "${providerName}" in companies.json, skipping.`)
      continue
    }

    for (const slug of slugs) {
      try {
        console.log(`Fetching ${providerName}/${slug}...`)
        const jobs = await fetchJobs(slug)
        await upsertJobs(jobs)
      } catch (err) {
        console.error(`Failed on ${providerName}/${slug}:`, err)
      }
    }
  }
  console.log('Done.')
}

main().catch((err) => {
  console.error('Fatal error running company scrape:', err)
  process.exit(1)
})
```

- [ ] **Step 3: Add the npm script**

```json
// package.json — inside "scripts"
"scrape:companies": "tsx scripts/scrapeCompanies.ts",
```

- [ ] **Step 4: Manually verify against a real board**

After filling in at least one real company slug in `companies.json`:

Run: `npm run scrape:companies`
Expected: console output showing jobs fetched and upserted per provider/slug; confirm new rows appear in the `scraped_jobs` table via the Supabase dashboard, with `source` set to `greenhouse`/`lever`/`ashby` as appropriate.

- [ ] **Step 5: Commit**

```bash
git add scripts/jobSources/companies.json scripts/scrapeCompanies.ts package.json
git commit -m "feat: add multi-source ATS scraper orchestrator (Greenhouse/Lever/Ashby)"
```

---

## Task Group 2: Job Liveness / Expiration Sweep

### Task 5: Pure staleness/deactivation helpers

**Files:**
- Create: `scripts/jobSources/liveness.ts`
- Test: `scripts/jobSources/liveness.test.ts`

**Interfaces:**
- Produces: `selectJobsToDeactivate(existingActiveIds: string[], seenIdsThisRun: string[]): string[]`, `isStaleByAge(scrapedAt: string, maxAgeDays: number, now?: Date): boolean`

- [ ] **Step 1: Write the failing test**

```ts
// scripts/jobSources/liveness.test.ts
import { describe, it, expect } from 'vitest'
import { selectJobsToDeactivate, isStaleByAge } from './liveness'

describe('selectJobsToDeactivate', () => {
  it('returns ids that are active but no longer seen', () => {
    expect(selectJobsToDeactivate(['a', 'b', 'c'], ['a', 'c'])).toEqual(['b'])
  })

  it('returns an empty array when everything is still seen', () => {
    expect(selectJobsToDeactivate(['a', 'b'], ['a', 'b'])).toEqual([])
  })

  it('returns everything when nothing was seen this run', () => {
    expect(selectJobsToDeactivate(['a', 'b'], [])).toEqual(['a', 'b'])
  })
})

describe('isStaleByAge', () => {
  const now = new Date('2026-06-01T00:00:00.000Z')

  it('is false for a posting scraped recently', () => {
    expect(isStaleByAge('2026-05-30T00:00:00.000Z', 45, now)).toBe(false)
  })

  it('is true for a posting older than the max age', () => {
    expect(isStaleByAge('2026-03-01T00:00:00.000Z', 45, now)).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/jobSources/liveness.test.ts`
Expected: FAIL — `./liveness` does not exist yet.

- [ ] **Step 3: Write the minimal implementation**

```ts
// scripts/jobSources/liveness.ts

/** Pure set-difference: ids that were active before but weren't seen in this run. */
export function selectJobsToDeactivate(existingActiveIds: string[], seenIdsThisRun: string[]): string[] {
  const seen = new Set(seenIdsThisRun)
  return existingActiveIds.filter((id) => !seen.has(id))
}

/** True when a posting hasn't been re-confirmed in longer than maxAgeDays. */
export function isStaleByAge(scrapedAt: string, maxAgeDays: number, now: Date = new Date()): boolean {
  const scrapedAtMs = new Date(scrapedAt).getTime()
  const ageMs = now.getTime() - scrapedAtMs
  return ageMs > maxAgeDays * 24 * 60 * 60 * 1000
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/jobSources/liveness.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add scripts/jobSources/liveness.ts scripts/jobSources/liveness.test.ts
git commit -m "feat: add pure job-liveness/staleness helpers"
```

### Task 6: Wire liveness sweep into scrapeCompanies.ts

**Files:**
- Modify: `scripts/scrapeCompanies.ts`

**Interfaces:**
- Consumes: `selectJobsToDeactivate`, `isStaleByAge` (Task 5); `supabase`, `PROVIDERS` (Task 4)

This is an I/O shell modification (Supabase reads/writes) — no new unit test, consistent with Task 4's convention. Verification is manual (Step 3 below).

- [ ] **Step 1: Add per-company "gone" detection**

```ts
// scripts/scrapeCompanies.ts — add these imports
import { selectJobsToDeactivate, isStaleByAge } from './jobSources/liveness'
```

```ts
// scripts/scrapeCompanies.ts — add this function
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
```

- [ ] **Step 2: Add an age-based fallback sweep and call both from `main()`**

```ts
// scripts/scrapeCompanies.ts — add this function
async function deactivateStaleJobs(maxAgeDays: number): Promise<void> {
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
```

```ts
// scripts/scrapeCompanies.ts — inside the existing per-slug try block, right after `await upsertJobs(jobs)`
        await deactivateGoneJobs(providerName, slug, jobs.map((j) => j.external_id))
```

```ts
// scripts/scrapeCompanies.ts — inside main(), right before `console.log('Done.')`
  await deactivateStaleJobs(45)
```

- [ ] **Step 3: Manually verify**

Run: `npm run scrape:companies` twice in a row against a real board with a job temporarily removed between runs (or manually flip one row's `external_id` in Supabase to simulate a posting disappearing).
Expected: the second run's log shows a `Deactivated N ... job(s) no longer listed.` line, and that row's `is_active` becomes `false` in the Supabase dashboard.

- [ ] **Step 4: Commit**

```bash
git add scripts/scrapeCompanies.ts
git commit -m "feat: deactivate gone and stale scraped_jobs rows"
```

---

## Task Group 3: Forward DNA → FreshFit Scoring Integration

**Design note (refines audit Section F):** rather than proportionally re-weighting the existing four factors down, the two new Forward DNA factors are **additive bonus points on top of the existing four**, with the total capped at 100 via `Math.min(100, ...)`. This keeps today's scoring byte-for-byte identical when no Forward DNA data is passed (the new `dna` parameter defaults to empty arrays), and Forward DNA evidence can only ever help a score, never hurt it or change existing weights.

### Task 7: Extend `JobMatchScoreBreakdown`

**Files:**
- Modify: `src/types/index.ts:420-425`

**Interfaces:**
- Produces: `JobMatchScoreBreakdown.dnaSkillEvidence?: number`, `JobMatchScoreBreakdown.scopeFit?: number`

This is a type-only change with nothing to unit test on its own; it's verified transitively by Tasks 9-11's tests.

- [ ] **Step 1: Add the two new optional keys**

```ts
// src/types/index.ts — replace the existing JobMatchScoreBreakdown interface
export interface JobMatchScoreBreakdown {
  skillsCoverage: number
  roleRelevance: number
  locationFit: number
  keywordDensity: number
  dnaSkillEvidence?: number
  scopeFit?: number
}
```

They are optional (`?:`) because existing rows already stored in `job_matches.score_breakdown` predate this change and won't have these keys — any UI reading them must default to `?? 0`.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors (optional fields don't break existing object literals that omit them).

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add Forward DNA fields to JobMatchScoreBreakdown"
```

### Task 8: Baseline characterization tests for `computeFreshFitScore`

**Files:**
- Create: `src/lib/freshFitScore.test.ts`

**Interfaces:**
- Consumes: `computeFreshFitScore` (existing, unmodified so far)

`computeFreshFitScore` currently has zero test coverage. Before changing its behavior in Task 11, lock in today's behavior with characterization tests. Because the implementation already exists, these tests are expected to **pass immediately** — this is the one task in this plan that intentionally isn't red-then-green, since it's documenting existing behavior rather than driving new behavior.

- [ ] **Step 1: Write the tests**

```ts
// src/lib/freshFitScore.test.ts
import { describe, it, expect } from 'vitest'
import { computeFreshFitScore } from './freshFitScore'
import type { MemberProfile, ScrapedJob } from '@/types'

function makeProfile(overrides: Partial<MemberProfile> = {}): MemberProfile {
  return {
    skills: ['sql', 'excel', 'customer service'],
    preferred_jobs: ['Data Analyst'],
    employment_history: [
      { title: 'Data Analyst', company: 'Acme', start_date: '2020-01-01', end_date: null, current: true, description: '' },
    ],
    location: 'Dallas, TX',
    remote_preference: 'remote',
    willing_to_relocate: false,
    summary: 'Experienced data analyst with strong SQL skills.',
    headline: 'Data Analyst',
    career_goals: null,
    strengths: null,
    ...overrides,
  } as MemberProfile
}

function makeJob(overrides: Partial<ScrapedJob> = {}): ScrapedJob {
  return {
    id: 'job-1',
    source: 'greenhouse',
    external_id: '1',
    title: 'Data Analyst',
    company: 'Acme',
    location: 'Remote',
    description: 'Looking for a data analyst with strong SQL and excel skills.',
    salary_text: null,
    employment_type: null,
    posting_url: 'https://example.com/job/1',
    posted_at: null,
    search_query: null,
    is_active: true,
    scraped_at: '',
    created_at: '',
    ...overrides,
  } as ScrapedJob
}

describe('computeFreshFitScore (baseline, no Forward DNA data)', () => {
  it('scores a well-matched profile highly and lists matched skills', () => {
    const result = computeFreshFitScore(makeProfile(), makeJob())
    expect(result.score).toBeGreaterThan(50)
    expect(result.matchedSkills).toEqual(expect.arrayContaining(['sql']))
    expect(result.breakdown.dnaSkillEvidence ?? 0).toBe(0)
    expect(result.breakdown.scopeFit ?? 0).toBe(0)
  })

  it('never exceeds a total score of 100', () => {
    const result = computeFreshFitScore(makeProfile(), makeJob())
    expect(result.score).toBeLessThanOrEqual(100)
  })

  it('scores a completely unrelated job low', () => {
    const result = computeFreshFitScore(
      makeProfile({ skills: ['welding'] }),
      makeJob({ title: 'Nurse', description: 'Clinical patient care and phlebotomy required.' })
    )
    expect(result.score).toBeLessThan(30)
  })
})
```

- [ ] **Step 2: Run and confirm it passes immediately**

Run: `npx vitest run src/lib/freshFitScore.test.ts`
Expected: PASS (3 tests) — confirms today's behavior before Task 11 changes it.

- [ ] **Step 3: Commit**

```bash
git add src/lib/freshFitScore.test.ts
git commit -m "test: add baseline characterization tests for computeFreshFitScore"
```

### Task 9: `scoreSkillEvidence` pure function

**Files:**
- Create: `src/lib/forwardDna/matching.ts`
- Test: `src/lib/forwardDna/matching.test.ts`

**Interfaces:**
- Consumes: `CareerSkill` (existing, `src/types/forwardDna.ts`)
- Produces: `scoreSkillEvidence(careerSkills: CareerSkill[], jdSkills: string[]): { points: number; matched: string[] }`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/forwardDna/matching.test.ts
import { describe, it, expect } from 'vitest'
import { scoreSkillEvidence } from './matching'
import type { CareerSkill } from '@/types/forwardDna'

function makeSkill(overrides: Partial<CareerSkill>): CareerSkill {
  return {
    id: 's1', user_id: 'u1', skill_name: 'sql', state: 'claimed',
    evidence_note: null, created_at: '', updated_at: '', ...overrides,
  }
}

describe('scoreSkillEvidence', () => {
  it('returns 0 when there are no JD skills or no career skills', () => {
    expect(scoreSkillEvidence([], ['sql'])).toEqual({ points: 0, matched: [] })
    expect(scoreSkillEvidence([makeSkill({})], [])).toEqual({ points: 0, matched: [] })
  })

  it('awards more points for demonstrated/supported skills than claimed', () => {
    const claimed = scoreSkillEvidence([makeSkill({ skill_name: 'sql', state: 'claimed' })], ['sql'])
    const supported = scoreSkillEvidence([makeSkill({ skill_name: 'sql', state: 'supported' })], ['sql'])
    expect(supported.points).toBeGreaterThan(claimed.points)
    expect(claimed.matched).toEqual(['sql'])
  })

  it('never awards more than 15 points', () => {
    const skills = ['sql', 'excel', 'leadership'].map((name) => makeSkill({ skill_name: name, state: 'supported' }))
    const result = scoreSkillEvidence(skills, ['sql', 'excel', 'leadership'])
    expect(result.points).toBeLessThanOrEqual(15)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/forwardDna/matching.test.ts`
Expected: FAIL — `./matching` does not exist yet.

- [ ] **Step 3: Write the minimal implementation**

```ts
// src/lib/forwardDna/matching.ts
import type { CareerSkill } from '@/types/forwardDna'

const STATE_WEIGHT: Record<string, number> = { claimed: 0.5, demonstrated: 0.8, supported: 1 }

/**
 * Bonus points (0-15) for JD-detected skills the member has recorded as
 * Forward DNA evidence, weighted by how well-evidenced the skill is.
 * Additive on top of freshFitScore's existing skillsCoverage factor
 * (which only checks the flat skills[] list) -- a skill marked
 * 'demonstrated' or 'supported' earns extra credit beyond simply being
 * listed.
 */
export function scoreSkillEvidence(
  careerSkills: CareerSkill[],
  jdSkills: string[]
): { points: number; matched: string[] } {
  if (jdSkills.length === 0 || careerSkills.length === 0) return { points: 0, matched: [] }

  const byName = new Map(careerSkills.map((s) => [s.skill_name.toLowerCase(), s]))
  const matched: string[] = []
  let earned = 0

  for (const skill of jdSkills) {
    const evidence = byName.get(skill.toLowerCase())
    if (!evidence) continue
    matched.push(skill)
    earned += STATE_WEIGHT[evidence.state] ?? 0
  }

  const points = Math.round((earned / jdSkills.length) * 15)
  return { points: Math.min(15, points), matched }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/forwardDna/matching.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/forwardDna/matching.ts src/lib/forwardDna/matching.test.ts
git commit -m "feat: add scoreSkillEvidence Forward DNA scoring factor"
```

### Task 10: `scoreScopeFit` pure function

**Files:**
- Modify: `src/lib/forwardDna/matching.ts`
- Modify: `src/lib/forwardDna/matching.test.ts`

**Interfaces:**
- Consumes: `CareerScope` (existing, `src/types/forwardDna.ts`)
- Produces: `scoreScopeFit(careerScope: CareerScope[], jobDescription: string): number`

- [ ] **Step 1: Add the failing tests**

```ts
// src/lib/forwardDna/matching.test.ts — append
import { scoreScopeFit } from './matching'
import type { CareerScope } from '@/types/forwardDna'

function makeScope(overrides: Partial<CareerScope>): CareerScope {
  return {
    id: 'sc1', user_id: 'u1', employment_entry_id: 'e1',
    revenue_managed_cents: null, team_size: null, budget_managed_cents: null,
    direct_reports: null, notes: null, created_at: '', updated_at: '', ...overrides,
  }
}

describe('scoreScopeFit', () => {
  it('returns 0 when there is no scope data or no scope language in the JD', () => {
    expect(scoreScopeFit([], 'We need a team player.')).toBe(0)
    expect(scoreScopeFit([makeScope({ team_size: 10 })], 'We need a team player.')).toBe(0)
  })

  it('awards points when the member has led a team at least as large as the JD implies', () => {
    const result = scoreScopeFit([makeScope({ team_size: 10 })], 'You will lead a team of 8 engineers.')
    expect(result).toBeGreaterThan(0)
  })

  it('awards points when the member has managed at least as much budget as the JD implies', () => {
    const result = scoreScopeFit([makeScope({ budget_managed_cents: 500_000_00 })], 'Own a $2M budget.')
    expect(result).toBeGreaterThan(0)
  })

  it('awards 0 when the member has less scope than the JD implies', () => {
    const result = scoreScopeFit([makeScope({ team_size: 2 })], 'You will lead a team of 8 engineers.')
    expect(result).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/forwardDna/matching.test.ts`
Expected: FAIL — `scoreScopeFit` is not exported yet.

- [ ] **Step 3: Write the minimal implementation**

```ts
// src/lib/forwardDna/matching.ts — append
import type { CareerScope } from '@/types/forwardDna'

const TEAM_SIZE_RE = /team of (\d+)|(\d+)\+?\s+(?:direct )?reports?/i
const BUDGET_RE = /\$\s?(\d+(?:\.\d+)?)\s?(million|m|k)\b/i

function parseScopeSignals(jobDescription: string): { teamSize: number | null; budgetCents: number | null } {
  const teamMatch = jobDescription.match(TEAM_SIZE_RE)
  const teamSize = teamMatch ? Number(teamMatch[1] ?? teamMatch[2]) : null

  const budgetMatch = jobDescription.match(BUDGET_RE)
  let budgetCents: number | null = null
  if (budgetMatch) {
    const amount = Number(budgetMatch[1])
    const unit = budgetMatch[2].toLowerCase()
    const dollars = unit.startsWith('m') ? amount * 1_000_000 : amount * 1_000
    budgetCents = Math.round(dollars * 100)
  }

  return { teamSize, budgetCents }
}

/**
 * Bonus points (0-10) when the JD implies a scope (team size / budget)
 * the member has evidence of having handled before, per their Forward
 * DNA career_scope entries. Best-effort regex extraction (YAGNI) -- a
 * JD with no detectable scope language scores 0 here, it never scores
 * negative or blocks a match.
 */
export function scoreScopeFit(careerScope: CareerScope[], jobDescription: string): number {
  if (careerScope.length === 0) return 0

  const { teamSize, budgetCents } = parseScopeSignals(jobDescription)
  if (teamSize === null && budgetCents === null) return 0

  const maxTeamSize = Math.max(0, ...careerScope.map((s) => s.team_size ?? 0))
  const maxBudgetCents = Math.max(0, ...careerScope.map((s) => s.budget_managed_cents ?? 0))

  let points = 0
  if (teamSize !== null && maxTeamSize >= teamSize) points += 5
  if (budgetCents !== null && maxBudgetCents >= budgetCents) points += 5

  return points
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/forwardDna/matching.test.ts`
Expected: PASS (7 tests total)

- [ ] **Step 5: Commit**

```bash
git add src/lib/forwardDna/matching.ts src/lib/forwardDna/matching.test.ts
git commit -m "feat: add scoreScopeFit Forward DNA scoring factor"
```

### Task 11: Wire both factors into `computeFreshFitScore`

**Files:**
- Modify: `src/lib/freshFitScore.ts`
- Modify: `src/lib/freshFitScore.test.ts`

**Interfaces:**
- Consumes: `scoreSkillEvidence`, `scoreScopeFit` (Tasks 9-10)
- Produces: `computeFreshFitScore(profile, job, dna?: { skills: CareerSkill[]; scope: CareerScope[] })` (third parameter is new and optional, defaulting to empty arrays so every existing call site keeps compiling and behaving identically)

- [ ] **Step 1: Add the failing tests**

```ts
// src/lib/freshFitScore.test.ts — append
import type { CareerSkill, CareerScope } from '@/types/forwardDna'

describe('computeFreshFitScore (with Forward DNA data)', () => {
  it('adds bonus points for demonstrated/supported skill evidence', () => {
    const withoutDna = computeFreshFitScore(makeProfile(), makeJob())
    const skills: CareerSkill[] = [
      { id: 's1', user_id: 'u1', skill_name: 'sql', state: 'demonstrated', evidence_note: null, created_at: '', updated_at: '' },
    ]
    const withDna = computeFreshFitScore(makeProfile(), makeJob(), { skills, scope: [] })
    expect(withDna.score).toBeGreaterThan(withoutDna.score)
    expect(withDna.breakdown.dnaSkillEvidence).toBeGreaterThan(0)
  })

  it('adds bonus points when career_scope covers a JD-implied team size', () => {
    const job = makeJob({ description: 'You will lead a team of 8 engineers.' })
    const scope: CareerScope[] = [
      { id: 'sc1', user_id: 'u1', employment_entry_id: 'e1', revenue_managed_cents: null, team_size: 10, budget_managed_cents: null, direct_reports: null, notes: null, created_at: '', updated_at: '' },
    ]
    const result = computeFreshFitScore(makeProfile(), job, { skills: [], scope })
    expect(result.breakdown.scopeFit).toBeGreaterThan(0)
  })

  it('still caps the total score at 100 even with Forward DNA bonuses', () => {
    const skills: CareerSkill[] = ['sql', 'excel'].map((name) => ({
      id: name, user_id: 'u1', skill_name: name, state: 'supported', evidence_note: null, created_at: '', updated_at: '',
    }))
    const scope: CareerScope[] = [
      { id: 'sc1', user_id: 'u1', employment_entry_id: 'e1', revenue_managed_cents: null, team_size: 999, budget_managed_cents: null, direct_reports: null, notes: null, created_at: '', updated_at: '' },
    ]
    const result = computeFreshFitScore(makeProfile(), makeJob({ description: 'Lead a team of 500 with strong SQL and excel skills.' }), { skills, scope })
    expect(result.score).toBeLessThanOrEqual(100)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/freshFitScore.test.ts`
Expected: FAIL — `computeFreshFitScore` doesn't accept a third argument yet, `breakdown.dnaSkillEvidence`/`scopeFit` are always 0.

- [ ] **Step 3: Wire the new factors in**

```ts
// src/lib/freshFitScore.ts — add these imports at the top
import { scoreSkillEvidence, scoreScopeFit } from './forwardDna/matching'
import type { CareerSkill, CareerScope } from '@/types/forwardDna'
```

```ts
// src/lib/freshFitScore.ts — replace the existing computeFreshFitScore function
export function computeFreshFitScore(
  profile: MemberProfile,
  job: ScrapedJob,
  dna: { skills: CareerSkill[]; scope: CareerScope[] } = { skills: [], scope: [] }
): FreshFitResult {
  const jdSkills = findSkillsInText(`${job.title} ${job.description}`)
  const skillsResult = scoreSkillsCoverage(profile.skills || [], jdSkills)
  const roleRelevance = scoreRoleRelevance(profile, job)
  const locationFit = scoreLocationFit(profile, job)
  const keywordDensity = scoreKeywordDensity(profile, job)
  const dnaSkillResult = scoreSkillEvidence(dna.skills, jdSkills)
  const scopeFit = scoreScopeFit(dna.scope, job.description)

  const score = Math.min(
    100,
    skillsResult.points + roleRelevance + locationFit + keywordDensity + dnaSkillResult.points + scopeFit
  )

  return {
    score,
    matchedSkills: [...new Set([...skillsResult.matched, ...dnaSkillResult.matched])].slice(0, 10),
    missingSkills: skillsResult.missing,
    breakdown: {
      skillsCoverage: skillsResult.points,
      roleRelevance,
      locationFit,
      keywordDensity,
      dnaSkillEvidence: dnaSkillResult.points,
      scopeFit,
    },
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/freshFitScore.test.ts`
Expected: PASS (6 tests total)

- [ ] **Step 5: Commit**

```bash
git add src/lib/freshFitScore.ts src/lib/freshFitScore.test.ts
git commit -m "feat: wire Forward DNA skill evidence and scope fit into FreshFit scoring"
```

### Task 12: Pass Forward DNA data through `syncFreshFitScores.ts`

**Files:**
- Modify: `scripts/syncFreshFitScores.ts`

**Interfaces:**
- Consumes: `computeFreshFitScore(profile, job, dna)` (Task 11)

This is an I/O shell modification (Supabase reads) — no new unit test, consistent with this script having no existing test coverage. Verification is manual (Step 3 below).

- [ ] **Step 1: Fetch all career_skills and career_scope rows up front**

```ts
// scripts/syncFreshFitScores.ts — add these imports
import type { CareerSkill, CareerScope } from '../src/types/forwardDna'
```

```ts
// scripts/syncFreshFitScores.ts — inside main(), after the existing profiles/jobs fetch
  const { data: skillRows } = await supabase.from('career_skills').select('*')
  const { data: scopeRows } = await supabase.from('career_scope').select('*')

  const skillsByUser = new Map<string, CareerSkill[]>()
  for (const row of (skillRows ?? []) as CareerSkill[]) {
    skillsByUser.set(row.user_id, [...(skillsByUser.get(row.user_id) ?? []), row])
  }

  const scopeByUser = new Map<string, CareerScope[]>()
  for (const row of (scopeRows ?? []) as CareerScope[]) {
    scopeByUser.set(row.user_id, [...(scopeByUser.get(row.user_id) ?? []), row])
  }
```

- [ ] **Step 2: Pass the per-member slices into `computeFreshFitScore`**

```ts
// scripts/syncFreshFitScores.ts — replace the existing scoring call inside the double loop
      const result = computeFreshFitScore(member, job, {
        skills: skillsByUser.get(member.user_id) ?? [],
        scope: scopeByUser.get(member.user_id) ?? [],
      })
```

- [ ] **Step 3: Manually verify**

Run: `npm run sync:freshfit` against a test member who has at least one `career_skills` row matching a scraped job's description.
Expected: that member's `job_matches.score_breakdown` now includes a non-zero `dnaSkillEvidence` value in the Supabase dashboard.

- [ ] **Step 4: Commit**

```bash
git add scripts/syncFreshFitScores.ts
git commit -m "feat: pass Forward DNA data into the FreshFit sync script"
```

### Task 13: Forward DNA-aware `why_it_matches` text

**Files:**
- Modify: `src/lib/opportunityEngine.ts`
- Create: `src/lib/opportunityEngine.test.ts`

**Interfaces:**
- Consumes: `JobMatchWithJob`, `JobMatchScoreBreakdown` (existing / Task 7)
- Produces: `buildWhyItMatches(match: JobMatchWithJob): string` (pure, exported so `promoteMatchToOpportunity` can call it)

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/opportunityEngine.test.ts
import { describe, it, expect } from 'vitest'
import { buildWhyItMatches } from './opportunityEngine'
import type { JobMatchWithJob } from '@/types'

function makeMatch(overrides: Partial<JobMatchWithJob> = {}): JobMatchWithJob {
  return {
    id: 'm1', member_id: 'u1', scraped_job_id: 'j1', fresh_fit_score: 72,
    matched_skills: ['sql', 'excel'], missing_skills: [], score_breakdown: {},
    dismissed_at: null, promoted_opportunity_id: null, computed_at: '2026-01-01',
    scraped_job: {
      id: 'j1', source: 'greenhouse', external_id: '1', title: 'Analyst', company: 'Acme',
      location: null, description: '', salary_text: null, employment_type: null, posting_url: '',
      posted_at: null, search_query: null, is_active: true, scraped_at: '', created_at: '',
    },
    ...overrides,
  }
}

describe('buildWhyItMatches', () => {
  it('describes matched skills without Forward DNA evidence', () => {
    expect(buildWhyItMatches(makeMatch())).toBe('FreshFit score 72/100. Matched skills: sql, excel.')
  })

  it('calls out strong Forward DNA evidence when present', () => {
    const text = buildWhyItMatches(
      makeMatch({ score_breakdown: { skillsCoverage: 40, roleRelevance: 10, locationFit: 10, keywordDensity: 5, dnaSkillEvidence: 12, scopeFit: 5 } })
    )
    expect(text).toContain('strong fit')
  })

  it('calls out partial Forward DNA evidence when present but low', () => {
    const text = buildWhyItMatches(
      makeMatch({ score_breakdown: { skillsCoverage: 40, roleRelevance: 10, locationFit: 10, keywordDensity: 5, dnaSkillEvidence: 5, scopeFit: 0 } })
    )
    expect(text).toContain('partial fit')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/opportunityEngine.test.ts`
Expected: FAIL — `buildWhyItMatches` is not exported yet.

- [ ] **Step 3: Write the minimal implementation and use it in `promoteMatchToOpportunity`**

```ts
// src/lib/opportunityEngine.ts — add this import
import type { JobMatchScoreBreakdown } from '@/types'
```

```ts
// src/lib/opportunityEngine.ts — add this exported function
export function buildWhyItMatches(match: JobMatchWithJob): string {
  const breakdown = match.score_breakdown as JobMatchScoreBreakdown
  const skillsNote = `Matched skills: ${match.matched_skills.join(', ') || 'none detected'}.`
  if (!breakdown?.dnaSkillEvidence) {
    return `FreshFit score ${match.fresh_fit_score}/100. ${skillsNote}`
  }
  const strength = breakdown.dnaSkillEvidence >= 10 ? 'strong' : 'partial'
  return `FreshFit score ${match.fresh_fit_score}/100. ${skillsNote} Forward DNA evidence backs ${strength} fit on these skills.`
}
```

```ts
// src/lib/opportunityEngine.ts — inside promoteMatchToOpportunity, replace the why_it_matches line
    why_it_matches: buildWhyItMatches(match),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/opportunityEngine.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/opportunityEngine.ts src/lib/opportunityEngine.test.ts
git commit -m "feat: quote Forward DNA evidence in promoted opportunity's why_it_matches"
```

---

## Task Group 4: Member "Submit a Job" Entry Point

**Design note (refines audit Section C-6):** V1 is manual entry only (title/company/location/salary/URL/description typed or pasted by the member) — no server-side fetching of an arbitrary URL. Adding a new generic-webpage-fetch capability would recreate exactly the kind of ToS-adjacent fragility this audit flagged in Task Group 1; job_finder's own `/api/add-job` supports this same manual path as a first-class option, not just a fallback.

### Task 14: RLS policies for member-submitted rows

**Files:**
- Create: `supabase/migrations/20260901000000_member_submitted_jobs.sql`

**Interfaces:**
- Produces: an `authenticated` INSERT policy on `scraped_jobs` scoped to `source = 'member-submitted'`; an `authenticated` INSERT policy on `job_matches` scoped to `member_id = auth.uid()`

SQL migrations in this repo have no automated test coverage (none of the existing 21 migration files do) — verification is manual (Step 2 below), consistent with that convention.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260901000000_member_submitted_jobs.sql
/*
# Member-Submitted Jobs

## Overview
Lets a member submit their own job lead (typed in, not fetched from a
URL) directly into the existing Opportunity Engine pipeline, instead of
only waiting for the scheduled scraper. Purely additive: no existing
table, column, trigger, or policy is modified.

## Security
- scraped_jobs: the existing service-role-only write assumption for
  every other source is untouched. This adds one narrowly-scoped policy
  letting an authenticated member INSERT a row only when
  source = 'member-submitted' -- they cannot insert or spoof rows for
  any other source.
- job_matches: the existing service-role-only write assumption (aside
  from the member-dismiss / strategist-promote UPDATE policies) is
  untouched. This adds one policy letting an authenticated member
  INSERT a row only for themselves (member_id = auth.uid()). This is
  safe because a self-computed FreshFit score is not a trust boundary --
  worst case a member inflates their own score, which only changes what
  they see in their own queue; strategists independently review the
  underlying posting before promoting anything to a real Opportunity.
*/

DROP POLICY IF EXISTS "member_insert_own_scraped_job" ON scraped_jobs;
CREATE POLICY "member_insert_own_scraped_job"
  ON scraped_jobs FOR INSERT
  TO authenticated
  WITH CHECK (source = 'member-submitted');

DROP POLICY IF EXISTS "member_insert_own_job_match" ON job_matches;
CREATE POLICY "member_insert_own_job_match"
  ON job_matches FOR INSERT
  TO authenticated
  WITH CHECK (member_id = auth.uid());
```

- [ ] **Step 2: Manually verify**

Run the migration locally (`supabase db push` or the project's existing migration-apply flow), then in the Supabase SQL editor, run as an authenticated test user:
```sql
insert into scraped_jobs (source, external_id, title, company, description, posting_url, search_query)
values ('member-submitted', 'test-1', 'Test Title', 'Test Co', 'desc', '', 'member-submitted');
```
Expected: succeeds. Then try the same insert with `source = 'indeed'` as that same user.
Expected: fails with a row-level security policy violation.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260901000000_member_submitted_jobs.sql
git commit -m "feat: add RLS policies for member-submitted jobs and matches"
```

### Task 15: Job submission validation

**Files:**
- Create: `src/lib/jobSubmission.ts`
- Test: `src/lib/jobSubmission.test.ts`

**Interfaces:**
- Produces: `JobSubmissionInput` (interface), `JobSubmissionValidation` (interface), `validateJobSubmission(input: JobSubmissionInput): JobSubmissionValidation`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/jobSubmission.test.ts
import { describe, it, expect } from 'vitest'
import { validateJobSubmission } from './jobSubmission'

const valid = { title: 'Data Analyst', company: 'Acme', location: '', salaryText: '', postingUrl: '', description: 'SQL required.' }

describe('validateJobSubmission', () => {
  it('is valid with just title, company, and description', () => {
    expect(validateJobSubmission(valid)).toEqual({ valid: true, errors: {} })
  })

  it('requires title, company, and description', () => {
    const result = validateJobSubmission({ ...valid, title: '', company: '', description: '' })
    expect(result.valid).toBe(false)
    expect(result.errors.title).toBeDefined()
    expect(result.errors.company).toBeDefined()
    expect(result.errors.description).toBeDefined()
  })

  it('rejects an invalid posting URL but allows a blank one', () => {
    expect(validateJobSubmission({ ...valid, postingUrl: 'not-a-url' }).valid).toBe(false)
    expect(validateJobSubmission({ ...valid, postingUrl: '' }).valid).toBe(true)
    expect(validateJobSubmission({ ...valid, postingUrl: 'https://example.com/job/1' }).valid).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/jobSubmission.test.ts`
Expected: FAIL — `./jobSubmission` does not exist yet.

- [ ] **Step 3: Write the minimal implementation**

```ts
// src/lib/jobSubmission.ts
export interface JobSubmissionInput {
  title: string
  company: string
  location: string
  salaryText: string
  postingUrl: string
  description: string
}

export interface JobSubmissionValidation {
  valid: boolean
  errors: Partial<Record<keyof JobSubmissionInput, string>>
}

export function validateJobSubmission(input: JobSubmissionInput): JobSubmissionValidation {
  const errors: Partial<Record<keyof JobSubmissionInput, string>> = {}

  if (!input.title.trim()) errors.title = 'Job title is required.'
  if (!input.company.trim()) errors.company = 'Company is required.'
  if (!input.description.trim()) errors.description = 'Paste at least a short description so we can score it.'

  if (input.postingUrl.trim()) {
    try {
      new URL(input.postingUrl.trim())
    } catch {
      errors.postingUrl = "That doesn't look like a valid URL."
    }
  }

  return { valid: Object.keys(errors).length === 0, errors }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/jobSubmission.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/jobSubmission.ts src/lib/jobSubmission.test.ts
git commit -m "feat: add member job-submission validation"
```

### Task 16: `submitMemberJob`

**Files:**
- Modify: `src/lib/opportunityEngine.ts`
- Modify: `src/lib/opportunityEngine.test.ts`

**Interfaces:**
- Consumes: `JobSubmissionInput` (Task 15), `computeFreshFitScore` (Task 11), the RLS policies from Task 14
- Produces: `submitMemberJob(profile: MemberProfile, input: JobSubmissionInput, client?: SupabaseClient): Promise<{ match: JobMatchWithJob | null; error: string | null }>`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/opportunityEngine.test.ts — append
import { vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { submitMemberJob } from './opportunityEngine'
import type { MemberProfile } from '@/types'

function makeFakeClient(opts: {
  jobRow?: Record<string, unknown> | null
  jobError?: string
  matchRow?: Record<string, unknown> | null
  matchError?: string
}) {
  const scrapedJobsSingle = vi.fn().mockResolvedValue({
    data: opts.jobRow ?? null,
    error: opts.jobError ? { message: opts.jobError } : null,
  })
  const scrapedJobsInsert = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: scrapedJobsSingle }) })

  const jobMatchesSingle = vi.fn().mockResolvedValue({
    data: opts.matchRow ?? null,
    error: opts.matchError ? { message: opts.matchError } : null,
  })
  const jobMatchesInsert = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: jobMatchesSingle }) })

  const fromMock = vi.fn((table: string) => {
    if (table === 'scraped_jobs') return { insert: scrapedJobsInsert }
    if (table === 'job_matches') return { insert: jobMatchesInsert }
    throw new Error(`Unexpected table: ${table}`)
  })

  return { client: { from: fromMock } as unknown as SupabaseClient }
}

const submissionProfile = { user_id: 'member-1', skills: ['sql'] } as unknown as MemberProfile
const submissionInput = { title: 'Data Analyst', company: 'Acme', location: '', salaryText: '', postingUrl: '', description: 'SQL required.' }

describe('submitMemberJob', () => {
  it('inserts a scraped_jobs row and a scored job_matches row', async () => {
    const jobRow = {
      id: 'job-1', source: 'member-submitted', external_id: 'member-member-1-123', title: 'Data Analyst',
      company: 'Acme', location: null, description: 'SQL required.', salary_text: null, employment_type: null,
      posting_url: '', posted_at: null, search_query: 'member-submitted', is_active: true, scraped_at: '', created_at: '',
    }
    const matchRow = { id: 'match-1', member_id: 'member-1', scraped_job_id: 'job-1' }
    const { client } = makeFakeClient({ jobRow, matchRow })

    const { match, error } = await submitMemberJob(submissionProfile, submissionInput, client)

    expect(error).toBeNull()
    expect(match?.id).toBe('match-1')
    expect(match?.scraped_job).toEqual(jobRow)
  })

  it('returns an error when the scraped_jobs insert fails', async () => {
    const { client } = makeFakeClient({ jobError: 'insert failed' })
    const { match, error } = await submitMemberJob(submissionProfile, submissionInput, client)
    expect(match).toBeNull()
    expect(error).toBe('insert failed')
  })

  it('returns an error when the job_matches insert fails', async () => {
    const jobRow = { id: 'job-1', source: 'member-submitted', external_id: 'x', title: 't', company: 'c', description: 'd', posting_url: '', search_query: 'member-submitted', is_active: true }
    const { client } = makeFakeClient({ jobRow, matchError: 'match insert failed' })
    const { match, error } = await submitMemberJob(submissionProfile, submissionInput, client)
    expect(match).toBeNull()
    expect(error).toBe('match insert failed')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/opportunityEngine.test.ts`
Expected: FAIL — `submitMemberJob` is not exported yet.

- [ ] **Step 3: Write the minimal implementation**

```ts
// src/lib/opportunityEngine.ts — add these imports
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase as defaultClient } from '@/lib/supabase'
import { computeFreshFitScore } from '@/lib/freshFitScore'
import type { MemberProfile, ScrapedJob } from '@/types'
import type { JobSubmissionInput } from '@/lib/jobSubmission'
```

```ts
// src/lib/opportunityEngine.ts — add this exported function
export async function submitMemberJob(
  profile: MemberProfile,
  input: JobSubmissionInput,
  client: SupabaseClient = defaultClient
): Promise<{ match: JobMatchWithJob | null; error: string | null }> {
  const externalId = `member-${profile.user_id}-${Date.now()}`

  const { data: jobRow, error: insertError } = await client
    .from('scraped_jobs')
    .insert({
      source: 'member-submitted',
      external_id: externalId,
      title: input.title.trim(),
      company: input.company.trim(),
      location: input.location.trim() || null,
      description: input.description.trim(),
      salary_text: input.salaryText.trim() || null,
      posting_url: input.postingUrl.trim() || '',
      search_query: 'member-submitted',
      is_active: true,
    })
    .select()
    .single()

  if (insertError || !jobRow) {
    return { match: null, error: insertError?.message ?? 'Could not save that job.' }
  }

  const job = jobRow as ScrapedJob
  const result = computeFreshFitScore(profile, job)

  const { data: matchRow, error: matchError } = await client
    .from('job_matches')
    .insert({
      member_id: profile.user_id,
      scraped_job_id: job.id,
      fresh_fit_score: result.score,
      matched_skills: result.matchedSkills,
      missing_skills: result.missingSkills,
      score_breakdown: result.breakdown,
    })
    .select()
    .single()

  if (matchError || !matchRow) {
    return { match: null, error: matchError?.message ?? 'Job saved, but scoring it failed.' }
  }

  return { match: { ...matchRow, scraped_job: job } as JobMatchWithJob, error: null }
}
```

Note: `posting_url` defaults to `''` rather than `null` when omitted because the `scraped_jobs.posting_url` column is `NOT NULL` — matching the same NOT-NULL-with-empty-string convention already used for `company text NOT NULL DEFAULT ''` in that table's own migration.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/opportunityEngine.test.ts`
Expected: PASS (6 tests total)

- [ ] **Step 5: Commit**

```bash
git add src/lib/opportunityEngine.ts src/lib/opportunityEngine.test.ts
git commit -m "feat: add submitMemberJob for member-submitted job leads"
```

### Task 17: `SubmitJobModal` component

**Files:**
- Create: `src/components/SubmitJobModal.tsx`
- Test: `src/components/SubmitJobModal.test.tsx`

**Interfaces:**
- Consumes: `submitMemberJob` (Task 16), `validateJobSubmission` (Task 15)
- Produces: `SubmitJobModal({ profile, onClose, onSubmitted })` React component, following the existing modal convention in `src/components/AddCalendarEventModal.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/SubmitJobModal.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SubmitJobModal } from './SubmitJobModal'
import type { MemberProfile } from '@/types'

vi.mock('@/lib/opportunityEngine', () => ({ submitMemberJob: vi.fn() }))

const profile = { user_id: 'member-1', skills: [] } as unknown as MemberProfile

describe('SubmitJobModal', () => {
  it('disables submit until title, company, and description are filled', () => {
    render(<SubmitJobModal profile={profile} onClose={() => {}} onSubmitted={() => {}} />)
    const submitButton = screen.getByRole('button', { name: /submit & score/i })
    expect(submitButton).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/job title/i), { target: { value: 'Data Analyst' } })
    fireEvent.change(screen.getByLabelText(/^company$/i), { target: { value: 'Acme' } })
    fireEvent.change(screen.getByLabelText(/job description/i), { target: { value: 'SQL required.' } })

    expect(submitButton).not.toBeDisabled()
  })

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn()
    render(<SubmitJobModal profile={profile} onClose={onClose} onSubmitted={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onClose).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/SubmitJobModal.test.tsx`
Expected: FAIL — `./SubmitJobModal` does not exist yet.

- [ ] **Step 3: Write the minimal implementation**

```tsx
// src/components/SubmitJobModal.tsx
import { useState, type ChangeEvent, type FormEvent } from 'react'
import { submitMemberJob } from '@/lib/opportunityEngine'
import { validateJobSubmission, type JobSubmissionInput } from '@/lib/jobSubmission'
import { Loader2, X } from 'lucide-react'
import type { MemberProfile, JobMatchWithJob } from '@/types'

interface SubmitJobModalProps {
  profile: MemberProfile
  onClose: () => void
  onSubmitted: (match: JobMatchWithJob) => void
}

const EMPTY_INPUT: JobSubmissionInput = { title: '', company: '', location: '', salaryText: '', postingUrl: '', description: '' }

const FIELD_CLASS =
  'mt-1.5 w-full border border-neutral-300 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500'

export function SubmitJobModal({ profile, onClose, onSubmitted }: SubmitJobModalProps) {
  const [input, setInput] = useState<JobSubmissionInput>(EMPTY_INPUT)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const validation = validateJobSubmission(input)

  const update = (field: keyof JobSubmissionInput) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setInput((prev) => ({ ...prev, [field]: e.target.value }))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!validation.valid) return
    setSaving(true)
    setError(null)
    const { match, error: submitError } = await submitMemberJob(profile, input)
    setSaving(false)
    if (!match) {
      setError(submitError ?? 'Could not save that job. Please try again.')
      return
    }
    onSubmitted(match)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg border border-neutral-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-lg font-semibold text-neutral-900">Submit a Job</h2>
          <button onClick={onClose} aria-label="Close" className="p-1.5 text-neutral-400 hover:bg-neutral-50 hover:text-neutral-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-4 text-sm text-neutral-600">
          Found something on your own? Paste it in and we'll score it against your Career Profile the same way
          the Opportunity Engine does.
        </p>

        {error && <div className="mb-4 border border-error-200 bg-error-50 px-4 py-2.5 text-sm text-error-700">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="sj-title" className="block text-sm font-medium text-neutral-700">Job Title</label>
              <input id="sj-title" type="text" value={input.title} onChange={update('title')} required className={FIELD_CLASS} />
              {validation.errors.title && <p className="mt-1 text-xs text-error-600">{validation.errors.title}</p>}
            </div>
            <div>
              <label htmlFor="sj-company" className="block text-sm font-medium text-neutral-700">Company</label>
              <input id="sj-company" type="text" value={input.company} onChange={update('company')} required className={FIELD_CLASS} />
              {validation.errors.company && <p className="mt-1 text-xs text-error-600">{validation.errors.company}</p>}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="sj-location" className="block text-sm font-medium text-neutral-700">
                Location <span className="text-neutral-400">(optional)</span>
              </label>
              <input id="sj-location" type="text" value={input.location} onChange={update('location')} className={FIELD_CLASS} />
            </div>
            <div>
              <label htmlFor="sj-salary" className="block text-sm font-medium text-neutral-700">
                Salary <span className="text-neutral-400">(optional)</span>
              </label>
              <input id="sj-salary" type="text" value={input.salaryText} onChange={update('salaryText')} className={FIELD_CLASS} />
            </div>
          </div>

          <div>
            <label htmlFor="sj-url" className="block text-sm font-medium text-neutral-700">
              Posting URL <span className="text-neutral-400">(optional)</span>
            </label>
            <input id="sj-url" type="url" value={input.postingUrl} onChange={update('postingUrl')} placeholder="https://..." className={FIELD_CLASS} />
            {validation.errors.postingUrl && <p className="mt-1 text-xs text-error-600">{validation.errors.postingUrl}</p>}
          </div>

          <div>
            <label htmlFor="sj-desc" className="block text-sm font-medium text-neutral-700">Job Description</label>
            <textarea
              id="sj-desc" value={input.description} onChange={update('description')} required rows={5}
              placeholder="Paste the job description here so we can score it against your Career Profile."
              className={FIELD_CLASS}
            />
            {validation.errors.description && <p className="mt-1 text-xs text-error-600">{validation.errors.description}</p>}
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit" disabled={saving || !validation.valid}
              className="flex items-center gap-2 rounded-full bg-primary-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? 'Scoring\u2026' : 'Submit & Score'}
            </button>
            <button
              type="button" onClick={onClose} disabled={saving}
              className="border border-neutral-300 px-5 py-2.5 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/SubmitJobModal.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/SubmitJobModal.tsx src/components/SubmitJobModal.test.tsx
git commit -m "feat: add SubmitJobModal component"
```

### Task 18: Wire the modal into `OpportunityEnginePage`

**Files:**
- Modify: `src/pages/OpportunityEnginePage.tsx`

**Interfaces:**
- Consumes: `SubmitJobModal` (Task 17)

This page currently has no test file (consistent with the codebase's convention of not unit-testing top-level connected pages, only their pure/presentational children) — verification is manual (Step 3 below).

- [ ] **Step 1: Add the imports, state, and button**

```tsx
// src/pages/OpportunityEnginePage.tsx — update imports
import { Loader2, MapPin, DollarSign, ExternalLink, X, Sparkles, PlusCircle } from 'lucide-react'
import { SubmitJobModal } from '@/components/SubmitJobModal'
```

```tsx
// src/pages/OpportunityEnginePage.tsx — inside OpportunityEnginePage, update the useAuth destructure and add state
export function OpportunityEnginePage() {
  const { user, profile } = useAuth()
  const [matches, setMatches] = useState<JobMatchWithJob[]>([])
  const [loading, setLoading] = useState(true)
  const [showSubmitModal, setShowSubmitModal] = useState(false)
```

```tsx
// src/pages/OpportunityEnginePage.tsx — add a button next to the existing header copy
        <button
          onClick={() => setShowSubmitModal(true)}
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
        >
          <PlusCircle className="h-4 w-4" />
          Submit a Job
        </button>
```

- [ ] **Step 2: Render the modal and handle submission**

```tsx
// src/pages/OpportunityEnginePage.tsx — right before the page's closing </MemberLayout>
      {showSubmitModal && profile && (
        <SubmitJobModal
          profile={profile}
          onClose={() => setShowSubmitModal(false)}
          onSubmitted={(match) => {
            setMatches((prev) => [match, ...prev])
            setShowSubmitModal(false)
          }}
        />
      )}
```

- [ ] **Step 3: Manually verify end to end**

Run: `npm run dev`, sign in as a member, open `/opportunity-engine`, click "Submit a Job", fill in title/company/description, submit.
Expected: the modal closes, the new match appears at the top of the list with a FreshFit score, and the row is visible in Supabase's `scraped_jobs` (source `member-submitted`) and `job_matches` tables.

- [ ] **Step 4: Commit**

```bash
git add src/pages/OpportunityEnginePage.tsx
git commit -m "feat: wire Submit a Job into OpportunityEnginePage"
```

---

## Self-Review

**Spec coverage** (against `docs/audit/2026-job-search-oss-audit.md`):
- Section E (replace Indeed) → Tasks 1-4.
- Section H staleness gap / Section C-3 (liveness) → Tasks 5-6.
- Section F (Forward DNA integration) → Tasks 7-13.
- Section C-6 / I-3 (member-submitted job) → Tasks 14-18.
- Section H's AGPL warning → respected throughout: every implementation above is written from scratch against real, independently-verifiable public API/library documentation, not adapted from any audited repo's source.

**Placeholder scan:** the only non-literal value in this plan is the example company slugs in `companies.json` (Task 4, Step 1), which is operational configuration data the site owner must fill in with real companies — not a missing implementation detail. Every function, type, and test above is complete, runnable code.

**Type consistency:** `ScrapedJobInput` (Task 1) is reused unchanged by Tasks 2-4. `computeFreshFitScore`'s third parameter shape (`{ skills: CareerSkill[]; scope: CareerScope[] }`, Task 11) matches exactly what Task 12's sync script and Task 16's `submitMemberJob` pass in (or omit, relying on the default). `JobMatchScoreBreakdown`'s new optional keys (Task 7) are read consistently as `?? 0` / truthiness-checked everywhere they're consumed (Task 13's `buildWhyItMatches`, Task 11's tests).
