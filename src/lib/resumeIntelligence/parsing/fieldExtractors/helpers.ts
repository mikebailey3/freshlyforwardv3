import { hasMetric } from '@/lib/textQuality'
import type { ExtractedBlock, ResumeSectionKind } from '../types'
import type { ProposalConfidence, ProposalDestination, ResumeFieldProposal } from '@/types/resume'

let nextProposalId = 0
/** Test-visible reset so proposal ids are deterministic across test runs. */
export function resetProposalIdCounter(): void {
  nextProposalId = 0
}

export interface BuildProposalInput {
  candidateValue: string
  destination: ProposalDestination
  confidence: ProposalConfidence
  sourceDocumentId: string
  sectionKind: ResumeSectionKind
  block: Pick<ExtractedBlock, 'order' | 'page'>
  /** The literal substring of block.text this candidate was derived from -- must always be a real substring, never invented. */
  sourceExcerpt: string
  matchedRule: string
  proposedAction?: ResumeFieldProposal['proposedAction']
}

export function buildProposal(input: BuildProposalInput): ResumeFieldProposal {
  return {
    id: `proposal-${nextProposalId++}`,
    candidateValue: input.candidateValue,
    destination: input.destination,
    confidence: input.confidence,
    proposedAction: input.proposedAction ?? 'create',
    provenance: {
      sourceDocumentId: input.sourceDocumentId,
      sectionKind: input.sectionKind,
      blockOrders: [input.block.order],
      sourceExcerpt: input.sourceExcerpt,
      page: input.block.page,
      matchedRule: input.matchedRule,
    },
  }
}

export interface BuildMultiBlockProposalInput {
  destination: ProposalDestination
  confidence: ProposalConfidence
  sourceDocumentId: string
  sectionKind: ResumeSectionKind
  /** All blocks this candidate was assembled from, in order. candidateValue/sourceExcerpt are their joined text; blockOrders/page are taken from the full set. */
  blocks: ExtractedBlock[]
  matchedRule: string
}

/** For candidates spanning multiple blocks (employment/education entries) -- avoids the single-block assumption `buildProposal` makes. */
export function buildMultiBlockProposal(input: BuildMultiBlockProposalInput): ResumeFieldProposal {
  const joined = input.blocks.map((b) => b.text.trim()).join('\n')
  return {
    id: `proposal-${nextProposalId++}`,
    candidateValue: joined,
    destination: input.destination,
    confidence: input.confidence,
    proposedAction: 'create',
    provenance: {
      sourceDocumentId: input.sourceDocumentId,
      sectionKind: input.sectionKind,
      blockOrders: input.blocks.map((b) => b.order),
      sourceExcerpt: joined,
      page: input.blocks[0]?.page ?? null,
      matchedRule: input.matchedRule,
    },
  }
}

export { hasMetric }
