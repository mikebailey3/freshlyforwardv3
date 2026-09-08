import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase as defaultClient } from '@/lib/supabase'
import type { EducationEntry, CertificationEntry } from '@/types'

/**
 * Domain-neutral canonical-entry identity infrastructure (Resume
 * Intelligence Phase 3). Employment introduced this pattern first
 * (src/lib/forwardDna/employmentEntryIds.ts), but durable ids for
 * education/certification entries are a Profile concern, not a
 * Forward-DNA-specific one -- this is the one shared implementation both
 * domains use. `employmentEntryIds.ts` keeps its existing public API
 * unchanged and now delegates here internally, so no Forward DNA call
 * site needed to change.
 */

/**
 * Generates a short, unique-enough id for a jsonb array element. Not
 * cryptographic -- it only needs to be unique within one member's own
 * entry list -- so Date.now() plus a random suffix is sufficient and
 * avoids depending on crypto.randomUUID() being present in every runtime
 * this code runs in (browsers and test environments). Every id this
 * generates is opaque text; callers must never parse or rely on its
 * format, which is what keeps a future switch to a different generation
 * strategy (e.g. crypto.randomUUID()) non-breaking -- existing ids of
 * either shape are never regenerated or rewritten for cosmetic
 * consistency.
 */
function generateEntryId(): string {
  return `entry-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/** Pure: returns entries with every missing `id` filled in, and whether anything changed. Existing ids are never touched. */
export function ensureEntryIds<T extends { id?: string }>(entries: T[]): { entries: T[]; changed: boolean } {
  let changed = false
  const withIds = entries.map((entry) => {
    if (entry.id) return entry
    changed = true
    return { ...entry, id: generateEntryId() }
  })
  return { entries: withIds, changed }
}

/**
 * Backfills missing ids for one member_profiles jsonb array column and
 * persists them if anything changed. Idempotent -- safe to call on every
 * relevant page load, same convention as the employment backfill this
 * generalizes.
 */
export async function ensureEntryIdsForUser<T extends { id?: string }>(
  userId: string,
  profileColumn: 'employment_history' | 'education' | 'certifications',
  currentEntries: T[],
  client: SupabaseClient = defaultClient,
): Promise<{ entries: T[]; error: string | null }> {
  const { entries, changed } = ensureEntryIds(currentEntries)
  if (!changed) return { entries, error: null }

  const { error } = await client
    .from('member_profiles')
    .update({ [profileColumn]: entries })
    .eq('user_id', userId)

  return { entries, error: error?.message ?? null }
}

export function ensureEducationEntryIds(entries: EducationEntry[]): { entries: EducationEntry[]; changed: boolean } {
  return ensureEntryIds(entries)
}

export async function ensureEducationEntryIdsForUser(
  userId: string,
  education: EducationEntry[],
  client: SupabaseClient = defaultClient,
): Promise<{ entries: EducationEntry[]; error: string | null }> {
  return ensureEntryIdsForUser(userId, 'education', education, client)
}

export function ensureCertificationEntryIds(entries: CertificationEntry[]): { entries: CertificationEntry[]; changed: boolean } {
  return ensureEntryIds(entries)
}

export async function ensureCertificationEntryIdsForUser(
  userId: string,
  certifications: CertificationEntry[],
  client: SupabaseClient = defaultClient,
): Promise<{ entries: CertificationEntry[]; error: string | null }> {
  return ensureEntryIdsForUser(userId, 'certifications', certifications, client)
}
