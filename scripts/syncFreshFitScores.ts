/**
 * Computes FreshFit 2.0 scores for every (active member profile) x
 * (active scraped job) pair and upserts them into `job_matches`. Run
 * this after `scrapeIndeed.ts` populates new postings, or on a schedule.
 *
 * v2 persistence policy (see src/lib/freshFitScore/jobMatchPersistence.ts
 * for the pure, unit-tested logic this script calls):
 *   - Score every active member x active job pair -- no early cutoff.
 *   - Persist a member's Top N matches above a low noise floor,
 *     regardless of the old MIN_SCORE_TO_STORE=35 cutoff.
 *   - Re-rank fresh on every run (rank is never stored, only the score).
 *   - Prune only this engine's untouched rows that fell out of the Top N
 *     -- dismissed/promoted rows and legacy engine_version=1 rows are
 *     never pruned by this script.
 *
 * Usage:
 *   npm run sync:freshfit
 *
 * Requires env vars (service role key needed to write past RLS):
 *   VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from '@supabase/supabase-js'
import { computeFreshFitScore, toScoreBreakdownPayload, selectMatchesToPersist, selectStaleMatchesToPrune } from '../src/lib/freshFitScore'
import type { ScoredCandidate, ExistingMatchRow } from '../src/lib/freshFitScore'
import { summarizeRun, type AttemptResult } from './lib/runSummary'
import { getErrorDetail } from './lib/errorDetail'
import type { MemberProfile, ScrapedJob } from '../src/types'
import type { CareerSkill, CareerScope } from '../src/types/forwardDna'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
const ENGINE_VERSION = 2

function groupBy<T, K>(rows: T[], keyOf: (row: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>()
  for (const row of rows) {
    map.set(keyOf(row), [...(map.get(keyOf(row)) ?? []), row])
  }
  return map
}

async function main() {
  const { data: profiles, error: profileError } = await supabase
    .from('member_profiles')
    .select('*')
    .eq('account_status', 'active')

  if (profileError) {
    console.error('Error fetching member profiles:', profileError)
    process.exit(1)
  }

  const { data: jobs, error: jobsError } = await supabase
    .from('scraped_jobs')
    .select('*')
    .eq('is_active', true)

  if (jobsError) {
    console.error('Error fetching scraped jobs:', jobsError)
    process.exit(1)
  }

  const members = (profiles ?? []) as MemberProfile[]
  const activeJobs = (jobs ?? []) as ScrapedJob[]

  const [{ data: skillRows }, { data: scopeRows }, { data: compassRows }, { data: existingMatchRows }] = await Promise.all([
    supabase.from('career_skills').select('*'),
    supabase.from('career_scope').select('*'),
    supabase.from('career_compass_results').select('user_id, readiness_scores').eq('is_current', true),
    supabase.from('job_matches').select('id, member_id, scraped_job_id, engine_version, dismissed_at, promoted_opportunity_id'),
  ])

  const skillsByUser = groupBy((skillRows ?? []) as CareerSkill[], (row) => row.user_id)
  const scopeByUser = groupBy((scopeRows ?? []) as CareerScope[], (row) => row.user_id)
  const existingByMember = groupBy(
    (existingMatchRows ?? []) as Array<{
      id: string; member_id: string; scraped_job_id: string; engine_version: number
      dismissed_at: string | null; promoted_opportunity_id: string | null
    }>,
    (row) => row.member_id
  )

  const careerDirectionByUser = new Map<string, number | null>()
  for (const row of (compassRows ?? []) as Array<{ user_id: string; readiness_scores: { careerDirection?: number | null } | null }>) {
    careerDirectionByUser.set(row.user_id, row.readiness_scores?.careerDirection ?? null)
  }

  console.log(`Scoring ${members.length} member(s) against ${activeJobs.length} job(s)...`)

  // One entry per (member, job) pair attempted -- so a single malformed
  // profile or job row can't silently abort scoring for everyone else,
  // and the run's final report can distinguish "a few pairs failed" from
  // "nothing could be scored at all".
  const results: AttemptResult[] = []
  const rowsToUpsert: Record<string, unknown>[] = []
  const rowIdsToPrune: string[] = []
  const computedAt = new Date().toISOString()

  for (const member of members) {
    const candidates: ScoredCandidate[] = []
    const resultByJobId = new Map<string, ReturnType<typeof computeFreshFitScore>>()

    for (const job of activeJobs) {
      const label = `member ${member.user_id} x job ${job.id}`
      try {
        const result = computeFreshFitScore(
          member,
          job,
          { skills: skillsByUser.get(member.user_id) ?? [], scope: scopeByUser.get(member.user_id) ?? [] },
          careerDirectionByUser.get(member.user_id) ?? null
        )
        results.push({ label, status: 'success' })
        candidates.push({ scrapedJobId: job.id, score: result.score })
        resultByJobId.set(job.id, result)
      } catch (err) {
        const detail = getErrorDetail(err)
        console.error(`Failed scoring ${label}: ${detail}`)
        results.push({ label, status: 'failure', detail })
      }
    }

    const keepJobIds = selectMatchesToPersist(candidates)
    for (const jobId of keepJobIds) {
      const result = resultByJobId.get(jobId)
      if (!result) continue
      rowsToUpsert.push({
        member_id: member.user_id,
        scraped_job_id: jobId,
        fresh_fit_score: result.score,
        matched_skills: result.matchedSkills,
        missing_skills: result.missingSkills,
        score_breakdown: toScoreBreakdownPayload(result),
        engine_version: ENGINE_VERSION,
        computed_at: computedAt,
      })
    }

    const existingRows: ExistingMatchRow[] = (existingByMember.get(member.user_id) ?? []).map((row) => ({
      id: row.id,
      scrapedJobId: row.scraped_job_id,
      engineVersion: row.engine_version,
      dismissedAt: row.dismissed_at,
      promotedOpportunityId: row.promoted_opportunity_id,
    }))
    rowIdsToPrune.push(...selectStaleMatchesToPrune(existingRows, keepJobIds))
  }

  const summary = summarizeRun(results)
  console.log('')
  console.log('=== Job Discovery: FreshFit 2.0 Scoring Summary ===')
  console.log(`Pairs attempted: ${summary.total} (succeeded: ${summary.succeeded}, failed: ${summary.failed})`)
  console.log(`Matches to persist this run (Top N per member, above the noise floor): ${rowsToUpsert.length}`)
  console.log(`Stale matches to prune (untouched v2 rows that fell out of the Top N): ${rowIdsToPrune.length}`)
  console.log(`Status: ${summary.status.toUpperCase()}`)
  console.log('====================================================')

  if (summary.status === 'failed') {
    console.error('Every scoring attempt failed -- nothing could be scored this run.')
    process.exit(1)
  }
  // 'empty' just means there were no active members and/or no active jobs
  // to pair up yet -- a legitimate state (e.g. before the first signup or
  // between scrape cycles), not a pipeline failure, so it is reported but
  // does not fail the run.
  if (summary.status === 'empty') {
    console.log('No (member, job) pairs to score this run (no active members and/or no active jobs yet).')
  }

  if (rowsToUpsert.length > 0) {
    const { error: upsertError } = await supabase
      .from('job_matches')
      .upsert(rowsToUpsert, { onConflict: 'member_id,scraped_job_id' })

    if (upsertError) {
      console.error('Error upserting job matches:', upsertError)
      process.exit(1)
    }
    console.log(`Wrote ${rowsToUpsert.length} job match(es).`)
  } else {
    console.log('No matches to persist this run.')
  }

  if (rowIdsToPrune.length > 0) {
    const { error: pruneError } = await supabase.from('job_matches').delete().in('id', rowIdsToPrune)
    if (pruneError) {
      console.error('Error pruning stale job matches:', pruneError)
      process.exit(1)
    }
    console.log(`Pruned ${rowIdsToPrune.length} stale job match(es).`)
  }
}

main().catch((err) => {
  console.error('Fatal error running FreshFit sync:', err)
  process.exit(1)
})
