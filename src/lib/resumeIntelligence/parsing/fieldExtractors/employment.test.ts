import { beforeEach, describe, expect, it } from 'vitest'
import { extractEmployment } from './employment'
import { resetProposalIdCounter } from './helpers'
import type { DetectedSection, ExtractedBlock, ExtractedBlockKind } from '../types'

let order = 0
function block(text: string, kind: ExtractedBlockKind = 'line'): ExtractedBlock {
  return { order: order++, kind, text, page: 1, position: null, styleHint: null }
}
function employmentSection(blocks: ExtractedBlock[]): DetectedSection {
  return { kind: 'employment', headingText: 'Experience', blocks, matchedRule: 'HEADING_KEYWORD_EMPLOYMENT' }
}

/**
 * Employment-entry splitting corpus. All fixtures below use fabricated
 * people/companies (Jordan Ellis, Initech Corp, Northwind Traders, etc.)
 * -- no real member/user resumes are checked into this repo, per the
 * locked requirement.
 */
describe('extractEmployment', () => {
  beforeEach(() => {
    order = 0
    resetProposalIdCounter()
  })

  it('1. title -> company -> dates on separate lines', () => {
    const section = employmentSection([
      block('Senior Product Manager'),
      block('Initech Corp'),
      block('Jan 2021 - Present'),
      block('Grew revenue by 30%.'),
    ])
    const proposals = extractEmployment([section], 'doc-1')
    expect(proposals).toHaveLength(1)
    expect(proposals[0].candidateValue).toContain('Senior Product Manager')
    expect(proposals[0].candidateValue).toContain('Grew revenue by 30%')
    expect(proposals[0].destination).toEqual({ kind: 'canonical-profile-array', field: 'employment_history', index: 'append' })
  })

  it('2. company -> title -> dates (reversed order)', () => {
    const section = employmentSection([
      block('Northwind Traders'),
      block('Operations Lead'),
      block('2019 - 2021'),
      block('Reduced shipping costs by 12%.'),
    ])
    const proposals = extractEmployment([section], 'doc-1')
    expect(proposals).toHaveLength(1)
    expect(proposals[0].candidateValue).toContain('Reduced shipping costs by 12%')
  })

  it('3. title and company on the same line', () => {
    const section = employmentSection([
      block('Marketing Director at Globex LLC'),
      block('Mar 2018 - Dec 2020'),
      block('Launched three national campaigns.'),
    ])
    const proposals = extractEmployment([section], 'doc-1')
    expect(proposals).toHaveLength(1)
    expect(proposals[0].candidateValue).toContain('Marketing Director at Globex LLC')
    expect(proposals[0].candidateValue).toContain('Launched three national campaigns')
  })

  it('4. dates on a separately positioned/aligned block (not adjacent in the header text itself)', () => {
    const section = employmentSection([
      block('Financial Analyst'),
      block('2020 - 2022'), // positioned as its own block, e.g. a right-aligned date column
      block('Vantage Capital'),
      block('Built a forecasting model that cut variance by 8%.'),
    ])
    const proposals = extractEmployment([section], 'doc-1')
    expect(proposals).toHaveLength(1)
    expect(proposals[0].candidateValue).toContain('Financial Analyst')
    expect(proposals[0].candidateValue).toContain('cut variance by 8%')
  })

  it('5. bullet-style experience (each accomplishment its own list-item block)', () => {
    const section = employmentSection([
      block('Support Team Lead, Helios Systems, 2021 - 2023'),
      block('Resolved 200+ tickets weekly.', 'list-item'),
      block('Trained 5 new hires.', 'list-item'),
      block('Cut average response time by 25%.', 'list-item'),
    ])
    const proposals = extractEmployment([section], 'doc-1')
    expect(proposals).toHaveLength(1)
    expect(proposals[0].candidateValue).toContain('Resolved 200+ tickets weekly')
    expect(proposals[0].candidateValue).toContain('Trained 5 new hires')
    expect(proposals[0].candidateValue).toContain('Cut average response time by 25%')
  })

  it('6. paragraph-style experience (one dense paragraph, no bullets)', () => {
    const section = employmentSection([
      block('Warehouse Supervisor, Meridian Logistics, 2017 - 2019'),
      block('Oversaw a team of 15 across two shifts, implemented a new inventory system that reduced stock discrepancies by 18%, and coordinated with vendors to shorten delivery times.', 'paragraph'),
    ])
    const proposals = extractEmployment([section], 'doc-1')
    expect(proposals).toHaveLength(1)
    expect(proposals[0].candidateValue).toContain('reduced stock discrepancies by 18%')
  })

  it('7. multiple roles at the same employer (internal promotion) -- must not merge into one entry', () => {
    const section = employmentSection([
      block('Account Manager, Solstice Media, 2018 - 2020'),
      block('Managed a portfolio of 20 client accounts.'),
      block('Senior Account Manager, Solstice Media, 2020 - Present'),
      block('Led a team of 4 account managers.'),
    ])
    const proposals = extractEmployment([section], 'doc-1')
    expect(proposals).toHaveLength(2)
    expect(proposals[0].candidateValue).toContain('Account Manager, Solstice Media, 2018 - 2020')
    expect(proposals[0].candidateValue).toContain('Managed a portfolio of 20 client accounts')
    expect(proposals[0].candidateValue).not.toContain('Led a team of 4')
    expect(proposals[1].candidateValue).toContain('Senior Account Manager, Solstice Media, 2020 - Present')
    expect(proposals[1].candidateValue).toContain('Led a team of 4 account managers')
  })

  it('8. current employment (no end date / literal "Present")', () => {
    const section = employmentSection([
      block('Data Engineer, Fathom Analytics, Jun 2022 - Present'),
      block('Built a pipeline processing 2M events/day.'),
    ])
    const proposals = extractEmployment([section], 'doc-1')
    expect(proposals).toHaveLength(1)
    expect(proposals[0].candidateValue).toContain('Jun 2022 - Present')
  })

  it('9. missing/nonstandard section headings -- no employment section detected produces zero candidates, never a guess', () => {
    const noHeadingSection: DetectedSection = {
      kind: 'unknown',
      headingText: null,
      blocks: [block('Jordan Ellis has years of experience in logistics and operations.')],
      matchedRule: null,
    }
    expect(extractEmployment([noHeadingSection], 'doc-1')).toEqual([])
  })

  it('sets confidence to medium for entry-splitting candidates -- a heuristic, not an unambiguous match', () => {
    const section = employmentSection([block('Senior Product Manager, Initech Corp, 2021 - Present'), block('Grew revenue by 30%.')])
    const proposals = extractEmployment([section], 'doc-1')
    expect(proposals[0].confidence).toBe('medium')
  })

  it('every candidateValue is traceable -- built only from literal block text, never invented', () => {
    const section = employmentSection([block('Senior Product Manager, Initech Corp, 2021 - Present'), block('Grew revenue by 30%.')])
    const proposals = extractEmployment([section], 'doc-1')
    const sourceBlocksText = section.blocks.map((b) => b.text).join(' ')
    for (const proposal of proposals) {
      for (const line of proposal.candidateValue.split('\n')) {
        expect(sourceBlocksText).toContain(line.trim())
      }
    }
  })
})
