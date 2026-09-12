import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase as defaultClient } from '@/lib/supabase'

interface ResumeSkillEntryRow {
  skill_value: string | null
}

/**
 * De-dupes and normalizes raw `resume_entries` (kind='skill') rows into
 * a flat skill-value list. Pure and independently testable, mirroring
 * `memberOpportunityProfile.ts::extractConfirmedCapabilitySkills` --
 * shared by both the single-member fetch below and
 * `scripts/syncFreshFitScores.ts`'s bulk-fetch path, so there is exactly
 * one place that decides "how do raw resume_entries rows become a skill
 * list."
 */
export function extractResumeSkillValues(rows: ResumeSkillEntryRow[] | null | undefined): string[] {
  if (!rows) return []
  return [...new Set(rows.map((row) => row.skill_value).filter((v): v is string => Boolean(v)))]
}

/**
 * The member's current Master Resume's claimed skills (OE 2.0 Phase 5)
 * -- a read-only cross-reference into FreshFit's skillsEvidence
 * dimension (see `skillMatching.ts`'s `isGroundedInResume`/
 * `groundedByResume`). Every resume skill entry is validated against
 * `member_profiles.skills` at creation time (`createMasterResume.ts`),
 * so this can never introduce an unconfirmed/fabricated skill claim --
 * it only reports which of the member's already-known skills they chose
 * to put on their current resume.
 *
 * Returns an empty array (never throws) when the member has no active
 * Master Resume yet, or their Master has no included skill entries --
 * "no resume" is exactly as valid an input as "no Career Vault
 * evidence" elsewhere in this scoring path.
 */
export async function getMasterResumeSkills(
  userId: string,
  client: SupabaseClient = defaultClient,
): Promise<string[]> {
  const { data: master } = await client
    .from('resume_versions')
    .select('id')
    .eq('member_id', userId)
    .eq('is_master', true)
    .eq('is_archived', false)
    .maybeSingle()

  if (!master) return []

  const { data: entries } = await client
    .from('resume_entries')
    .select('skill_value')
    .eq('resume_version_id', (master as { id: string }).id)
    .eq('entry_kind', 'skill')
    .eq('included', true)

  return extractResumeSkillValues(entries as ResumeSkillEntryRow[] | null)
}
