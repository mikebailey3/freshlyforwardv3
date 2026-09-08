import { extractTextItems, getDocumentProxy } from 'unpdf'
import { DocumentExtractionError } from './types'
import type { DocumentExtractor, DocumentSourceMimeType, ExtractedBlock, ExtractedDocument } from './types'

const PDF_MIME_TYPE: DocumentSourceMimeType = 'application/pdf'

/**
 * Wraps unpdf (MIT, built on pdf.js) for PDF text extraction. unpdf
 * returns text items grouped by page in the order pdf.js encountered
 * them in the content stream, which is not reliably reading order --
 * this sorts each page's items top-to-bottom (descending y), then
 * left-to-right (ascending x) as a reading-order approximation. Real
 * multi-column resumes will need a smarter approximation later (a
 * documented Phase 3+ limitation, not solved here).
 */
export class PdfDocumentExtractor implements DocumentExtractor {
  readonly supportedMimeTypes: readonly DocumentSourceMimeType[] = [PDF_MIME_TYPE]

  async extract(file: ArrayBuffer, mimeType: DocumentSourceMimeType): Promise<ExtractedDocument> {
    if (mimeType !== PDF_MIME_TYPE) {
      throw new DocumentExtractionError('UNSUPPORTED_MIME_TYPE', `PdfDocumentExtractor cannot handle ${mimeType}`)
    }

    let items: { totalPages: number; items: { str: string; x: number; y: number; width: number; height: number }[][] }
    try {
      const pdf = await getDocumentProxy(new Uint8Array(file))
      items = await extractTextItems(pdf)
    } catch (err) {
      throw new DocumentExtractionError(
        'PDF_PARSE_FAILED',
        `Could not read this file as a PDF document: ${err instanceof Error ? err.message : String(err)}`,
      )
    }

    const blocks: ExtractedBlock[] = []
    let order = 0

    items.items.forEach((pageItems, pageIndex) => {
      const nonEmpty = pageItems.filter((item) => item.str.trim().length > 0)
      const sorted = [...nonEmpty].sort((a, b) => (b.y - a.y) || (a.x - b.x))

      for (const item of sorted) {
        blocks.push({
          order: order++,
          kind: 'line',
          text: item.str.trim(),
          page: pageIndex + 1,
          position: { x: item.x, y: item.y, width: item.width, height: item.height },
          styleHint: null, // unpdf exposes fontSize, but font-size-based heading detection is an explicit, documented Phase 3+ extension -- not built here.
        })
      }
    })

    return {
      sourceMimeType: PDF_MIME_TYPE,
      fullText: blocks.map((b) => b.text).join('\n'),
      blocks,
      warnings: [],
    }
  }
}
