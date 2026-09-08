import { describe, expect, it } from 'vitest'
import { PdfDocumentExtractor } from './pdfExtractor'
import { buildMinimalPdf } from './testHelpers/buildMinimalPdf'
import { DocumentExtractionError } from './types'

describe('PdfDocumentExtractor', () => {
  it('declares application/pdf as its only supported mime type', () => {
    const extractor = new PdfDocumentExtractor()
    expect(extractor.supportedMimeTypes).toEqual(['application/pdf'])
  })

  it('extracts text items with real position and page data', async () => {
    const pdf = buildMinimalPdf([
      { text: 'Jamie Rivera', x: 72, y: 700 },
      { text: 'jamie@example.com', x: 72, y: 680 },
    ])
    const extractor = new PdfDocumentExtractor()
    const result = await extractor.extract(pdf, 'application/pdf')

    expect(result.sourceMimeType).toBe('application/pdf')
    expect(result.blocks).toHaveLength(2)
    expect(result.blocks[0].text).toBe('Jamie Rivera')
    expect(result.blocks[0].page).toBe(1)
    expect(result.blocks[0].position).not.toBeNull()
    expect(result.blocks[0].position?.x).toBeCloseTo(72, 0)
    expect(result.blocks[1].text).toBe('jamie@example.com')
  })

  it('orders blocks top-to-bottom by y position, matching natural reading order', async () => {
    // Written out of file-order on purpose -- the extractor must sort by position, not emission order.
    const pdf = buildMinimalPdf([
      { text: 'Second line', x: 72, y: 680 },
      { text: 'First line', x: 72, y: 700 },
    ])
    const extractor = new PdfDocumentExtractor()
    const result = await extractor.extract(pdf, 'application/pdf')
    expect(result.blocks.map((b) => b.text)).toEqual(['First line', 'Second line'])
    expect(result.blocks.map((b) => b.order)).toEqual([0, 1])
  })

  it('fullText is a newline join of the ordered blocks', async () => {
    const pdf = buildMinimalPdf([
      { text: 'Line one', x: 72, y: 700 },
      { text: 'Line two', x: 72, y: 680 },
    ])
    const extractor = new PdfDocumentExtractor()
    const result = await extractor.extract(pdf, 'application/pdf')
    expect(result.fullText).toBe('Line one\nLine two')
  })

  it('throws DocumentExtractionError for corrupt/non-pdf bytes', async () => {
    const extractor = new PdfDocumentExtractor()
    const garbage = new TextEncoder().encode('not a pdf file').buffer as ArrayBuffer
    await expect(extractor.extract(garbage, 'application/pdf')).rejects.toThrow(DocumentExtractionError)
  })

  it('throws DocumentExtractionError for an unsupported mime type', async () => {
    const extractor = new PdfDocumentExtractor()
    const pdf = buildMinimalPdf([{ text: 'x', x: 0, y: 0 }])
    await expect(extractor.extract(pdf, 'text/plain')).rejects.toThrow(DocumentExtractionError)
  })
})
