import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase as defaultClient } from '@/lib/supabase'

export interface SetMasterResumeSummaryOverrideResult {
  error: string | null
}

/**
 * Phase 4 punch-list item #5: "resume-specific overrides beyond an
 * employment description have no persistence layer." `summary_override`
 * is the one this phase adds -- a single nullable column on the existing
 * `resume_versions` row (added in this migration's Phase 4 revision),
 * never a second/competing store for the summary text itself. The
 * canonical `member_profiles.summary` is completely untouched by this
 * write; `analyzeMasterResume` prefers this override when present and
 * falls back to the canonical summary otherwise.
 *
 * Deliberately scoped to the Master Resume only, matching this phase's
 * boundary (no tailored-version UI exists yet) -- targets whichever
 * resume_versions row is the caller's current active Master rather than
 * taking a resumeVersionId parameter that nothing yet supplies.
 *
 * Education/certification entries still have no free-text field to
 * override (documented, unchanged limitation) -- only summary_override
 * is added here.
 */
export async function setMasterResumeSummaryOverride(
  userId: string,
  overrideText: string | null,
  client: SupabaseClient = defaultClient,
): Promise<SetMasterResumeSummaryOverrideResult> {
  const { data: master } = await client
    .from('resume_versions')
    .select('id')
    .eq('member_id', userId)
    .eq('is_master', true)
    .eq('is_archived', false)
    .maybeSingle()

  if (!master) {
    return { error: 'No active Master Resume exists yet for this member -- create one before setting a summary override.' }
  }

  const { error } = await client
    .from('resume_versions')
    .update({ summary_override: overrideText })
    .eq('id', (master as { id: string }).id)

  return { error: error?.message ?? null }
}
