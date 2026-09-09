import { beforeEach, describe, expect, it } from 'vitest'
import { DeterministicResumeFieldMapper } from './fieldMapper'
import { resetProposalIdCounter } from './fieldExtractors/helpers'
import { DeterministicSectionDetector } from './sectionDetector'
import { PlainTextExtractor } from './plainTextExtractor'

describe('DeterministicResumeFieldMapper', () => {
  beforeEach(() => resetProposalIdCounter())

  it('produces proposals across every field category from a realistic plain-text resume', async () => {
    const text = [
      'Jamie Rivera',
      'jamie@example.com',
      '555-123-4567',
      'Denver, CO',
      'Summary',
      'Product leader focused on measurable outcomes.',
      'Experience',
      'Senior Product Manager, Initech Corp, 2021 - Present',
      'Grew revenue by 30%.',
      'Education',
      'State University',
      'B.A. Economics, 2015',
      'Certifications',
      'PMP, Project Management Institute, 2022',
      'Skills',
      'SQL, Product Strategy, Roadmapping',
    ].join('\n')

    const extractor = new PlainTextExtractor()
    const document = await extractor.extract(new TextEncoder().encode(text).buffer as ArrayBuffer, 'text/plain')
    const sections = new DeterministicSectionDetector().detect(document)

    const mapper = new DeterministicResumeFieldMapper()
    const proposals = await mapper.map(sections, document)

    const destinationFields = proposals.map((p) => ('field' in p.destination ? p.destination.field : null))
    expect(destinationFields).toContain('full_name')
    expect(destinationFields).toContain('email')
    expect(destinationFields).toContain('phone')
    expect(destinationFields).toContain('location')
    expect(destinationFields).toContain('summary_override')
    expect(destinationFields).toContain('employment_history')
    expect(destinationFields).toContain('education')
    expect(destinationFields).toContain('certifications')
    expect(destinationFields).toContain('skills')
  })

  it('every proposal carries the given sourceDocumentId', async () => {
    const extractor = new PlainTextExtractor()
    const document = await extractor.extract(new TextEncoder().encode('Jamie Rivera\njamie@example.com').buffer as ArrayBuffer, 'text/plain')
    const sections = new DeterministicSectionDetector().detect(document)
    const proposals = await new DeterministicResumeFieldMapper().map(sections, document, 'doc-42')
    expect(proposals.length).toBeGreaterThan(0)
    expect(proposals.every((p) => p.provenance.sourceDocumentId === 'doc-42')).toBe(true)
  })

  it('returns an empty array for an empty document rather than erroring', async () => {
    const extractor = new PlainTextExtractor()
    const document = await extractor.extract(new TextEncoder().encode('').buffer as ArrayBuffer, 'text/plain')
    const sections = new DeterministicSectionDetector().detect(document)
    const proposals = await new DeterministicResumeFieldMapper().map(sections, document)
    expect(proposals).toEqual([])
  })
})
