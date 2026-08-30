import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase as defaultClient } from '@/lib/supabase'
import type { EmploymentEntry } from '@/types'

/**
 * Generates a short, unique-enough id for a jsonb array element. Not
 * cryptographic -- it only needs to be unique within one member's own
 * employment history -- so Date.now() plus a random suffix is
 * sufficient and avoids depending on crypto.randomUUID() being present
 * in every runtime this code runs in (browsers and test environments).
 */
function generateEntryId(): string {
  return `entry-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/** Pure: returns entries with every missing `id` filled in, and whether anything changed. */
export function ensureEmploymentEntryIds(
  entries: EmploymentEntry[]
): { entries: EmploymentEntry[]; changed: boolean } {
  let changed = false
  const withIds = entries.map((entry) => {
    if (entry.id) return entry
    changed = true
    return { ...entry, id: generateEntryId() }
  })
  return { entries: withIds, changed }
}

/**
 * Backfills missing employment-entry ids for a user's employment_history
 * and persists them if anything changed. Idempotent -- safe to call on
 * every Forward DNA page load.
 */
export async function ensureEmploymentEntryIdsForUser(
  userId: string,
  employmentHistory: EmploymentEntry[],
  client: SupabaseClient = defaultClient
): Promise<{ entries: EmploymentEntry[]; error: string | null }> {
  const { entries, changed } = ensureEmploymentEntryIds(employmentHistory)
  if (!changed) return { entries, error: null }

  const { error } = await client
    .from('member_profiles')
    .update({ employment_history: entries })
    .eq('user_id', userId)

  return { entries, error: error?.message ?? null }
}
