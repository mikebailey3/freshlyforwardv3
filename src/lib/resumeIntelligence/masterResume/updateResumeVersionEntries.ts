import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase as defaultClient } from '@/lib/supabase'
import { validateEntries, entryInputToRow } from './resumeEntryValidation'
import type { MasterResumeEntryInput, MemberProfileArrays } from './resumeEntryValidation'

export interface UpdateResumeVersionEntriesResult {
  errors: string[]
}

/**
 * Phase 5 completion — the general-purpose sibling of
 * `updateMasterResumeEntries.ts`: replaces the full entry selection for
 * ANY of the member's own, non-archived resume versions, Master or
 * derived. Reuses the exact same `validateEntries` non-fabrication
 * boundary (an entry that no longer resolves against the member's
 * current canonical Profile is reported and skipped, never written) --
 * the only difference from the Master-only function is which RPC it
 * calls and that it does not require `is_master = true`.
 *
 * `updateMasterResumeEntries.ts` is left completely unchanged and keeps
 * its Master-only guarantee for the existing Phase 4 workflow (DRY
 * concern deliberately accepted: duplicating this thin wrapper is
 * cheaper and lower-risk than adding an `allowNonMaster` flag to an
 * already-shipped, already-tested function whose whole point was "this
 * one refuses non-Master").
 */
export async function updateResumeVersionEntries(
  userId: string,
  resumeVersionId: string,
  entries: MasterResumeEntryInput[],
  client: SupabaseClient = defaultClient,
): Promise<UpdateResumeVersionEntriesResult> {
  const { data: version } = await client
    .from('resume_versions')
    .select('id')
    .eq('id', resumeVersionId)
    .eq('member_id', userId)
    .eq('is_archived', false)
    .maybeSingle()

  if (!version) {
    return { errors: [`Resume version '${resumeVersionId}' not found for this member, or it is archived -- refusing to write its entries.`] }
  }

  const { data: profile } = await client
    .from('member_profiles')
    .select('employment_history, education, certifications, skills')
    .eq('user_id', userId)
    .maybeSingle()

  const { validEntries, errors } = validateEntries(entries, profile as MemberProfileArrays | null)

  const rows = validEntries.map((entry) => entryInputToRow(resumeVersionId, entry))
  const { error: rpcError } = await client.rpc('replace_resume_version_entries', {
    p_resume_version_id: resumeVersionId,
    p_entries: rows,
  })
  if (rpcError) errors.push(rpcError.message)

  return { errors }
}
