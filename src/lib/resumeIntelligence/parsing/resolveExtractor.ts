import { DocumentExtractionError } from './types'
import type { DocumentExtractor, DocumentSourceMimeType } from './types'
import { PdfDocumentExtractor } from './pdfExtractor'
import { DocxDocumentExtractor } from './docxExtractor'
import { PlainTextExtractor } from './plainTextExtractor'

/** DI-friendly resolver, same shape as the `PROVIDERS` record in scrapeCompanies.ts -- extractors are passed in, defaulting to the three Phase 2 implementations, so a caller/test can substitute fakes. */
export function resolveDocumentExtractor(
  mimeType: DocumentSourceMimeType,
  extractors: readonly DocumentExtractor[] = DEFAULT_EXTRACTORS,
): DocumentExtractor {
  const found = extractors.find((e) => e.supportedMimeTypes.includes(mimeType))
  if (!found) {
    throw new DocumentExtractionError('UNSUPPORTED_MIME_TYPE', `No registered extractor supports ${mimeType}`)
  }
  return found
}

export const DEFAULT_EXTRACTORS: readonly DocumentExtractor[] = [
  new PdfDocumentExtractor(),
  new DocxDocumentExtractor(),
  new PlainTextExtractor(),
]
