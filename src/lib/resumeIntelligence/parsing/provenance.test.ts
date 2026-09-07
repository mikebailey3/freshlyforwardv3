import { describe, expect, it } from 'vitest'
import { describeProvenance } from './provenance'
import type { ResumeFieldProvenance } from '@/types/resume'

describe('describeProvenance', () => {
  it('derives a human-readable string from the structured fields, including page when known', () => {
    const p: ResumeFieldProvenance = {
      sourceDocumentId: 'doc-1',
      sectionKind: 'contact',
      blockOrders: [1],
      sourceExcerpt: 'jamie@example.com',
      page: 1,
      matchedRule: 'EMAIL_REGEX_MATCH',
    }
    expect(describeProvenance(p)).toBe(
      'From the contact section, page 1 — matched rule EMAIL_REGEX_MATCH — source: "jamie@example.com"',
    )
  })

  it('omits the page clause when page is null (e.g. a DOCX/TXT source with no page concept)', () => {
    const p: ResumeFieldProvenance = {
      sourceDocumentId: 'doc-1',
      sectionKind: 'skills',
      blockOrders: [4],
      sourceExcerpt: 'SQL',
      page: null,
      matchedRule: 'SKILL_TOKEN_SPLIT',
    }
    expect(describeProvenance(p)).toBe('From the skills section — matched rule SKILL_TOKEN_SPLIT — source: "SQL"')
  })
})
