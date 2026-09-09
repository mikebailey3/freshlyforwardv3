import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase as defaultClient } from '@/lib/supabase'
import { resolveDocumentExtractor, DEFAULT_EXTRACTORS } from '@/lib/resumeIntelligence/parsing/resolveExtractor'
import { DeterministicSectionDetector } from '@/lib/resumeIntelligence/parsing/sectionDetector'
import { DeterministicResumeFieldMapper } from '@/lib/resumeIntelligence/parsing/fieldMapper'
import { DocumentExtractionError } from '@/lib/resumeIntelligence/parsing/types'
import type { DocumentExtractor, DocumentSourceMimeType, ExtractedDocument, SectionDetector } from '@/lib/resumeIntelligence/parsing/types'
import type { ResumeFieldMapper, ResumeFieldProposal } from '@/types/resume'
import type { ImportResult, ImportStatus } from './types'

export interface ImportResumeDocumentOverrides {
  extractors?: readonly DocumentExtractor[]
  sectionDetector?: SectionDetector
  fieldMapper?: ResumeFieldMapper
}

/**
 * Orchestrates one resume import/scan: member_documents -> file retrieval
 * -> extractor resolution -> extraction -> section detection -> field
 * mapping -> resume_field_proposals persistence, tracked under a
 * resume_import_attempts row. Not called directly from React -- a thin
 * hook/action layer invokes this, same as every other service in this
 * codebase (opportunityEngine.ts, careerCompass/session.ts).
 *
 * `resume_import_attempts`/`resume_field_proposals` are the Phase 2/3
 * migration's tables -- authored, not yet applied to any live Supabase
 * project. This function is written and tested (via a fake client)
 * against that schema so it is ready the moment the migration lands; it
 * is not exercised against a real database in this phase.
 *
 * Every failure mode returns a typed ImportStatus -- no internal
 * exception (a corrupt file, an unreachable extractor, an unexpected
 * mapper error) is ever thrown out to a caller.
 */
export async function importResumeDocument(
  userId: string,
  memberDocumentId: string,
  client: SupabaseClient = defaultClient,
  overrides: ImportResumeDocumentOverrides = {},
): Promise<ImportResult> {
  const extractors = overrides.extractors ?? DEFAULT_EXTRACTORS
  const sectionDetector = overrides.sectionDetector ?? new DeterministicSectionDetector()
  const fieldMapper = overrides.fieldMapper ?? new DeterministicResumeFieldMapper()

  const { data: doc, error: docError } = await client
    .from('member_documents')
    .select('id, user_id, file_path, mime_type, storage_bucket')
    .eq('id', memberDocumentId)
    .maybeSingle()

  if (docError || !doc) {
    return { attemptId: null, status: { kind: 'missing_source_document' } }
  }

  const { data: attempt, error: attemptError } = await client
    .from('resume_import_attempts')
    .insert({ source_document_id: memberDocumentId, user_id: userId, status: 'pending' })
    .select('id')
    .single()

  if (attemptError || !attempt) {
    return {
      attemptId: null,
      status: { kind: 'extraction_failed', reason: attemptError?.message ?? 'failed to record import attempt' },
    }
  }
  const attemptId = attempt.id as string

  const { data: blob, error: downloadError } = await client.storage
    .from(doc.storage_bucket as string)
    .download(doc.file_path as string)

  if (downloadError || !blob) {
    return finalize(client, attemptId, {
      kind: 'extraction_failed',
      reason: downloadError?.message ?? 'could not read the uploaded file',
    })
  }

  const fileBytes = await (blob as Blob).arrayBuffer()
  const mimeType = doc.mime_type as DocumentSourceMimeType

  let document: ExtractedDocument
  try {
    const extractor = resolveDocumentExtractor(mimeType, extractors)
    document = await extractor.extract(fileBytes, mimeType)
  } catch (err) {
    if (err instanceof DocumentExtractionError && err.code === 'UNSUPPORTED_MIME_TYPE') {
      return finalize(client, attemptId, { kind: 'unsupported_format', mimeType })
    }
    return finalize(client, attemptId, { kind: 'extraction_failed', reason: describeError(err) })
  }

  let proposals: ResumeFieldProposal[]
  try {
    const sections = sectionDetector.detect(document)
    proposals = await fieldMapper.map(sections, document, memberDocumentId)
  } catch (err) {
    return finalize(client, attemptId, { kind: 'parsing_failed', reason: describeError(err) })
  }

  if (proposals.length === 0) {
    return finalize(client, attemptId, { kind: 'no_content_found' })
  }

  // Explicit retry only ever supersedes proposals still pending review --
  // a member's already-reviewed decisions from a prior attempt are never
  // touched (also enforced at the schema level: a CHECK constraint blocks
  // superseded_at from ever being set on a status='reviewed' row).
  await client
    .from('resume_field_proposals')
    .update({ superseded_at: new Date().toISOString() })
    .eq('source_document_id', memberDocumentId)
    .eq('status', 'pending')

  const rows = proposals.map((p) => proposalToRow(p, userId, memberDocumentId, attemptId))
  const { error: insertError } = await client.from('resume_field_proposals').insert(rows)

  if (insertError) {
    return finalize(client, attemptId, { kind: 'extraction_failed', reason: insertError.message })
  }

  const status: ImportStatus =
    document.warnings.length > 0
      ? { kind: 'partial', proposalCount: proposals.length, warnings: document.warnings }
      : { kind: 'succeeded', proposalCount: proposals.length }

  return finalize(client, attemptId, status)
}

async function finalize(client: SupabaseClient, attemptId: string, status: ImportStatus): Promise<ImportResult> {
  const proposalCount = 'proposalCount' in status ? status.proposalCount : 0
  const errorMessage = 'reason' in status ? status.reason : status.kind === 'unsupported_format' ? `unsupported format: ${status.mimeType}` : null

  await client
    .from('resume_import_attempts')
    .update({
      status: status.kind,
      error_message: errorMessage,
      proposal_count: proposalCount,
      completed_at: new Date().toISOString(),
    })
    .eq('id', attemptId)

  return { attemptId, status }
}

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/** Flattens a ResumeFieldProposal into a resume_field_proposals row, matching the authored migration exactly. */
function proposalToRow(proposal: ResumeFieldProposal, userId: string, sourceDocumentId: string, importAttemptId: string): Record<string, unknown> {
  const destinationArrayIndex = proposal.destination.kind === 'canonical-profile-array' ? String(proposal.destination.index) : null

  return {
    user_id: userId,
    source_document_id: sourceDocumentId,
    import_attempt_id: importAttemptId,
    destination_kind: proposal.destination.kind,
    destination_field: proposal.destination.field,
    destination_array_index: destinationArrayIndex,
    candidate_value: proposal.candidateValue,
    proposed_action: proposal.proposedAction,
    confidence: proposal.confidence,
    provenance_section_kind: proposal.provenance.sectionKind,
    provenance_block_orders: proposal.provenance.blockOrders,
    provenance_source_excerpt: proposal.provenance.sourceExcerpt,
    provenance_page: proposal.provenance.page,
    provenance_matched_rule: proposal.provenance.matchedRule,
    status: 'pending',
  }
}
