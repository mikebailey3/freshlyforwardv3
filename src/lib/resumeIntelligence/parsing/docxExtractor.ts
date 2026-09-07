import * as cheerio from 'cheerio'
import mammoth from 'mammoth'
import { DocumentExtractionError } from './types'
import type { DocumentExtractor, DocumentSourceMimeType, ExtractedBlock, ExtractedBlockKind, ExtractedDocument } from './types'

const DOCX_MIME_TYPE: DocumentSourceMimeType =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

const BLOCK_TAG_KIND: Record<string, ExtractedBlockKind> = {
  h1: 'heading', h2: 'heading', h3: 'heading', h4: 'heading', h5: 'heading', h6: 'heading',
  li: 'list-item',
  p: 'paragraph',
}

/**
 * Wraps mammoth (BSD-2-Clause) for DOCX text extraction. mammoth converts
 * to HTML rather than a plain block list, so this walks the resulting
 * markup with cheerio (already a dependency in this repo, no new library
 * needed) into the same ExtractedBlock shape the PDF/plain-text
 * extractors produce -- section detection and field mapping never know
 * which extractor a given block came from.
 */
export class DocxDocumentExtractor implements DocumentExtractor {
  readonly supportedMimeTypes: readonly DocumentSourceMimeType[] = [DOCX_MIME_TYPE]

  async extract(file: ArrayBuffer, mimeType: DocumentSourceMimeType): Promise<ExtractedDocument> {
    if (mimeType !== DOCX_MIME_TYPE) {
      throw new DocumentExtractionError('UNSUPPORTED_MIME_TYPE', `DocxDocumentExtractor cannot handle ${mimeType}`)
    }

    let html: string
    let messages: { type: string; message: string }[]
    try {
      // mammoth's installed Node entry point (lib/unzip.js) only recognizes
      // `buffer`/`path`/`file` options, not `arrayBuffer` -- despite the
      // package's own .d.ts listing `arrayBuffer` as a valid (browser)
      // input shape. Converting explicitly here is what actually works
      // against this dependency in our Node/Vitest runtime; browser-side
      // usage isn't exercised by anything in Phase 2 (no UI calls this
      // extractor yet) and should be re-verified before it is.
      const result = await mammoth.convertToHtml({ buffer: Buffer.from(file) })
      html = result.value
      messages = result.messages as { type: string; message: string }[]
    } catch (err) {
      throw new DocumentExtractionError(
        'DOCX_PARSE_FAILED',
        `Could not read this file as a DOCX document: ${err instanceof Error ? err.message : String(err)}`,
      )
    }

    const $ = cheerio.load(html)
    const blocks: ExtractedBlock[] = []
    let order = 0

    $('body')
      .children()
      .each((_, el) => {
        const tag = el.tagName?.toLowerCase()
        const kind = BLOCK_TAG_KIND[tag ?? '']
        if (!kind) return

        const text = $(el).text().trim()
        if (!text) return

        const fullyBold = $(el).find('strong').length > 0 && $(el).find('strong').text().trim() === text
        blocks.push({
          order: order++,
          kind,
          text,
          page: 1,
          position: null,
          styleHint: fullyBold ? 'bold' : 'normal',
        })
      })

    return {
      sourceMimeType: DOCX_MIME_TYPE,
      fullText: blocks.map((b) => b.text).join('\n'),
      blocks,
      warnings: messages.map((m) => ({ code: m.type, message: m.message })),
    }
  }
}
