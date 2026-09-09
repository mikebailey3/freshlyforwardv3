import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase as defaultClient } from '@/lib/supabase'
import { validateEntries, entryInputToRow } from './resumeEntryValidation'
import type { MasterResumeEntryInput, MemberProfileArrays } from './resumeEntryValidation'

export type { MasterResumeEntryInput } from './resumeEntryValidation'

export interface CreateMasterResumeOptions {
  title: string
  sourceDocumentId?: string | null
  entries: MasterResumeEntryInput[]
}

export interface CreateMasterResumeResult {
  resumeVersionId: string | null
  errors: string[]
}

/**
 * Creates the member's first Master Resume. Deliberately does NOT handle
 * the "a Master already exists" case by replacing it -- per the Phase 3
 * refinement, that must be an explicit, separate action (updating the
 * existing Master's entries, or swapping which resume_version is Master
 * via the already-authored set_master_resume_version RPC), never a
 * silent overwrite. Call sites must check the returned error and route
 * to that explicit flow instead of retrying this function.
 *
 * `resume_entries.canonical_entry_id`/`skill_value` cannot be a foreign
 * key (Postgres cannot reference an element of a jsonb array) -- this is
 * the actual enforcement boundary the migration's design notes describe:
 * every requested entry selection is checked against the member's
 * current member_profiles arrays before a resume_entries row is
 * inserted for it. An entry that doesn't resolve is reported as an
 * error and skipped, never silently dropped or fabricated -- so this
 * can partially succeed (the resume version and its valid entries are
 * still created) while still surfacing what didn't resolve.
 */
export async function createMasterResume(
  userId: string,
  options: CreateMasterResumeOptions,
  client: SupabaseClient = defaultClient,
): Promise<CreateMasterResumeResult> {
  const { data: existingMaster } = await client
    .from('resume_versions')
    .select('id')
    .eq('member_id', userId)
    .eq('is_master', true)
    .eq('is_archived', false)
    .maybeSingle()

  if (existingMaster) {
    return {
      resumeVersionId: null,
      errors: [
        `An active Master Resume already exists (id ${(existingMaster as { id: string }).id}). ` +
          'createMasterResume() only creates a first Master -- update the existing Master\'s entries, ' +
          'or explicitly swap which version is Master, rather than silently replacing it.',
      ],
    }
  }

  const { data: profile } = await client
    .from('member_profiles')
    .select('employment_history, education, certifications, skills')
    .eq('user_id', userId)
    .maybeSingle()

  const { validEntries, errors } = validateEntries(options.entries, profile as MemberProfileArrays | null)

  const { data: version, error: versionError } = await client
    .from('resume_versions')
    .insert({
      member_id: userId,
      title: options.title,
      is_master: true,
      source_document_id: options.sourceDocumentId ?? null,
    })
    .select('id')
    .single()

  if (versionError || !version) {
    return { resumeVersionId: null, errors: [...errors, versionError?.message ?? 'failed to create resume version'] }
  }

  const resumeVersionId = (version as { id: string }).id

  if (validEntries.length > 0) {
    const rows = validEntries.map((entry) => entryInputToRow(resumeVersionId, entry))

    const { error: entriesError } = await client.from('resume_entries').insert(rows)
    if (entriesError) errors.push(entriesError.message)
  }

  return { resumeVersionId, errors }
}
