import { describe, expect, it } from 'vitest'
import { resolveDocumentExtractor } from './resolveExtractor'
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
})
