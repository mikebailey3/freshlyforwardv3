// src/lib/forwardDna/responsibilities.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase as defaultClient } from '@/lib/supabase'
import type { CareerResponsibility } from '@/types/forwardDna'

export async function getAllResponsibilitiesForUser(
  userId: string,
  client: SupabaseClient = defaultClient
): Promise<{ responsibilities: CareerResponsibility[]; error: string | null }> {
  const { data, error } = await client.from('career_responsibilities').select('*').eq('user_id', userId)
  return { responsibilities: (data as CareerResponsibility[]) ?? [], error: error?.message ?? null }
}

export async function addResponsibility(
  userId: string,
  employmentEntryId: string,
  tag: string,
  category: string | null,
  client: SupabaseClient = defaultClient
): Promise<{ error: string | null }> {
  const { error } = await client
    .from('career_responsibilities')
    .insert({ user_id: userId, employment_entry_id: employmentEntryId, tag, category })
  return { error: error?.message ?? null }
}

export async function removeResponsibility(
  responsibilityId: string,
  client: SupabaseClient = defaultClient
): Promise<{ error: string | null }> {
  const { error } = await client.from('career_responsibilities').delete().eq('id', responsibilityId)
  return { error: error?.message ?? null }
}
