/**
 * OE 2.0 Phase 7 -- Career-Market Intelligence.
 *
 * Computes aggregate, anonymized market-signal snapshots from
 * `scraped_jobs` (see src/lib/opportunityEngine/marketIntelligence.ts
 * for the pure, already-unit-tested bucketing/aggregation logic this
 * script calls) and upserts them into `market_intelligence_snapshots`.
 *
 * This script performs NO member-scoped reads or writes whatsoever --
 * it only ever touches `scraped_jobs` (public postings) and
 * `market_intelligence_snapshots` (aggregate output, no member_id
 * column). It is the thin persistence wrapper anticipated by
 * marketIntelligence.ts's own module docs.
 *
 * Usage:
 *   npm run compute:market-intelligence
 *
 * Requires env vars (service role key needed to write past RLS --
 * market_intelligence_snapshots has no authenticated-user write policy
 * at all, only service-role):
 *   VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Requires the market_intelligence_snapshots migration
 * (20260912000000_market_intelligence_snapshots.sql) to have been
 * reviewed and applied first -- this script will fail loudly (a clear
 * Postgres "relation does not exist" error, not a silent no-op) if run
 * before that migration lands.
 */
import { createClient } from '@supabase/supabase-js'
import { computeMarketIntelligenceSnapshots } from '../src/lib/opportunityEngine/marketIntelligence'
import { getErrorDetail } from './lib/errorDetail'
import type { ScrapedJob } from '../src/types'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

async function main() {
  // Active postings only -- a stale/closed role shouldn't shape today's
  // market signal. (Phase 8's is_active staleness detection will make
  // this filter more accurate over time; this script doesn't need to
  // know how is_active gets set, only to respect it.)
  const { data: jobs, error: jobsError } = await supabase.from('scraped_jobs').select('*').eq('is_active', true)

  if (jobsError) {
    console.error('Error fetching scraped jobs:', jobsError)
    process.exit(1)
  }

  const activeJobs = (jobs ?? []) as ScrapedJob[]
  console.log(`Computing market intelligence over ${activeJobs.length} active job(s)...`)

  const snapshots = computeMarketIntelligenceSnapshots(activeJobs)
  const computedAt = new Date().toISOString()

  const rowsToUpsert = snapshots.map((snapshot) => ({
    role_bucket: snapshot.roleBucket,
    location_bucket: snapshot.locationBucket,
    sample_size: snapshot.sampleSize,
    median_salary_min: snapshot.medianSalaryMin,
    median_salary_max: snapshot.medianSalaryMax,
    top_skills: snapshot.topSkills,
    computed_at: computedAt,
  }))

  console.log(`Computed ${rowsToUpsert.length} (role, location) bucket(s).`)

  if (rowsToUpsert.length === 0) {
    console.log('Nothing to upsert this run (no active jobs bucketed to a non-empty role/location).')
    return
  }

  try {
    const { error: upsertError } = await supabase
      .from('market_intelligence_snapshots')
      .upsert(rowsToUpsert, { onConflict: 'role_bucket,location_bucket' })

    if (upsertError) {
      console.error('Error upserting market intelligence snapshots:', upsertError)
      process.exit(1)
    }
  } catch (err) {
    console.error('Fatal error upserting market intelligence snapshots:', getErrorDetail(err))
    process.exit(1)
  }

  console.log(`Wrote ${rowsToUpsert.length} market intelligence snapshot(s).`)
}

main().catch((err) => {
  console.error('Fatal error running market intelligence computation:', getErrorDetail(err))
  process.exit(1)
})
