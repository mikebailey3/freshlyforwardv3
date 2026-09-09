/**
 * Phase 4: the pure state machine driving the Resume Intelligence page's
 * UI -- which section to show/emphasize given what's actually true for
 * this member right now. Kept as a standalone, dependency-free module
 * (no Supabase, no React) so every transition is a plain unit test, and
 * so the page component itself never has to re-derive this logic inline.
 */
export type ResumeWorkflowStage =
  | 'no_document'
  | 'ready_to_import'
  | 'needs_review'
  | 'ready_for_master'
  | 'master_ready'
  | 'analyzed'

export interface ResumeWorkflowInput {
  /** Has the member uploaded any member_documents row of document_type 'resume'? */
  hasResumeDocument: boolean
  /** Has importResumeDocument() ever been run against that document? */
  hasImportAttempt: boolean
  /** Count of resume_field_proposals still status='pending' for the member's current document. */
  pendingProposalCount: number
  /** Does an active (non-archived) resume_versions row with is_master=true exist? */
  hasMaster: boolean
  /** Has computeResumeIntelligence been run this session (or a prior result is available to show)? */
  hasAnalysisResult: boolean
}

export function computeResumeWorkflowStage(input: ResumeWorkflowInput): ResumeWorkflowStage {
  // Unreviewed proposals always take priority -- a member should resolve
  // those before moving on, even if they already have a Master Resume
  // (e.g. they re-scanned an updated document).
  if (input.pendingProposalCount > 0) return 'needs_review'

  if (!input.hasMaster) {
    if (!input.hasResumeDocument) return 'no_document'
    if (!input.hasImportAttempt) return 'ready_to_import'
    return 'ready_for_master'
  }

  return input.hasAnalysisResult ? 'analyzed' : 'master_ready'
}
