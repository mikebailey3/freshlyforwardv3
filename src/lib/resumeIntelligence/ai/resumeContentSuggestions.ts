import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase as defaultClient } from '@/lib/supabase'
import type { ResumeAIContentProvider, ResumeAISuggestionInput } from './resumeAIProvider'
import { validateGroundedProposal } from './validateGroundedProposal'
import type { ConfirmationDecision } from '@/types/resume'

export interface CreateResumeContentSuggestionResult {
  suggestionId: string | null
  /** True when the provider had nothing to propose, or its proposal failed the grounding check -- both are honest "nothing to show", never an error. */
  skipped: boolean
  error: string | null
}

/**
 * Phase 8 — asks the injected AI provider for a suggestion, rejects it
 * outright if it fails `validateGroundedProposal`, and persists only a
 * grounded, still-`pending` proposal. NEVER auto-applies the suggestion
 * to the resume version or canonical Profile -- that only happens via
 * `decideResumeContentSuggestion` below, driven by an explicit member
 * decision.
 */
export async function createResumeContentSuggestion(
  input: ResumeAISuggestionInput,
  provider: ResumeAIContentProvider,
  isPurelyStylistic: boolean,
  client: SupabaseClient = defaultClient,
): Promise<CreateResumeContentSuggestionResult> {
  const suggestion = await provider.suggest(input)

  if (!suggestion.available || suggestion.proposedText === null) {
    return { suggestionId: null, skipped: true, error: null }
  }

  const check = validateGroundedProposal({
    evidenceReference: suggestion.evidenceReference,
    isPurelyStylistic,
    availableEvidence: input.availableEvidence,
  })

  if (!check.grounded) {
    return { suggestionId: null, skipped: true, error: check.reason }
  }

  const { data, error } = await client
    .from('resume_content_suggestions')
    .insert({
      user_id: input.userId,
      resume_version_id: input.resumeVersionId,
      target_field: input.targetField,
      proposed_text: suggestion.proposedText,
      evidence_reference: suggestion.evidenceReference,
    })
    .select('id')
    .single()

  if (error || !data) return { suggestionId: null, skipped: false, error: error?.message ?? 'Could not save the suggestion.' }

  return { suggestionId: (data as { id: string }).id, skipped: false, error: null }
}

export interface DecideResumeContentSuggestionResult {
  error: string | null
}

/**
 * Records the member's explicit decision on a pending suggestion.
 * Mirrors `resume_field_proposals`' review shape exactly (same five
 * `ConfirmationDecision` values, same reject-vs-keep_existing_canonical
 * distinction). This function only records the decision -- applying an
 * accepted suggestion's text into the resume version's actual content is
 * the caller's separate, explicit next step (e.g. via
 * `updateMasterResumeEntries`'s override path), never an implicit side
 * effect of recording a decision.
 */
export async function decideResumeContentSuggestion(
  userId: string,
  suggestionId: string,
  decision: ConfirmationDecision,
  editedValue: string | undefined,
  client: SupabaseClient = defaultClient,
): Promise<DecideResumeContentSuggestionResult> {
  const { data: existing } = await client
    .from('resume_content_suggestions')
    .select('id, status')
    .eq('id', suggestionId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!existing) {
    return { error: `Suggestion '${suggestionId}' not found for this member.` }
  }
  if ((existing as { status: string }).status === 'reviewed') {
    return { error: 'This suggestion has already been reviewed.' }
  }

  const { error } = await client
    .from('resume_content_suggestions')
    .update({
      status: 'reviewed',
      decision,
      decision_edited_value: editedValue ?? null,
      decided_at: new Date().toISOString(),
    })
    .eq('id', suggestionId)

  return { error: error?.message ?? null }
}
