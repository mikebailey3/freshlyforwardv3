import type { ResumeContentSuggestion } from '@/types/resume'

/**
 * Phase 8 — the AI provider boundary. Same shape as every other AI/
 * external-dependency boundary in this codebase (Career Vault's
 * `CareerWinInterpreter`, Resume Intelligence's own
 * `EvidenceCoverageProvider`/`TargetRoleAlignmentProvider`): an
 * interface, a graceful `NullResumeAIContentProvider` that reports
 * unavailability honestly, and a later real implementation
 * (`AIInnovationLabResumeContentProvider` or similar) as an
 * interface-compatible swap once wired to AI Innovation Lab
 * (https://wmlink.wal-mart.com/onboard) — not built in this pass; no
 * credentials/network call exist here.
 *
 * Every proposal an implementation returns MUST be traceable: either
 * `evidenceReference` names a real Career Vault career_win or literal
 * canonical Profile content (checked by `validateGroundedProposal`
 * before persistence), or the suggestion is purely stylistic and
 * `evidenceReference` is explicitly null. An implementation must never
 * return a proposal whose factual content has no real source.
 */
export interface ResumeAIContentProvider {
  suggest(input: ResumeAISuggestionInput): Promise<ResumeAISuggestionResult>
}

export interface ResumeAISuggestionInput {
  userId: string
  resumeVersionId: string
  /** e.g. 'summary', 'employment[entryId].description' -- same free-form shape as ResumeContentSuggestion.targetField. */
  targetField: string
  /** The current literal text at targetField, for the provider to improve/rewrite -- never fabricate a field that doesn't exist. */
  currentText: string
  /** Literal evidence available to ground a suggestion in: canonical Profile excerpts and/or confirmed Career Vault career_win statements. */
  availableEvidence: string[]
}

export interface ResumeAISuggestionResult {
  available: boolean
  /** Present only when available is true. */
  proposedText: string | null
  /** Present only when available is true. Null only for a purely stylistic suggestion (see interface doc). */
  evidenceReference: string | null
  /** Present only when available is false -- why no suggestion exists. */
  unavailableReason?: string
}

/**
 * The only Phase 8 implementation. Always reports unavailable, honestly
 * -- never fabricates a suggestion. Kept as the default so nothing in
 * this codebase silently starts calling an AI provider that isn't
 * actually configured.
 */
export class NullResumeAIContentProvider implements ResumeAIContentProvider {
  suggest(_input: ResumeAISuggestionInput): Promise<ResumeAISuggestionResult> {
    return Promise.resolve({
      available: false,
      proposedText: null,
      evidenceReference: null,
      unavailableReason: 'AI-assisted resume suggestions are not connected yet. This will be available once a real ResumeAIContentProvider (e.g. via AI Innovation Lab) is wired in.',
    })
  }
}

/** Re-exported for callers that only need the persisted shape, not the provider boundary. */
export type { ResumeContentSuggestion }
