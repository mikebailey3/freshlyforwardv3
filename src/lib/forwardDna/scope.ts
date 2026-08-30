// src/lib/forwardDna/scope.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase as defaultClient } from '@/lib/supabase'
import type { CareerScope } from '@/types/forwardDna'

export async function getAllScopeForUser(
  userId: string,
  client: SupabaseClient = defaultClient
): Promise<{ scope: CareerScope[]; error: string | null }> {
  const { data, error } = await client.from('career_scope').select('*').eq('user_id', userId)
  return { scope: (data as CareerScope[]) ?? [], error: error?.message ?? null }
}

export type CareerScopeUpdate = Partial<
  Pick<CareerScope, 'revenue_managed_cents' | 'team_size' | 'budget_managed_cents' | 'direct_reports' | 'notes'>
>

export async function upsertScope(
  userId: string,
  employmentEntryId: string,
  updates: CareerScopeUpdate,
  client: SupabaseClient = defaultClient
): Promise<{ error: string | null }> {
  const { error } = await client
    .from('career_scope')
    .upsert(
      { user_id: userId, employment_entry_id: employmentEntryId, ...updates },
      { onConflict: 'user_id,employment_entry_id' }
    )
  return { error: error?.message ?? null }
}

/** Converts a dollar-amount input string to integer cents. Empty/invalid input -> null. */
export function dollarsToCents(value: string): number | null {
  if (!value) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null
}

/** Converts integer cents back to a plain dollar-amount string for an input field. */
export function centsToDollars(cents: number | null): string {
  return cents == null ? '' : (cents / 100).toString()
}
