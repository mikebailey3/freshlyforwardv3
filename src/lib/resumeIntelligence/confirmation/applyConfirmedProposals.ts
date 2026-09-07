import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { ConfirmationDecision, ProposalDecision } from '@/types/resume'

export interface ApplyConfirmedProposalsResult {
  errors: string[]
}

/**
 * Fields member_profiles does not yet have a scalar column for. Discovered
 * during Phase 2 implementation: the approved `ProposalDestination` design
 * includes `email` as a canonical-profile field, but the live schema
 * (20260802172349_phase3_membership_system.sql) only has full_name, phone,
 * location. Rather than silently writing an undefined column, this fails
 * loudly and is flagged as a known architecture deviation in the Phase 2
 * report -- a future schema decision is required before email can round-trip
 * through this confirmation layer.
 */
const UNSUPPORTED_CANONICAL_SCALAR_FIELDS = new Set(['email'])

/**
 * Applies a member's explicit confirmation decisions to member_profiles.
 *
 * Routing is purely by `decision` -- never by whether the target field
 * already has content (the corrected Phase 2 rule). Only
 * `accept_as_canonical` and `accept_edited_canonical` write to
 * member_profiles, and only for `canonical-profile` destinations.
 * `canonical-profile-array` destinations (employment_history, education,
 * certifications, skills) are out of scope for this function -- Phase 2
 * ships confirmation for the four scalar canonical-profile fields only;
 * array-field confirmation is deferred, per the Phase 2 boundary, to the
 * persistence layer that will land with resume_versions.
 */
export async function applyConfirmedProposals(
  userId: string,
  decisions: ProposalDecision[],
  client: SupabaseClient = supabase,
): Promise<ApplyConfirmedProposalsResult> {
  const errors: string[] = []

  for (const decision of decisions) {
    const error = await applyOne(userId, decision, client)
    if (error) errors.push(error)
  }

  return { errors }
}

async function applyOne(userId: string, decision: ProposalDecision, client: SupabaseClient): Promise<string | null> {
  const { proposal, decision: action, editedValue } = decision

  if (!writesCanonicalProfile(action)) return null

  if (proposal.destination.kind !== 'canonical-profile') {
    return `Cannot apply decision '${action}' to proposal ${proposal.id}: destination is '${proposal.destination.kind}', not 'canonical-profile'.`
  }

  const { field } = proposal.destination

  if (UNSUPPORTED_CANONICAL_SCALAR_FIELDS.has(field)) {
    return `Cannot write canonical field 'email' for proposal ${proposal.id}: member_profiles has no email column yet.`
  }

  const value = action === 'accept_edited_canonical' ? editedValue : proposal.candidateValue
  if (action === 'accept_edited_canonical' && editedValue === undefined) {
    return `Decision 'accept_edited_canonical' for proposal ${proposal.id} requires an editedValue.`
  }

  const { error } = await client
    .from('member_profiles')
    .update({ [field]: value })
    .eq('user_id', userId)

  if (error) {
    return `Failed to write canonical field '${field}' for proposal ${proposal.id}: ${error.message}`
  }

  return null
}

function writesCanonicalProfile(action: ConfirmationDecision): boolean {
  return action === 'accept_as_canonical' || action === 'accept_edited_canonical'
}
