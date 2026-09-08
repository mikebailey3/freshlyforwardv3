import { evaluateAtsReadability } from './atsReadability'
import { evaluateContentStrength } from './contentStrength'
import { evaluateQuantification } from './quantification'
import { evaluateStructuralQuality } from './structuralQuality'
import { NullTargetRoleAlignmentProvider } from './alignment'
import { NullEvidenceCoverageProvider } from './evidenceCoverage'
import type { ResumeContentInput } from './types'
import type {
  EvidenceCoverageProvider,
  ResumeIntelligenceResult,
  TargetRoleAlignmentProvider,
} from '@/types/resume'

export type { ResumeContentInput } from './types'
export { evaluateAtsReadability } from './atsReadability'
export { evaluateStructuralQuality } from './structuralQuality'
export { evaluateContentStrength } from './contentStrength'
export { evaluateQuantification } from './quantification'
export { NullTargetRoleAlignmentProvider } from './alignment'
export { NullEvidenceCoverageProvider } from './evidenceCoverage'
export { scoreFromFindings } from './score'

export interface ComputeResumeIntelligenceOptions {
  userId: string
  targetRole?: string | null
  opportunityId?: string | null
  /** DI, same convention as the rest of the codebase (e.g. `client: SupabaseClient = defaultClient`). Defaults to the honest "unavailable" null provider. */
  alignmentProvider?: TargetRoleAlignmentProvider
  /** DI. Defaults to the honest "unavailable" null provider until Career Vault ships. */
  evidenceProvider?: EvidenceCoverageProvider
}

/**
 * Computes all six Resume Intelligence dimensions. Deliberately returns
 * an array of independently-scored/explained dimensions, never a
 * top-level blended score (locked "no universal resume score" decision)
 * -- see src/types/resume.ts#ResumeIntelligenceResult.
 *
 * atsReadability/structuralQuality/contentStrength/quantification are
 * fully deterministic and always scored. targetRoleAlignment/
 * evidenceCoverage depend on FreshFit and Career Vault respectively,
 * neither wired yet in Phase 1 -- they report 'unavailable' via the
 * default null providers unless a real provider is injected.
 */
export async function computeResumeIntelligence(
  content: ResumeContentInput,
  options: ComputeResumeIntelligenceOptions,
): Promise<ResumeIntelligenceResult> {
  const alignmentProvider = options.alignmentProvider ?? new NullTargetRoleAlignmentProvider()
  const evidenceProvider = options.evidenceProvider ?? new NullEvidenceCoverageProvider()

  const [alignment, evidenceCoverage] = await Promise.all([
    alignmentProvider.score({
      resumeSkills: content.skills,
      targetRole: options.targetRole ?? null,
      opportunityId: options.opportunityId ?? null,
    }),
    evidenceProvider.score({
      userId: options.userId,
      claimedSkills: content.skills,
    }),
  ])

  return {
    dimensions: [
      evaluateAtsReadability(content),
      evaluateStructuralQuality(content),
      evaluateContentStrength(content),
      evaluateQuantification(content),
      alignment,
      evidenceCoverage,
    ],
  }
}
