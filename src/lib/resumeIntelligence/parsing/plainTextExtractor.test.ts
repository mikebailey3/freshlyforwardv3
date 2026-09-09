import { describe, expect, it } from 'vitest'
import { PlainTextExtractor } from './plainTextExtractor'
import { DocumentExtractionError } from './types'

function toArrayBuffer(text: string): ArrayBuffer {
  return new TextEncoder().encode(text).buffer as ArrayBuffer
}

describe('PlainTextExtractor', () => {
  it('declares text/plain as its only supported mime type', () => {
    const extractor = new PlainTextExtractor()
    expect(extractor.supportedMimeTypes).toEqual(['text/plain'])
  })

  it('splits lines into ordered line blocks, page 1, no position', async () => {
    const extractor = new PlainTextExtractor()
    const result = await extractor.extract(toArrayBuffer('Jamie Rivera\njamie@example.com\n555-123-4567'), 'text/plain')

    expect(result.sourceMimeType).toBe('text/plain')
    expect(result.fullText).toBe('Jamie Rivera\njamie@example.com\n555-123-4567')
    expect(result.blocks).toHaveLength(3)
    expect(result.blocks[0]).toEqual({ order: 0, kind: 'line', text: 'Jamie Rivera', page: 1, position: null, styleHint: null })
    expect(result.blocks[1].text).toBe('jamie@example.com')
    expect(result.blocks[2].text).toBe('555-123-4567')
    expect(result.warnings).toEqual([])
  })

  it('skips blank lines rather than producing empty blocks', async () => {
    const extractor = new PlainTextExtractor()
    const result = await extractor.extract(toArrayBuffer('Line one\n\n\nLine two'), 'text/plain')
    expect(result.blocks.map((b) => b.text)).toEqual(['Line one', 'Line two'])
    expect(result.blocks.map((b) => b.order)).toEqual([0, 1])
  })

  it('produces an empty blocks array for empty input, not an error', async () => {
    const extractor = new PlainTextExtractor()
    const result = await extractor.extract(toArrayBuffer(''), 'text/plain')
    expect(result.blocks).toEqual([])
    expect(result.fullText).toBe('')
  })

  it('throws DocumentExtractionError for an unsupported mime type', async () => {
    const extractor = new PlainTextExtractor()
    await expect(extractor.extract(toArrayBuffer('x'), 'application/pdf')).rejects.toThrow(DocumentExtractionError)
  })
})
