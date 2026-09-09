import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase as defaultClient } from '@/lib/supabase'

export interface PendingResumeContentSuggestion {
  id: string
  targetField: string
  proposedText: string
  evidenceReference: string | null
  reasoning: string | null
}

/**
 * Phase 8 UI — reads back a resume version's still-`pending` AI content
 * suggestions for the review panel. Deliberately scoped to `pending`
 * only: once `decideResumeContentSuggestion` marks one `reviewed`, it
 * drops out of this list -- the review UI never re-shows something the
 * member already decided on.
 */
export async function fetchPendingResumeContentSuggestions(
  userId: string,
  resumeVersionId: string,
  client: SupabaseClient = defaultClient,
): Promise<PendingResumeContentSuggestion[]> {
  const { data } = await client
    .from('resume_content_suggestions')
    .select('id, target_field, proposed_text, evidence_reference, reasoning')
    .eq('user_id', userId)
    .eq('resume_version_id', resumeVersionId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  return ((data ?? []) as { id: string; target_field: string; proposed_text: string; evidence_reference: string | null; reasoning: string | null }[]).map((row) => ({
    id: row.id,
    targetField: row.target_field,
    proposedText: row.proposed_text,
    evidenceReference: row.evidence_reference,
    reasoning: row.reasoning,
  }))
}
