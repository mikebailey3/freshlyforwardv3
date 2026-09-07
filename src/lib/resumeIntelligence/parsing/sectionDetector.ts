import type { DetectedSection, ExtractedBlock, ExtractedDocument, ResumeSectionKind, SectionDetector } from './types'

interface HeadingRule {
  pattern: RegExp
  kind: ResumeSectionKind
  code: string
}

/**
 * Deterministic rule table, same shape as Career Vault's capability
 * engine ({ pattern, ... }[]). A block is a section boundary if its text
 * matches one of these keyword patterns.
 */
const HEADING_RULES: HeadingRule[] = [
  { pattern: /^(work\s+)?experience$|^employment(\s+history)?$/i, kind: 'employment', code: 'HEADING_KEYWORD_EMPLOYMENT' },
  { pattern: /^education$/i, kind: 'education', code: 'HEADING_KEYWORD_EDUCATION' },
  { pattern: /^skills$/i, kind: 'skills', code: 'HEADING_KEYWORD_SKILLS' },
  { pattern: /^certifications?$/i, kind: 'certifications', code: 'HEADING_KEYWORD_CERTIFICATIONS' },
  { pattern: /^(summary|profile|objective)$/i, kind: 'summary', code: 'HEADING_KEYWORD_SUMMARY' },
]

const MAX_STYLE_HEADING_LENGTH = 40

function matchHeadingRule(text: string): HeadingRule | null {
  const trimmed = text.trim()
  return HEADING_RULES.find((rule) => rule.pattern.test(trimmed)) ?? null
}

function looksLikeStandaloneHeading(block: ExtractedBlock): boolean {
  return (block.styleHint === 'bold' || block.styleHint === 'large') && block.text.trim().length < MAX_STYLE_HEADING_LENGTH
}

export class DeterministicSectionDetector implements SectionDetector {
  detect(document: ExtractedDocument): DetectedSection[] {
    const sections: DetectedSection[] = []
    let current: DetectedSection = { kind: 'contact', headingText: null, blocks: [], matchedRule: null }

    for (const block of document.blocks) {
      const keywordRule = matchHeadingRule(block.text)

      if (keywordRule) {
        sections.push(current)
        current = { kind: keywordRule.kind, headingText: block.text.trim(), blocks: [], matchedRule: keywordRule.code }
        continue
      }

      if (looksLikeStandaloneHeading(block)) {
        sections.push(current)
        current = { kind: 'unknown', headingText: block.text.trim(), blocks: [], matchedRule: 'STYLE_HINT_STANDALONE_SHORT' }
        continue
      }

      current.blocks.push(block)
    }
    sections.push(current)

    // Drop the implicit leading contact section only if a document has
    // zero blocks at all -- an empty document is zero sections, not one
    // meaningless empty one. A document with real content always keeps
    // its (possibly empty) contact section: content is never dropped.
    if (document.blocks.length === 0) return []
    return sections
  }
}
