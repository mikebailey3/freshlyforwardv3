import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase as defaultClient } from '@/lib/supabase'
import { validateEntries, entryInputToRow } from './resumeEntryValidation'
import type { MasterResumeEntryInput, MemberProfileArrays } from './resumeEntryValidation'

export interface UpdateMasterResumeEntriesResult {
  errors: string[]
}

/**
 * Phase 4 punch-list item #2: "update an existing Master's entries" --
 * deliberately never built in Phase 3, where `createMasterResume()`
 * refuses outright once a Master exists rather than silently replacing
 * it (see that module's doc comment).
 *
 * This is the explicit, separate action that comment pointed at: given a
 * member's already-existing active Master resume version, replace its
 * full `resume_entries` selection with a newly validated set (which
 * inclusion flags, sort order, and override text a member chose on this
 * pass through the Master Resume builder). Delete-then-insert, not a
 * diff/patch -- the caller always submits the complete desired set for
 * the version (same convention as `createMasterResume`'s insert), so
 * there is no separate add/remove/reorder API surface to keep in sync.
 *
 * Reuses `validateEntries` from `resumeEntryValidation.ts` -- the exact
 * same non-fabrication enforcement boundary as `createMasterResume`:  an
 * entry selection that no longer resolves against the member's current
 * Profile (e.g. it was edited/removed there since this Master was last
 * saved) is reported as an error and skipped, never silently written.
 */
export async function updateMasterResumeEntries(
  userId: string,
  resumeVersionId: string,
  entries: MasterResumeEntryInput[],
  client: SupabaseClient = defaultClient,
): Promise<UpdateMasterResumeEntriesResult> {
  const { data: master } = await client
    .from('resume_versions')
    .select('id')
    .eq('id', resumeVersionId)
    .eq('member_id', userId)
    .eq('is_master', true)
    .eq('is_archived', false)
    .maybeSingle()

  if (!master) {
    return { errors: [`Active Master Resume '${resumeVersionId}' not found for this member -- refusing to write its entries.`] }
  }

  const { data: profile } = await client
    .from('member_profiles')
    .select('employment_history, education, certifications, skills')
    .eq('user_id', userId)
    .maybeSingle()

  const { validEntries, errors } = validateEntries(entries, profile as MemberProfileArrays | null)

  const { error: deleteError } = await client.from('resume_entries').delete().eq('resume_version_id', resumeVersionId)
  if (deleteError) return { errors: [...errors, deleteError.message] }

  if (validEntries.length > 0) {
    const rows = validEntries.map((entry) => entryInputToRow(resumeVersionId, entry))
    const { error: insertError } = await client.from('resume_entries').insert(rows)
    if (insertError) errors.push(insertError.message)
  }

  return { errors }
}
