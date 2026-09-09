import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase as defaultClient } from '@/lib/supabase'

export interface TailoringContext {
  opportunityId: string
  jobTitle: string
  employer: string
  jobText: string
  sourceResumeVersionId: string
  sourceResumeTitle: string
  canonicalSkills: string[]
  includedResumeSkills: string[]
}

/**
 * Phase 6 completion — the one loader `ResumeTailorPage` needs: the
 * member-owned opportunity's job text (same `job_title` +
 * `full_job_description` join `FreshFitTargetRoleAlignmentProvider`
 * already reads, kept consistent rather than a second job-text
 * assembly), the member's active Master Resume to tailor FROM (locked:
 * tailoring always starts from the Master, never from an
 * already-tailored version, so a member always tailors against their
 * full canonical truth), and its currently-included skills for
 * `analyzeTailoringFit`.
 *
 * Returns a null context (never a fabricated placeholder) with an honest
 * `error` for: opportunity not found/not owned, or no Master Resume
 * exists yet to tailor from.
 */
export async function fetchTailoringContext(
  userId: string,
  opportunityId: string,
  client: SupabaseClient = defaultClient,
): Promise<{ context: TailoringContext | null; error: string | null }> {
  const { data: opportunity, error: oppError } = await client
    .from('opportunities')
    .select('id, job_title, employer, full_job_description')
    .eq('id', opportunityId)
    .eq('member_id', userId)
    .maybeSingle()

  if (oppError || !opportunity) {
    return { context: null, error: `Could not find this opportunity: ${oppError?.message ?? 'not found or not owned by you'}.` }
  }

  const { data: profile } = await client.from('member_profiles').select('skills').eq('user_id', userId).maybeSingle()

  const { data: master } = await client
    .from('resume_versions')
    .select('id, title')
    .eq('member_id', userId)
    .eq('is_master', true)
    .eq('is_archived', false)
    .maybeSingle()

  if (!master) {
    return { context: null, error: 'You need a Master Resume before you can tailor a version for this opportunity.' }
  }

  const { data: entries } = await client
    .from('resume_entries')
    .select('skill_value, included')
    .eq('resume_version_id', (master as { id: string }).id)
    .eq('entry_kind', 'skill')
    .eq('included', true)

  const oppRow = opportunity as { id: string; job_title: string; employer: string; full_job_description: string | null }
  const masterRow = master as { id: string; title: string }

  return {
    context: {
      opportunityId: oppRow.id,
      jobTitle: oppRow.job_title,
      employer: oppRow.employer,
      jobText: [oppRow.job_title, oppRow.full_job_description].filter(Boolean).join(' '),
      sourceResumeVersionId: masterRow.id,
      sourceResumeTitle: masterRow.title,
      canonicalSkills: ((profile as { skills: string[] } | null)?.skills) ?? [],
      includedResumeSkills: ((entries ?? []) as { skill_value: string }[]).map((e) => e.skill_value),
    },
    error: null,
  }
}
