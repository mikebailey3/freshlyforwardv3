/**
 * Computes FreshFit scores for every (active member profile) x (active
 * scraped job) pair and upserts them into `job_matches`. Run this after
 * `scrapeIndeed.ts` populates new postings, or on a schedule.
 *
 * Usage:
 *   npm run sync:freshfit
 *
 * Requires env vars (service role key needed to write past RLS):
 *   VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from '@supabase/supabase-js'
import { computeFreshFitScore } from '../src/lib/freshFitScore'
import type { MemberProfile, ScrapedJob } from '../src/types'
import type { CareerSkill, CareerScope } from '../src/types/forwardDna'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

// Below this, a match is noise rather than signal -- skip storing it so
// job_matches doesn't balloon with irrelevant near-zero pairings.
const MIN_SCORE_TO_STORE = 35

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

  console.log(`Scoring ${members.length} member(s) against ${activeJobs.length} job(s)...`)

  const rows: Record<string, unknown>[] = []

  for (const member of members) {
    for (const job of activeJobs) {
      const result = computeFreshFitScore(member, job, {
        skills: skillsByUser.get(member.user_id) ?? [],
        scope: scopeByUser.get(member.user_id) ?? [],
      })
      if (result.score < MIN_SCORE_TO_STORE) continue

      rows.push({
        member_id: member.user_id,
        scraped_job_id: job.id,
        fresh_fit_score: result.score,
        matched_skills: result.matchedSkills,
        missing_skills: result.missingSkills,
        score_breakdown: result.breakdown,
        computed_at: new Date().toISOString(),
      })
    }
  }

  if (rows.length === 0) {
    console.log('No matches met the minimum score threshold. Nothing to write.')
    return
  }

  const { error: upsertError } = await supabase
    .from('job_matches')
    .upsert(rows, { onConflict: 'member_id,scraped_job_id' })

  if (upsertError) {
    console.error('Error upserting job matches:', upsertError)
    process.exit(1)
  }

  console.log(`Wrote ${rows.length} job match(es).`)
}

main().catch((err) => {
  console.error('Fatal error running FreshFit sync:', err)
  process.exit(1)
})
