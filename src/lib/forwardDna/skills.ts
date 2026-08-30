// src/lib/forwardDna/skills.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase as defaultClient } from '@/lib/supabase'
import type { CareerSkill, SkillState } from '@/types/forwardDna'

export async function getSkillStates(
  userId: string,
  client: SupabaseClient = defaultClient
): Promise<{ skills: CareerSkill[]; error: string | null }> {
  const { data, error } = await client.from('career_skills').select('*').eq('user_id', userId)
  return { skills: (data as CareerSkill[]) ?? [], error: error?.message ?? null }
}

export async function upsertSkillState(
  userId: string,
  skillName: string,
  state: SkillState,
  evidenceNote: string | null,
  client: SupabaseClient = defaultClient
): Promise<{ error: string | null }> {
  const { error } = await client
    .from('career_skills')
    .upsert(
      { user_id: userId, skill_name: skillName, state, evidence_note: evidenceNote },
      { onConflict: 'user_id,skill_name' }
    )
  return { error: error?.message ?? null }
}

/**
 * One-time-per-visit backfill: any skill in the flat member_profiles.skills
 * list that isn't already tracked here gets inserted as 'claimed'. Existing
 * rows (any state) are left untouched -- this never downgrades a skill a
 * member already marked demonstrated/supported.
 */
export async function syncSkillsFromProfile(
  userId: string,
  flatSkills: string[],
  client: SupabaseClient = defaultClient
): Promise<{ error: string | null }> {
  if (flatSkills.length === 0) return { error: null }

  const { skills: existing, error: readError } = await getSkillStates(userId, client)
  if (readError) return { error: readError }

  const existingNames = new Set(existing.map((s) => s.skill_name))
  const missing = flatSkills.filter((name) => !existingNames.has(name))
  if (missing.length === 0) return { error: null }

  const { error } = await client
    .from('career_skills')
    .upsert(
      missing.map((skill_name) => ({ user_id: userId, skill_name, state: 'claimed' as SkillState })),
      { onConflict: 'user_id,skill_name', ignoreDuplicates: true }
    )

  return { error: error?.message ?? null }
}
