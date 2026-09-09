/**
 * Phase 8 — the grounding gate. Every AI-proposed suggestion with
 * factual content must have an `evidenceReference` that is a literal
 * substring of at least one piece of real evidence (a confirmed Career
 * Vault career_win statement, or canonical Profile content) BEFORE it is
 * ever persisted or shown to the member. This is the one place that
 * enforces "AI output must always be grounded" mechanically, rather than
 * trusting a provider's own claim.
 *
 * A null `evidenceReference` is allowed ONLY when the proposal is
 * explicitly marked purely stylistic (no new facts, e.g. rephrasing for
 * tone/brevity) -- anything else with no evidence is rejected outright.
 */
export interface GroundedProposalCheckInput {
  evidenceReference: string | null
  isPurelyStylistic: boolean
  availableEvidence: string[]
}

export interface GroundedProposalCheckResult {
  grounded: boolean
  reason: string | null
}

export function validateGroundedProposal(input: GroundedProposalCheckInput): GroundedProposalCheckResult {
  if (input.evidenceReference === null) {
    if (input.isPurelyStylistic) {
      return { grounded: true, reason: null }
    }
    return { grounded: false, reason: 'This suggestion introduces new factual content but has no evidence reference -- refusing to ground it in nothing.' }
  }

  const isLiteralSubstring = input.availableEvidence.some((evidence) => evidence.includes(input.evidenceReference as string))
  if (!isLiteralSubstring) {
    return { grounded: false, reason: 'The evidence reference is not a literal substring of any available evidence -- refusing a suggestion that cannot be traced back to something real.' }
  }

  return { grounded: true, reason: null }
}
