import { beforeEach, describe, expect, it } from 'vitest'
import { DeterministicSectionDetector } from './sectionDetector'
import type { ExtractedBlock, ExtractedDocument } from './types'

let nextOrder = 0
function block(text: string, overrides: Partial<ExtractedBlock> = {}): ExtractedBlock {
  return { order: nextOrder++, kind: 'line', text, page: 1, position: null, styleHint: null, ...overrides }
}
function doc(blocks: ExtractedBlock[]): ExtractedDocument {
  return { sourceMimeType: 'text/plain', fullText: blocks.map((b) => b.text).join('\n'), blocks, warnings: [] }
}

describe('DeterministicSectionDetector', () => {
  beforeEach(() => {
    nextOrder = 0
  })

  it('puts everything before the first heading into the implicit contact section', () => {
    const blocks = [block('Jamie Rivera'), block('jamie@example.com'), block('EXPERIENCE', { styleHint: 'bold' })]
    const sections = new DeterministicSectionDetector().detect(doc(blocks))

    expect(sections[0].kind).toBe('contact')
    expect(sections[0].headingText).toBeNull()
    expect(sections[0].matchedRule).toBeNull()
    expect(sections[0].blocks.map((b) => b.text)).toEqual(['Jamie Rivera', 'jamie@example.com'])
  })

  it('matches known heading keywords case-insensitively', () => {
    const blocks = [
      block('Jamie Rivera'),
      block('experience', { styleHint: 'bold' }),
      block('Grew revenue 30%.'),
      block('Education', { styleHint: 'bold' }),
      block('State University'),
    ]
    const sections = new DeterministicSectionDetector().detect(doc(blocks))

    expect(sections.map((s) => s.kind)).toEqual(['contact', 'employment', 'education'])
    expect(sections[1].headingText).toBe('experience')
    expect(sections[1].matchedRule).toBe('HEADING_KEYWORD_EMPLOYMENT')
    expect(sections[1].blocks.map((b) => b.text)).toEqual(['Grew revenue 30%.'])
    expect(sections[2].blocks.map((b) => b.text)).toEqual(['State University'])
  })

  it('recognizes common heading variants for each known section', () => {
    const blocks = [
      block('WORK EXPERIENCE', { styleHint: 'bold' }), block('a'),
      block('SKILLS', { styleHint: 'bold' }), block('b'),
      block('CERTIFICATIONS', { styleHint: 'bold' }), block('c'),
      block('SUMMARY', { styleHint: 'bold' }), block('d'),
    ]
    const sections = new DeterministicSectionDetector().detect(doc(blocks))
    // first section is the (empty) implicit contact section
    expect(sections.map((s) => s.kind)).toEqual(['contact', 'employment', 'skills', 'certifications', 'summary'])
  })

  it('treats a short, standalone bold/large line as a heading even without a known keyword match, tagged unknown', () => {
    const blocks = [block('Jamie Rivera'), block('Volunteer Work', { styleHint: 'bold' }), block('Soup kitchen, weekly.')]
    const sections = new DeterministicSectionDetector().detect(doc(blocks))

    expect(sections[1].kind).toBe('unknown')
    expect(sections[1].headingText).toBe('Volunteer Work')
    expect(sections[1].matchedRule).toBe('STYLE_HINT_STANDALONE_SHORT')
  })

  it('does not treat a long bold sentence as a heading', () => {
    const blocks = [block('This is a much longer bold sentence that reads like emphasized body text, not a heading', { styleHint: 'bold' })]
    const sections = new DeterministicSectionDetector().detect(doc(blocks))
    expect(sections).toHaveLength(1)
    expect(sections[0].kind).toBe('contact')
  })

  it('never drops content -- a document with no headings at all becomes one contact section with everything', () => {
    const blocks = [block('Some resume text with no clear structure.'), block('More text.')]
    const sections = new DeterministicSectionDetector().detect(doc(blocks))
    expect(sections).toHaveLength(1)
    expect(sections[0].kind).toBe('contact')
    expect(sections[0].blocks).toHaveLength(2)
  })

  it('handles an empty document without error, returning no sections', () => {
    const sections = new DeterministicSectionDetector().detect(doc([]))
    expect(sections).toEqual([])
  })
})
