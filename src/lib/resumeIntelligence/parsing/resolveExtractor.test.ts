import { describe, expect, it } from 'vitest'
import { resolveDocumentExtractor, DEFAULT_EXTRACTORS } from './resolveExtractor'
import { PdfDocumentExtractor } from './pdfExtractor'
import { DocxDocumentExtractor } from './docxExtractor'
import { PlainTextExtractor } from './plainTextExtractor'
import { DocumentExtractionError } from './types'
import type { DocumentExtractor } from './types'

const fakePdfExtractor: DocumentExtractor = {
  supportedMimeTypes: ['application/pdf'],
  extract: async () => ({ sourceMimeType: 'application/pdf', fullText: '', blocks: [], warnings: [] }),
}
const fakeTxtExtractor: DocumentExtractor = {
  supportedMimeTypes: ['text/plain'],
  extract: async () => ({ sourceMimeType: 'text/plain', fullText: '', blocks: [], warnings: [] }),
}

describe('resolveDocumentExtractor', () => {
  it('returns the extractor whose supportedMimeTypes includes the requested type', () => {
    const resolved = resolveDocumentExtractor('application/pdf', [fakePdfExtractor, fakeTxtExtractor])
    expect(resolved).toBe(fakePdfExtractor)
  })

  it('throws DocumentExtractionError when no registered extractor supports the mime type', () => {
    expect(() => resolveDocumentExtractor('application/vnd.openxmlformats-officedocument.wordprocessingml.document', [fakeTxtExtractor]))
      .toThrow(DocumentExtractionError)
  })

  describe('against the real DEFAULT_EXTRACTORS registry (no override)', () => {
    it('resolves application/pdf to PdfDocumentExtractor', () => {
      expect(resolveDocumentExtractor('application/pdf')).toBeInstanceOf(PdfDocumentExtractor)
    })

    it('resolves the docx mime type to DocxDocumentExtractor', () => {
      expect(
        resolveDocumentExtractor('application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
      ).toBeInstanceOf(DocxDocumentExtractor)
    })

    it('resolves text/plain to PlainTextExtractor', () => {
      expect(resolveDocumentExtractor('text/plain')).toBeInstanceOf(PlainTextExtractor)
    })

    it('throws DocumentExtractionError for a mime type no default extractor supports', () => {
      // @ts-expect-error -- deliberately an unsupported mime type, to prove the resolver rejects it rather than throwing a TypeScript-only guarantee.
      expect(() => resolveDocumentExtractor('image/png')).toThrow(DocumentExtractionError)
    })

    it('registers exactly one extractor per supported format, each declaring only its own mime type', () => {
      expect(DEFAULT_EXTRACTORS).toHaveLength(3)
      const allMimeTypes = DEFAULT_EXTRACTORS.flatMap((e) => e.supportedMimeTypes)
      expect(new Set(allMimeTypes).size).toBe(allMimeTypes.length)
    })
  })
})
