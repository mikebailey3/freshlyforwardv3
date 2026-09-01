import type { MemberProfile } from '@/types'
import type { CareerScope, CareerResponsibility, CareerSkill } from '@/types/forwardDna'

export interface ForwardDnaCompletenessInput {
  hasCareerCompassResult: boolean
  hasScopeEntry: boolean
  hasResponsibilityTag: boolean
  hasSkillEvidenceBeyondClaimed: boolean
  hasEducationOrCertifications: boolean
  hasTargetRoleAndTimeframe: boolean
}

interface CompletenessCheck {
  key: keyof ForwardDnaCompletenessInput
  label: string
  weight: number
}

const completenessChecks: CompletenessCheck[] = [
  { key: 'hasCareerCompassResult', label: 'Career Compass result', weight: 20 },
  { key: 'hasScopeEntry', label: 'Professional scope on at least one role', weight: 20 },
  { key: 'hasResponsibilityTag', label: 'Responsibilities on at least one role', weight: 15 },
  { key: 'hasSkillEvidenceBeyondClaimed', label: 'At least one skill with evidence', weight: 15 },
  { key: 'hasEducationOrCertifications', label: 'Education or certifications', weight: 15 },
  { key: 'hasTargetRoleAndTimeframe', label: 'Career goal target role and timeframe', weight: 15 },
]

export function calculateForwardDnaCompleteness(
  input: ForwardDnaCompletenessInput
): { score: number; missing: { key: string; label: string }[] } {
  let earned = 0
  let total = 0
  const missing: { key: string; label: string }[] = []

  for (const check of completenessChecks) {
    total += check.weight
    if (input[check.key]) {
      earned += check.weight
    } else {
      missing.push({ key: check.key, label: check.label })
    }
  }

  return { score: Math.round((earned / total) * 100), missing }
}

/**
 * Pure derivation of a ForwardDnaCompletenessInput from the raw Forward
 * DNA data sources. Extracted so both ForwardDnaPage.tsx (rendering the
 * completeness widget) and useForwardScore (computing the Forward DNA
 * Depth pillar) share one derivation instead of two copies that could
 * silently drift apart.
 */
export function buildForwardDnaCompletenessInput(
  profile: Pick<MemberProfile, 'education' | 'certifications' | 'target_role' | 'target_timeframe'>,
  scope: CareerScope[],
  responsibilities: CareerResponsibility[],
  skills: CareerSkill[],
  hasCareerCompassResult: boolean
): ForwardDnaCompletenessInput {
  return {
    hasCareerCompassResult,
    hasScopeEntry: scope.length > 0,
    hasResponsibilityTag: responsibilities.length > 0,
    hasSkillEvidenceBeyondClaimed: skills.some((s) => s.state !== 'claimed'),
    hasEducationOrCertifications:
      (profile.education?.length ?? 0) > 0 || (profile.certifications?.length ?? 0) > 0,
    hasTargetRoleAndTimeframe: !!profile.target_role && !!profile.target_timeframe,
  }
}
