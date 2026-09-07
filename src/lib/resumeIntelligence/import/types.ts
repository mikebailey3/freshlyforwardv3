import type { DocumentExtractionWarning } from '@/lib/resumeIntelligence/parsing/types'

/**
 * Explicit, typed outcome of one import/scan attempt -- never a raw
 * internal exception reaching the UI. Mirrors resume_import_attempts.status
 * in the (authored, unapplied) Phase 3 migration.
 */
export type ImportStatus =
  | { kind: 'succeeded'; proposalCount: number }
  | { kind: 'partial'; proposalCount: number; warnings: DocumentExtractionWarning[] }
  | { kind: 'unsupported_format'; mimeType: string }
  | { kind: 'extraction_failed'; reason: string }
  /** Section detection / field mapping threw -- distinct from a clean zero-proposal result, which is not an error. */
  | { kind: 'parsing_failed'; reason: string }
  /** Extraction succeeded but produced no proposals at all -- e.g. a scanned/image PDF with no text layer. Not an error; needs a distinct, actionable member-facing message. */
  | { kind: 'no_content_found' }
  | { kind: 'missing_source_document' }

export interface ImportResult {
  /** Null only for missing_source_document -- no attempt row can be created without a real member_documents row to attach it to. */
  attemptId: string | null
  status: ImportStatus
}
