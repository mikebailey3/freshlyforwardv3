import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase as defaultClient } from '@/lib/supabase'

export interface ArchiveResumeVersionResult {
  error: string | null
}

/**
 * Phase 5 (5.9) — archives a non-Master resume version (sets
 * `is_archived = true`). Refuses outright on the active Master -- archiving
 * the Master is never a silent side effect of a "clean up my versions"
 * action; a member who genuinely wants to retire their Master must first
 * promote a replacement via `promoteResumeVersionToMaster`, which is the
 * one action already designed (Phase 3/4) to make the swap atomic and
 * intentional. Ownership-checked the same way as every other write here.
 */
export async function archiveResumeVersion(
  userId: string,
  resumeVersionId: string,
  client: SupabaseClient = defaultClient,
): Promise<ArchiveResumeVersionResult> {
  const { data: version } = await client
    .from('resume_versions')
    .select('id, is_master')
    .eq('id', resumeVersionId)
    .eq('member_id', userId)
    .eq('is_archived', false)
    .maybeSingle()

  if (!version) {
    return { error: `Resume version '${resumeVersionId}' not found for this member -- refusing to archive.` }
  }
  if ((version as { is_master: boolean }).is_master) {
    return { error: 'Cannot archive the active Master Resume directly -- promote a replacement version to Master first.' }
  }

  const { error } = await client.from('resume_versions').update({ is_archived: true }).eq('id', resumeVersionId)
  return { error: error?.message ?? null }
}
