/**
 * OE 2.0 Phase 11 -- Evaluation & Quality Metrics.
 *
 * Read-only report: does FreshFit's tier actually correlate with real
 * outcomes? No new table, no new PII -- joins three existing tables
 * (`job_matches` -> `opportunities` via `promoted_opportunity_id` ->
 * `applications` via `opportunity_id`) that are all already scoped by
 * existing RLS. This script runs with the service-role key (same as
 * every other script here) purely to read across all members at once
 * for an aggregate report; it writes nothing.
 *
 * A script, not an admin page, per the plan's own YAGNI call: "decide
 * UI vs. script based on how often you actually want to check it --
 * script is enough for v1."
 *
 * Usage:
 *   npm run report:freshfit-quality
 *
 * Requires env vars (service role key needed to read across all members):
 *   VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from '@supabase/supabase-js'
import { computeQualityMetrics, type MatchOutcomeInput } from '../src/lib/opportunityEngine/qualityMetrics'
import { FRESHFIT_TIER_LABELS } from '../src/lib/freshFitScore'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

function formatPercent(rate: number | null): string {
  return rate === null ? 'n/a' : `${(rate * 100).toFixed(1)}%`
}

async function main() {
  const [{ data: matchRows, error: matchesError }, { data: applicationRows, error: applicationsError }] =
    await Promise.all([
      supabase.from('job_matches').select('fresh_fit_score, promoted_opportunity_id'),
      supabase.from('applications').select('opportunity_id'),
    ])

  if (matchesError) {
    console.error('Error fetching job_matches:', matchesError)
    process.exit(1)
  }
  if (applicationsError) {
    console.error('Error fetching applications:', applicationsError)
    process.exit(1)
  }

  const matches: MatchOutcomeInput[] = (matchRows ?? []).map((row) => ({
    freshFitScore: row.fresh_fit_score as number,
    promotedOpportunityId: row.promoted_opportunity_id as string | null,
  }))
  const opportunityIdsWithApplications = new Set(
    (applicationRows ?? []).map((row) => row.opportunity_id as string)
  )

  const metrics = computeQualityMetrics(matches, opportunityIdsWithApplications)

  console.log('')
  console.log('=== FreshFit Quality Report (OE 2.0 Phase 11) ===')
  console.log(`Total scored matches on file: ${matches.length}`)
  console.log('')
  for (const tier of metrics) {
    console.log(`${FRESHFIT_TIER_LABELS[tier.tier]} (${tier.totalMatches} match(es))`)
    console.log(`  Promoted to Opportunity: ${tier.promotedCount} (${formatPercent(tier.promotionRate)})`)
    console.log(`  Promoted matches that led to an application: ${tier.appliedCount} (${formatPercent(tier.applicationRate)})`)
  }
  console.log('===================================================')
}

main().catch((err) => {
  console.error('Fatal error running FreshFit quality report:', err)
  process.exit(1)
})
