import { beforeEach, describe, expect, it } from 'vitest'
import { PlainTextExtractor } from './plainTextExtractor'
import { DeterministicSectionDetector } from './sectionDetector'
import { DeterministicResumeFieldMapper } from './fieldMapper'
import { resetProposalIdCounter } from './fieldExtractors/helpers'
import type { ExtractedDocument } from './types'

/**
 * Cross-cutting proof that the deterministic parsing pipeline never
 * invents career information -- required by the Phase 2 parser design
 * ("For every extracted candidate... avoid magic classification that
 * cannot explain its evidence"). Exercises the real extractor -> section
 * detector -> field mapper pipeline end to end, not individual units.
 */
async function pipeline(text: string): Promise<{ document: ExtractedDocument; proposals: Awaited<ReturnType<DeterministicResumeFieldMapper['map']>> }> {
  const document = await new PlainTextExtractor().extract(new TextEncoder().encode(text).buffer as ArrayBuffer, 'text/plain')
  const sections = new DeterministicSectionDetector().detect(document)
  const proposals = await new DeterministicResumeFieldMapper().map(sections, document, 'doc-1')
  return { document, proposals }
}

const REALISTIC_RESUME = [
  'Jamie Rivera',
  'jamie@example.com',
  '555-123-4567',
  'Denver, CO',
  'Summary',
  'Product leader focused on measurable outcomes.',
  'Experience',
  'Senior Product Manager, Initech Corp, 2021 - Present',
  'Grew revenue by 30%.',
  'Reduced churn by 12%.',
  'Education',
  'State University',
  'B.A. Economics, 2015',
  'Certifications',
  'PMP, Project Management Institute, 2022',
  'Skills',
  'SQL, Product Strategy, Roadmapping',
].join('\n')

describe('anti-fabrication: source excerpts are literal', () => {
  beforeEach(() => resetProposalIdCounter())

  it('every provenance.sourceExcerpt is a literal substring of the text of at least one referenced block', async () => {
    const { document, proposals } = await pipeline(REALISTIC_RESUME)
    expect(proposals.length).toBeGreaterThan(0)

    for (const proposal of proposals) {
      const referencedBlocks = document.blocks.filter((b) => proposal.provenance.blockOrders.includes(b.order))
      expect(referencedBlocks.length).toBeGreaterThan(0)
      // The excerpt must be reconstructable from the referenced blocks' own text -- never a value pulled from elsewhere.
      const referencedText = referencedBlocks.map((b) => b.text).join('\n')
      const excerptLines = proposal.provenance.sourceExcerpt.split('\n')
      for (const line of excerptLines) {
        expect(referencedText).toContain(line.trim())
      }
    }
  })

  it('every candidateValue derives only from the referenced blocks’ literal text -- never from anything outside them', async () => {
    const { document, proposals } = await pipeline(REALISTIC_RESUME)
    for (const proposal of proposals) {
      const referencedBlocks = document.blocks.filter((b) => proposal.provenance.blockOrders.includes(b.order))
      const referencedText = referencedBlocks.map((b) => b.text).join('\n')
      for (const line of proposal.candidateValue.split('\n')) {
        expect(referencedText).toContain(line.trim())
      }
    }
  })
})

describe('anti-fabrication: no invented facts', () => {
  beforeEach(() => resetProposalIdCounter())

  it('a statement with no email never produces an email proposal', async () => {
    const { proposals } = await pipeline('Jamie Rivera\nExperience\nLed a team.')
    expect(proposals.some((p) => p.destination.kind === 'canonical-profile' && p.destination.field === 'email')).toBe(false)
  })

  it('a statement with no phone-shaped text never produces a phone proposal', async () => {
    const { proposals } = await pipeline('Jamie Rivera\njamie@example.com')
    expect(proposals.some((p) => p.destination.kind === 'canonical-profile' && p.destination.field === 'phone')).toBe(false)
  })

  it('no proposal’s candidateValue contains a number that is not present anywhere in the source document', async () => {
    const { document, proposals } = await pipeline(REALISTIC_RESUME)
    const fullTextDigits = new Set(document.fullText.match(/\d+/g) ?? [])
    for (const proposal of proposals) {
      const candidateDigits = proposal.candidateValue.match(/\d+/g) ?? []
      for (const digit of candidateDigits) {
        expect(fullTextDigits.has(digit)).toBe(true)
      }
    }
  })

  it('an employment section with only vague, unquantified text produces no fabricated metric in any candidate', async () => {
    const { proposals } = await pipeline('Jamie Rivera\nExperience\nWarehouse Lead, Acme Co, 2020 - 2021\nImproved team morale and communication.')
    const employmentProposal = proposals.find((p) => p.destination.kind === 'canonical-profile-array' && p.destination.field === 'employment_history')
    expect(employmentProposal).toBeDefined()
    expect(employmentProposal?.candidateValue).not.toMatch(/\d+%|\$\d+/)
  })
})

describe('anti-fabrication: ambiguity degrades confidence or yields no candidate, never a confident guess', () => {
  beforeEach(() => resetProposalIdCounter())

  it('multiple competing emails degrade to low confidence rather than one being silently preferred without cause', async () => {
    const { proposals } = await pipeline('Jamie Rivera\njamie@example.com or jamie.rivera@work.com')
    const emailProposals = proposals.filter((p) => p.destination.kind === 'canonical-profile' && p.destination.field === 'email')
    expect(emailProposals.length).toBe(2)
    expect(emailProposals.every((p) => p.confidence === 'low')).toBe(true)
  })

  it('the name heuristic never reaches high confidence -- documented as medium-at-best in Phase 2', async () => {
    const { proposals } = await pipeline(REALISTIC_RESUME)
    const nameProposal = proposals.find((p) => p.destination.kind === 'canonical-profile' && p.destination.field === 'full_name')
    expect(nameProposal?.confidence).toBe('medium')
  })

  it('a document with no detectable structure at all produces zero employment/education candidates rather than a guess', async () => {
    const { proposals } = await pipeline('Some unstructured text with no resume-like shape at all.')
    expect(proposals.some((p) => p.destination.kind === 'canonical-profile-array' && p.destination.field === 'employment_history')).toBe(false)
    expect(proposals.some((p) => p.destination.kind === 'canonical-profile-array' && p.destination.field === 'education')).toBe(false)
  })
})

describe('anti-fabrication: unknown content is preserved, not silently dropped or reassigned', () => {
  it('content under an unrecognized heading is kept in an unknown-kind section, not merged into a known one', () => {
    const blocks = [
      { order: 0, kind: 'line' as const, text: 'Jamie Rivera', page: 1, position: null, styleHint: null },
      { order: 1, kind: 'line' as const, text: 'Volunteer Work', page: 1, position: null, styleHint: 'bold' as const },
      { order: 2, kind: 'line' as const, text: 'Soup kitchen, weekly.', page: 1, position: null, styleHint: null },
    ]
    const document: ExtractedDocument = { sourceMimeType: 'text/plain', fullText: blocks.map((b) => b.text).join('\n'), blocks, warnings: [] }
    const sections = new DeterministicSectionDetector().detect(document)

    const unknownSection = sections.find((s) => s.kind === 'unknown')
    expect(unknownSection).toBeDefined()
    expect(unknownSection?.blocks.map((b) => b.text)).toEqual(['Soup kitchen, weekly.'])
    // Confirm the total block count across all sections equals the input -- nothing dropped.
    const totalBlocks = sections.reduce((sum, s) => sum + s.blocks.length, 0)
    expect(totalBlocks).toBe(blocks.length - 1) // -1 for the heading block itself, which becomes headingText, not a content block
  })
})
