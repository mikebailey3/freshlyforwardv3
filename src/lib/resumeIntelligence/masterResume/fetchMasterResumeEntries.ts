import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase as defaultClient } from '@/lib/supabase'
import type { MasterResumeEntryInput } from './resumeEntryValidation'

interface ResumeEntryRow {
  entry_kind: MasterResumeEntryInput['entryKind']
  canonical_entry_id: string | null
  skill_value: string | null
  included: boolean
  sort_order: number | null
  override_description: string | null
}

/**
 * The read side of `updateMasterResumeEntries`'s write shape -- lets the
 * Master Resume builder UI pre-fill checkboxes/overrides from what a
 * member already saved, rather than resetting to "everything selected"
 * every time they revisit an existing Master.
 */
export async function fetchMasterResumeEntries(
  resumeVersionId: string,
  client: SupabaseClient = defaultClient,
): Promise<MasterResumeEntryInput[]> {
  const { data } = await client
    .from('resume_entries')
    .select('entry_kind, canonical_entry_id, skill_value, included, sort_order, override_description')
    .eq('resume_version_id', resumeVersionId)
    .order('sort_order', { ascending: true })

  return ((data ?? []) as ResumeEntryRow[]).map((row) => ({
    entryKind: row.entry_kind,
    canonicalEntryId: row.canonical_entry_id ?? undefined,
    skillValue: row.skill_value ?? undefined,
    included: row.included,
    sortOrder: row.sort_order,
    overrideDescription: row.override_description,
  }))
}
