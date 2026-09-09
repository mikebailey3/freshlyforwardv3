import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase as defaultClient } from '@/lib/supabase'
import { fetchProposalsForReview } from '@/lib/resumeIntelligence/import/reviewProposals'
import type { ProposalRow } from '@/lib/resumeIntelligence/import/reviewProposals'

export interface ResumeWorkflowSnapshot {
  latestResumeDocumentId: string | null
  hasResumeDocument: boolean
  hasImportAttempt: boolean
  proposals: ProposalRow[]
  pendingProposalCount: number
  masterResumeVersionId: string | null
  hasMaster: boolean
}

/**
 * Gathers the raw facts `computeResumeWorkflowStage` needs, in one place,
 * so the page component never issues these reads itself. Reuses
 * `fetchProposalsForReview` (Phase 3) rather than a second proposals
 * query -- the page needs the full row set anyway to render
 * `ImportReviewPanel`, and `pendingProposalCount` is just a filter over
 * that same result (DRY).
 */
export async function fetchResumeWorkflowSnapshot(
  userId: string,
  client: SupabaseClient = defaultClient,
): Promise<ResumeWorkflowSnapshot> {
  const [{ data: documents }, { data: master }] = await Promise.all([
    client
      .from('member_documents')
      .select('id')
      .eq('user_id', userId)
      .eq('document_type', 'resume')
      .order('uploaded_at', { ascending: false })
      .limit(1),
    client
      .from('resume_versions')
      .select('id')
      .eq('member_id', userId)
      .eq('is_master', true)
      .eq('is_archived', false)
      .maybeSingle(),
  ])

  const latestResumeDocumentId = ((documents ?? []) as { id: string }[])[0]?.id ?? null
  const masterResumeVersionId = (master as { id: string } | null)?.id ?? null

  let hasImportAttempt = false
  let proposals: ProposalRow[] = []

  if (latestResumeDocumentId) {
    const [{ data: attempts }, fetchedProposals] = await Promise.all([
      client.from('resume_import_attempts').select('id').eq('source_document_id', latestResumeDocumentId).limit(1),
      fetchProposalsForReview(userId, latestResumeDocumentId, client),
    ])
    hasImportAttempt = ((attempts ?? []) as { id: string }[]).length > 0
    proposals = fetchedProposals
  }

  return {
    latestResumeDocumentId,
    hasResumeDocument: latestResumeDocumentId !== null,
    hasImportAttempt,
    proposals,
    pendingProposalCount: proposals.filter((p) => p.status === 'pending').length,
    masterResumeVersionId,
    hasMaster: masterResumeVersionId !== null,
  }
}
