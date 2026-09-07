import { describe, expect, it } from 'vitest'
import { DocxDocumentExtractor } from './docxExtractor'
import { buildMinimalDocx } from './testHelpers/buildMinimalDocx'
import { DocumentExtractionError } from './types'

describe('DocxDocumentExtractor', () => {
  it('declares the docx mime type as its only supported type', () => {
    const extractor = new DocxDocumentExtractor()
    expect(extractor.supportedMimeTypes).toEqual([
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ])
  })

  it('extracts paragraphs in order with page 1 and no position', async () => {
    const docx = await buildMinimalDocx([
      { text: 'Jamie Rivera' },
      { text: 'jamie@example.com' },
      { text: 'Grew revenue by 30%.' },
    ])
    const extractor = new DocxDocumentExtractor()
    const result = await extractor.extract(docx, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')

    expect(result.sourceMimeType).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    expect(result.blocks.map((b) => b.text)).toEqual(['Jamie Rivera', 'jamie@example.com', 'Grew revenue by 30%.'])
    expect(result.blocks.map((b) => b.order)).toEqual([0, 1, 2])
    expect(result.blocks.every((b) => b.page === 1 && b.position === null)).toBe(true)
    expect(result.blocks.every((b) => b.kind === 'paragraph')).toBe(true)
  })

  it('flags a fully-bold paragraph with styleHint bold', async () => {
    const docx = await buildMinimalDocx([{ text: 'Experience', bold: true }, { text: 'Regular text' }])
    const extractor = new DocxDocumentExtractor()
    const result = await extractor.extract(docx, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')

    expect(result.blocks[0].styleHint).toBe('bold')
    expect(result.blocks[1].styleHint).toBe('normal')
  })

  it('fullText is a newline join of the extracted blocks', async () => {
    const docx = await buildMinimalDocx([{ text: 'Line one' }, { text: 'Line two' }])
    const extractor = new DocxDocumentExtractor()
    const result = await extractor.extract(docx, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    expect(result.fullText).toBe('Line one\nLine two')
  })

  it('throws DocumentExtractionError for corrupt/non-docx bytes', async () => {
    const extractor = new DocxDocumentExtractor()
    const garbage = new TextEncoder().encode('not a docx file').buffer as ArrayBuffer
    await expect(
      extractor.extract(garbage, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
    ).rejects.toThrow(DocumentExtractionError)
  })

  it('throws DocumentExtractionError for an unsupported mime type', async () => {
    const extractor = new DocxDocumentExtractor()
    const docx = await buildMinimalDocx([{ text: 'x' }])
    await expect(extractor.extract(docx, 'text/plain')).rejects.toThrow(DocumentExtractionError)
  })
})
