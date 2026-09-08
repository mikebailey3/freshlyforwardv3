import { buildMultiBlockProposal } from './helpers'
import type { DetectedSection, ExtractedBlock } from '../types'
import type { ResumeFieldProposal } from '@/types/resume'

/**
 * The highest-risk deterministic piece: splitting an employment section's
 * blocks into per-role entries. Rather than pattern-matching every
 * possible "Title at Company" / "Company - Title" / date-position
 * permutation individually (fragile, format-count explodes), this
 * classifies each block as either header-shaped (short, no trailing
 * sentence punctuation -- a title/company/date line, in any order, on
 * any number of separate lines) or description-shaped (a bullet, or a
 * sentence-punctuated/long paragraph line). A new entry starts whenever a
 * header-shaped block arrives after an entry already has both header and
 * description content -- this handles every corpus variation (separate
 * lines in either order, same-line title+company, positionally-separate
 * dates, bullets, paragraphs, and repeated employers for internal
 * promotions) without a title/company-specific regex needing to match
 * every format.
 */
function looksLikeDescriptionLine(block: ExtractedBlock): boolean {
  if (block.kind === 'list-item') return true
  const text = block.text.trim()
  if (text.endsWith('.') && text.split(/\s+/).length > 3) return true
  if (block.kind === 'paragraph' && text.length > 60) return true
  return false
}

function splitIntoEntries(blocks: ExtractedBlock[]): ExtractedBlock[][] {
  const entries: ExtractedBlock[][] = []
  let headerBlocks: ExtractedBlock[] = []
  let descriptionBlocks: ExtractedBlock[] = []

  for (const block of blocks) {
    if (!looksLikeDescriptionLine(block)) {
      if (headerBlocks.length > 0 && descriptionBlocks.length > 0) {
        entries.push([...headerBlocks, ...descriptionBlocks])
        headerBlocks = []
        descriptionBlocks = []
      }
      headerBlocks.push(block)
    } else {
      descriptionBlocks.push(block)
    }
  }
  if (headerBlocks.length > 0) entries.push([...headerBlocks, ...descriptionBlocks])

  return entries
}

export function extractEmployment(sections: DetectedSection[], sourceDocumentId: string): ResumeFieldProposal[] {
  const section = sections.find((s) => s.kind === 'employment')
  if (!section) return []

  return splitIntoEntries(section.blocks).map((entryBlocks) =>
    buildMultiBlockProposal({
      destination: { kind: 'canonical-profile-array', field: 'employment_history', index: 'append' },
      confidence: 'medium', // entry-boundary heuristic can misfire on unusual formats -- never treated as unambiguous
      sourceDocumentId,
      sectionKind: section.kind,
      blocks: entryBlocks,
      matchedRule: 'EMPLOYMENT_HEADER_DESCRIPTION_SPLIT',
    }),
  )
}
