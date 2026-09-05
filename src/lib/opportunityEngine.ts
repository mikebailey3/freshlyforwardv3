import { supabase } from '@/lib/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createOpportunity } from '@/lib/operations'
import { computeFreshFitScore, toScoreBreakdownPayload, FRESHFIT_TIER_LABELS } from '@/lib/freshFitScore'
import { getSkillStates } from '@/lib/forwardDna/skills'
import { getAllScopeForUser } from '@/lib/forwardDna/scope'
import type { JobMatchWithJob, JobMatchScoreBreakdown, MemberProfile, ScrapedJob } from '@/types'
import type { JobSubmissionInput } from '@/lib/jobSubmission'

const ENGINE_VERSION = 2

// ============================================================
// JOB MATCHES (read-side; scores are computed by scripts/syncFreshFitScores.ts)
// ============================================================

export async function getJobMatches(memberId: string): Promise<JobMatchWithJob[]> {
  const { data, error } = await supabase
    .from('job_matches')
    .select('*, scraped_job:scraped_jobs(*)')
    .eq('member_id', memberId)
    .is('dismissed_at', null)
    .order('fresh_fit_score', { ascending: false })

  if (error) {
    console.error('Error fetching job matches:', error)
    return []
  }

  return (data ?? []) as unknown as JobMatchWithJob[]
}

export async function dismissJobMatch(matchId: string): Promise<void> {
  const { error } = await supabase
    .from('job_matches')
    .update({ dismissed_at: new Date().toISOString() })
    .eq('id', matchId)

  if (error) console.error('Error dismissing job match:', error)
}

/**
 * Pure text-builder for the promoted Opportunity's why_it_matches field.
 * Extracted so Forward-DNA-aware copy is unit-testable without mocking
 * Supabase or createOpportunity. Backward compatible: a `score_breakdown`
 * without a `v2` key (any match scored by the pre-2.0 engine) gets the
 * exact same legacy copy as before; only v2-scored matches (which always
 * carry `breakdown.v2`, see toScoreBreakdownPayload) get the richer text.
 */
export function buildWhyItMatches(match: JobMatchWithJob): string {
  const breakdown = match.score_breakdown as JobMatchScoreBreakdown
  const skillsNote = `Matched skills: ${match.matched_skills.join(', ') || 'none detected'}.`

  if (breakdown?.v2) {
    const { v2 } = breakdown
    const gapCount = v2.dimensions.reduce((sum, d) => sum + d.gaps.length, 0)
    const gapsNote = gapCount > 0 ? ` ${gapCount} confirmed gap(s).` : ''
    const unknownsNote = v2.unknowns.length > 0 ? ` ${v2.unknowns.length} area(s) unclear given your current profile.` : ''
    return `FreshFit score ${match.fresh_fit_score}/100 (${FRESHFIT_TIER_LABELS[v2.tier]}). ${v2.recommendation.headline}. ${skillsNote}${gapsNote}${unknownsNote}`
  }

  if (!breakdown?.dnaSkillEvidence) {
    return `FreshFit score ${match.fresh_fit_score}/100. ${skillsNote}`
  }
  const strength = breakdown.dnaSkillEvidence >= 10 ? 'strong' : 'partial'
  return `FreshFit score ${match.fresh_fit_score}/100. ${skillsNote} Forward DNA evidence backs ${strength} fit on these skills.`
}

/**
 * Lets a member submit their own job lead (manual entry only -- no
 * server-side URL fetching, see supabase/migrations/20260901000000)
 * directly into the Opportunity Engine pipeline. Scores it with the same
 * computeFreshFitScore used by the scheduled sync script.
 */
export async function submitMemberJob(
  profile: MemberProfile,
  input: JobSubmissionInput,
  client: SupabaseClient = supabase
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
  const [{ skills }, { scope }, compassResult] = await Promise.all([
    getSkillStates(profile.user_id, client),
    getAllScopeForUser(profile.user_id, client),
    client
      .from('career_compass_results')
      .select('readiness_scores')
      .eq('user_id', profile.user_id)
      .eq('is_current', true)
      .maybeSingle(),
  ])
  const careerDirectionScore =
    (compassResult.data as { readiness_scores?: { careerDirection?: number | null } } | null)?.readiness_scores
      ?.careerDirection ?? null
  const result = computeFreshFitScore(profile, job, { skills, scope }, careerDirectionScore)

  const { data: matchRow, error: matchError } = await client
    .from('job_matches')
    .insert({
      member_id: profile.user_id,
      scraped_job_id: job.id,
      fresh_fit_score: result.score,
      matched_skills: result.matchedSkills,
      missing_skills: result.missingSkills,
      score_breakdown: toScoreBreakdownPayload(result),
      engine_version: ENGINE_VERSION,
    })
    .select()
    .single()

  if (matchError || !matchRow) {
    return { match: null, error: matchError?.message ?? 'Job saved, but scoring it failed.' }
  }

  return { match: { ...matchRow, scraped_job: job } as JobMatchWithJob, error: null }
}

/**
 * Promotes a scraped-job match into the real, member-visible `opportunities`
 * pipeline (strategist-only action, matches existing RLS on `opportunities`).
 * Marks the match as promoted so it drops out of the "pending review" queue.
 */
export async function promoteMatchToOpportunity(
  match: JobMatchWithJob,
  strategistId: string,
): Promise<string | null> {
  const job = match.scraped_job
  const opportunity = await createOpportunity({
    member_id: match.member_id,
    strategist_id: strategistId,
    employer: job.company,
    job_title: job.title,
    location: job.location,
    salary_text: job.salary_text,
    employment_type: job.employment_type,
    posting_url: job.posting_url,
    posting_date: job.posted_at,
    source: `Opportunity Engine (${job.source})`,
    full_job_description: job.description,
    why_it_matches: buildWhyItMatches(match),
    status: 'needs_review',
  })

  if (!opportunity) return null

  const { error } = await supabase
    .from('job_matches')
    .update({ promoted_opportunity_id: opportunity.id })
    .eq('id', match.id)

  if (error) console.error('Error marking match as promoted:', error)

  return opportunity.id
}

// ============================================================
// STRATEGIST: matches across all assigned members
// ============================================================

export async function getJobMatchesForStrategist(memberIds: string[]): Promise<JobMatchWithJob[]> {
  if (memberIds.length === 0) return []

  const { data, error } = await supabase
    .from('job_matches')
    .select('*, scraped_job:scraped_jobs(*)')
    .in('member_id', memberIds)
    .is('dismissed_at', null)
    .is('promoted_opportunity_id', null)
    .order('fresh_fit_score', { ascending: false })

  if (error) {
    console.error('Error fetching strategist job matches:', error)
    return []
  }

  return (data ?? []) as unknown as JobMatchWithJob[]
}

export async function getActiveScrapedJobsCount(): Promise<number> {
  const { count, error } = await supabase
    .from('scraped_jobs')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true)

  if (error) {
    console.error('Error counting scraped jobs:', error)
    return 0
  }

  return count ?? 0
}

export type { ScrapedJob }
