/**
 * Resume Intelligence Phase 2 — extraction & section-detection types.
 *
 * These are pipeline-internal shapes (Stages 1-2 of the ingestion
 * pipeline), distinct from the persisted canonical types in
 * src/types/resume.ts. Nothing here is persisted.
 */

export type DocumentSourceMimeType =
  | 'application/pdf'
  | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' // .docx
  | 'text/plain'

export interface DocumentExtractionWarning {
  code: string
  message: string
}

/** Thrown by a DocumentExtractor for a file it cannot process at all (wrong/corrupt bytes for the declared mime type). Never thrown for merely low-quality extraction -- that's a warning, not an error. */
export class DocumentExtractionError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message)
    this.name = 'DocumentExtractionError'
  }
}

export type ExtractedBlockKind = 'heading' | 'paragraph' | 'list-item' | 'line' | 'unknown'

export interface ExtractedBlock {
  /** Position in reading order, as best the extractor can determine. */
  order: number
  kind: ExtractedBlockKind
  text: string
  /** 1-indexed. Always 1 for DOCX/TXT (no native page concept); real page number for PDF. */
  page: number
  /** Only populated when the source format provides real coordinates (PDF via unpdf). Null for DOCX/TXT. */
  position: { x: number; y: number; width: number; height: number } | null
  /** Cheap structural hint the extractor itself can detect (mammoth reports real heading tags). Deliberately not computed from PDF font-size deltas in Phase 2 -- unpdf does expose fontSize, but using it for heading detection is an explicit, documented Phase 3+ extension, not built now. */
  styleHint: 'bold' | 'large' | 'normal' | null
}

export interface ExtractedDocument {
  sourceMimeType: DocumentSourceMimeType
  /** Guaranteed-minimum output every extractor produces, regardless of how rich `blocks` turns out. */
  fullText: string
  blocks: ExtractedBlock[]
  warnings: DocumentExtractionWarning[]
}

export interface DocumentExtractor {
  readonly supportedMimeTypes: readonly DocumentSourceMimeType[]
  extract(file: ArrayBuffer, mimeType: DocumentSourceMimeType): Promise<ExtractedDocument>
}

export type ResumeSectionKind =
  | 'contact' | 'summary' | 'employment' | 'education' | 'certifications' | 'skills' | 'unknown'

export interface DetectedSection {
  kind: ResumeSectionKind
  /** Null for the implicit leading "contact" section, which has no heading of its own. */
  headingText: string | null
  blocks: ExtractedBlock[]
  /** Which heading rule matched, for explainability -- "why did we call this employment?". Null for the implicit contact section and for the unknown-content passthrough. */
  matchedRule: string | null
}

export interface SectionDetector {
  detect(document: ExtractedDocument): DetectedSection[]
}
