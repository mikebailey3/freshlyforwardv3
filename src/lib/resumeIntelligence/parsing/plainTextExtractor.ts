import { DocumentExtractionError } from './types'
import type { DocumentExtractor, DocumentSourceMimeType, ExtractedBlock, ExtractedDocument } from './types'

/** Passthrough extractor for pasted/uploaded plain text -- no library needed. */
export class PlainTextExtractor implements DocumentExtractor {
  readonly supportedMimeTypes: readonly DocumentSourceMimeType[] = ['text/plain']

  async extract(file: ArrayBuffer, mimeType: DocumentSourceMimeType): Promise<ExtractedDocument> {
    if (mimeType !== 'text/plain') {
      throw new DocumentExtractionError('UNSUPPORTED_MIME_TYPE', `PlainTextExtractor cannot handle ${mimeType}`)
    }

    const fullText = new TextDecoder('utf-8').decode(file)
    const blocks: ExtractedBlock[] = fullText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((text, order) => ({ order, kind: 'line', text, page: 1, position: null, styleHint: null }))

    return { sourceMimeType: 'text/plain', fullText, blocks, warnings: [] }
  }
}
