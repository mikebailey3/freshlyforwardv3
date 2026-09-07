import { extractEmail } from './fieldExtractors/email'
import { extractPhone } from './fieldExtractors/phone'
import { extractName } from './fieldExtractors/name'
import { extractLocation } from './fieldExtractors/location'
import { extractSummary } from './fieldExtractors/summary'
import { extractEmployment } from './fieldExtractors/employment'
import { extractEducation } from './fieldExtractors/education'
import { extractCertifications } from './fieldExtractors/certifications'
import { extractSkills } from './fieldExtractors/skills'
import type { DetectedSection, ExtractedDocument } from './types'
import type { ResumeFieldMapper, ResumeFieldProposal } from '@/types/resume'

/**
 * Phase 2's only ResumeFieldMapper implementation. Purely a composition
 * of the nine independent field extractors -- no shared state, no field
 * depends on another field's output, so this orchestrator has nothing to
 * test beyond "did it call all nine and concatenate the results" (see
 * fieldMapper.test.ts); the real logic/risk lives in each extractor's own
 * test file.
 */
export class DeterministicResumeFieldMapper implements ResumeFieldMapper {
  map(sections: DetectedSection[], _document: ExtractedDocument, sourceDocumentId = 'unknown'): Promise<ResumeFieldProposal[]> {
    const proposals: ResumeFieldProposal[] = [
      ...extractName(sections, sourceDocumentId),
      ...extractEmail(sections, sourceDocumentId),
      ...extractPhone(sections, sourceDocumentId),
      ...extractLocation(sections, sourceDocumentId),
      ...extractSummary(sections, sourceDocumentId),
      ...extractEmployment(sections, sourceDocumentId),
      ...extractEducation(sections, sourceDocumentId),
      ...extractCertifications(sections, sourceDocumentId),
      ...extractSkills(sections, sourceDocumentId),
    ]
    return Promise.resolve(proposals)
  }
}
