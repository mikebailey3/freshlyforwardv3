import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase as defaultClient } from '@/lib/supabase'
import { ensureEntryIds, ensureEntryIdsForUser } from '@/lib/profile/entryIds'
import type { EmploymentEntry } from '@/types'

/**
 * Thin, API-preserving shim. The actual id-generation/backfill logic is
 * shared, domain-neutral infrastructure (src/lib/profile/entryIds.ts,
 * Resume Intelligence Phase 3) -- education and certification entries use
 * the identical implementation. This file keeps its existing public
 * function names/signatures unchanged so the one real call site
 * (src/pages/ForwardDnaPage.tsx) and this file's own existing test suite
 * needed no changes.
 */

/** Pure: returns entries with every missing `id` filled in, and whether anything changed. */
export function ensureEmploymentEntryIds(
  entries: EmploymentEntry[]
): { entries: EmploymentEntry[]; changed: boolean } {
  return ensureEntryIds(entries)
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
  return ensureEntryIdsForUser(userId, 'employment_history', employmentHistory, client)
}
