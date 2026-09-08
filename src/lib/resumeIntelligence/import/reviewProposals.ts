import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase as defaultClient } from '@/lib/supabase'
import { applyConfirmedProposals } from '@/lib/resumeIntelligence/confirmation/applyConfirmedProposals'
import type { ConfirmationDecision, ProposalDestination, ResumeFieldProposal } from '@/types/resume'

export interface ProposalRow {
  id: string
  source_document_id: string
  destination_kind: ProposalDestination['kind']
  destination_field: string
  destination_array_index: string | null
  candidate_value: string
  proposed_action: 'create' | 'update' | 'no-op-already-present'
  confidence: 'high' | 'medium' | 'low'
  provenance_section_kind: string
  provenance_block_orders: number[]
  provenance_source_excerpt: string
  provenance_page: number | null
  provenance_matched_rule: string
  status: 'pending' | 'reviewed'
  decision: ConfirmationDecision | null
}

const PROPOSAL_COLUMNS =
  'id, source_document_id, destination_kind, destination_field, destination_array_index, candidate_value, proposed_action, confidence, provenance_section_kind, provenance_block_orders, provenance_source_excerpt, provenance_page, provenance_matched_rule, status, decision'

/**
 * Loads the current (non-superseded) generation of proposals for one
 * uploaded document, for the Import Review UI. Ordering by creation time
 * is a display convenience only -- it is never used to infer
 * generation/supersession, which is keyed by import_attempt_id.
 */
export async function fetchProposalsForReview(
  userId: string,
  sourceDocumentId: string,
  client: SupabaseClient = defaultClient,
): Promise<ProposalRow[]> {
  const { data } = await client
    .from('resume_field_proposals')
    .select(PROPOSAL_COLUMNS)
    .eq('user_id', userId)
    .eq('source_document_id', sourceDocumentId)
    .is('superseded_at', null)
    .order('created_at', { ascending: true })

  return (data ?? []) as unknown as ProposalRow[]
}

/**
 * Applies one member decision on a persisted proposal, incrementally --
 * called per-decision from the Import Review UI, not batched, so leaving
 * and reloading the page never loses progress.
 *
 * The row is only marked `status='reviewed'` when the underlying
 * canonical write (if any) actually succeeded -- a rejected write (the
 * email-column gap, the Phase 3 orphan-factual-entry guard, an invalid
 * decision/destination combination) leaves the proposal `pending` so the
 * member sees the error and can choose again, rather than the UI
 * reporting a decision as resolved when nothing was actually applied.
 */
export async function recordProposalDecision(
  userId: string,
  row: ProposalRow,
  decision: ConfirmationDecision,
  editedValue: string | undefined,
  client: SupabaseClient = defaultClient,
): Promise<{ errors: string[] }> {
  const proposal = rowToResumeFieldProposal(row)
  const { errors } = await applyConfirmedProposals(userId, [{ proposal, decision, editedValue }], client)

  if (errors.length > 0) return { errors }

  const { error: updateError } = await client
    .from('resume_field_proposals')
    .update({
      status: 'reviewed',
      decision,
      decision_edited_value: editedValue ?? null,
      decided_at: new Date().toISOString(),
    })
    .eq('id', row.id)

  return { errors: updateError ? [updateError.message] : [] }
}

function rowToResumeFieldProposal(row: ProposalRow): ResumeFieldProposal {
  return {
    id: row.id,
    candidateValue: row.candidate_value,
    destination: rowToDestination(row),
    provenance: {
      sourceDocumentId: row.source_document_id,
      sectionKind: row.provenance_section_kind as ResumeFieldProposal['provenance']['sectionKind'],
      blockOrders: row.provenance_block_orders,
      sourceExcerpt: row.provenance_source_excerpt,
      page: row.provenance_page,
      matchedRule: row.provenance_matched_rule,
    },
    confidence: row.confidence,
    proposedAction: row.proposed_action,
  }
}

function rowToDestination(row: ProposalRow): ProposalDestination {
  if (row.destination_kind === 'canonical-profile') {
    return { kind: 'canonical-profile', field: row.destination_field as 'full_name' | 'email' | 'phone' | 'location' }
  }
  if (row.destination_kind === 'canonical-profile-array') {
    const index = row.destination_array_index === 'append' ? 'append' : Number(row.destination_array_index)
    return {
      kind: 'canonical-profile-array',
      field: row.destination_field as 'employment_history' | 'education' | 'certifications' | 'skills',
      index,
    }
  }
  return { kind: 'resume-specific', field: row.destination_field as 'summary_override' | 'section_order' }
}
