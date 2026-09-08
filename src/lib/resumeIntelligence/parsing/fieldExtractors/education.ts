import { buildMultiBlockProposal } from './helpers'
import type { DetectedSection, ExtractedBlock } from '../types'
import type { ResumeFieldProposal } from '@/types/resume'

// Education entries rarely have employment's header/description shape (bullets, sentence-punctuated
// duty lines) -- they're usually 1-2 short lines per entry. Anchor on an institution-name keyword
// instead: a block containing one starts a new entry; everything until the next such block belongs
// to it. Narrower than employment's structural split -- a format that never uses one of these words
// produces zero candidates rather than a guess (documented Phase 2 limitation, not solved here).
const INSTITUTION_KEYWORD_RE = /\b(University|College|Institute|School|Academy)\b/i

function splitIntoEntries(blocks: ExtractedBlock[]): ExtractedBlock[][] {
  const entries: ExtractedBlock[][] = []
  let current: ExtractedBlock[] | null = null

  for (const block of blocks) {
    if (INSTITUTION_KEYWORD_RE.test(block.text)) {
      if (current) entries.push(current)
      current = [block]
    } else if (current) {
      current.push(block)
    }
  }
  if (current) entries.push(current)

  return entries
}

export function extractEducation(sections: DetectedSection[], sourceDocumentId: string): ResumeFieldProposal[] {
  const section = sections.find((s) => s.kind === 'education')
  if (!section) return []

  return splitIntoEntries(section.blocks).map((entryBlocks) =>
    buildMultiBlockProposal({
      destination: { kind: 'canonical-profile-array', field: 'education', index: 'append' },
      confidence: 'medium',
      sourceDocumentId,
      sectionKind: section.kind,
      blocks: entryBlocks,
      matchedRule: 'EDUCATION_INSTITUTION_KEYWORD_SPLIT',
    }),
  )
}
