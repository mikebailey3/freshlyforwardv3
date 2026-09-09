import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase as defaultClient } from '@/lib/supabase'

export interface DuplicateResumeVersionResult {
  newResumeVersionId: string | null
  error: string | null
}

/**
 * Phase 5 (5.9) — copies one resume version's title/entries into a brand
 * new, non-Master version. NEVER touches the source row -- "duplicate"
 * always creates a new row, "the Master is never overwritten by creating
 * a variant" (locked). The new version starts with `is_master = false`
 * regardless of whether the source was the Master; promoting it is a
 * separate, explicit action via the existing `promoteResumeVersionToMaster`.
 */
export async function duplicateResumeVersion(
  userId: string,
  sourceResumeVersionId: string,
  newTitle: string,
  client: SupabaseClient = defaultClient,
): Promise<DuplicateResumeVersionResult> {
  const { data: source } = await client
    .from('resume_versions')
    .select('id, template_key, section_order, summary_override')
    .eq('id', sourceResumeVersionId)
    .eq('member_id', userId)
    .eq('is_archived', false)
    .maybeSingle()

  if (!source) {
    return { newResumeVersionId: null, error: `Resume version '${sourceResumeVersionId}' not found for this member -- refusing to duplicate.` }
  }

  const { data: entries } = await client
    .from('resume_entries')
    .select('entry_kind, canonical_entry_id, skill_value, included, sort_order, override_description')
    .eq('resume_version_id', sourceResumeVersionId)

  const { data: newVersion, error: insertError } = await client
    .from('resume_versions')
    .insert({
      member_id: userId,
      title: newTitle,
      is_master: false,
      template_key: (source as { template_key: string }).template_key,
      section_order: (source as { section_order: unknown }).section_order,
      summary_override: (source as { summary_override: string | null }).summary_override,
      derived_from_resume_version_id: sourceResumeVersionId,
    })
    .select('id')
    .single()

  if (insertError || !newVersion) return { newResumeVersionId: null, error: insertError?.message ?? 'Could not create the duplicated version.' }

  const newId = (newVersion as { id: string }).id
  const rows = ((entries ?? []) as Record<string, unknown>[]).map((row) => ({ ...row, resume_version_id: newId }))
  if (rows.length > 0) {
    const { error: entriesError } = await client.from('resume_entries').insert(rows)
    if (entriesError) return { newResumeVersionId: newId, error: entriesError.message }
  }

  return { newResumeVersionId: newId, error: null }
}
