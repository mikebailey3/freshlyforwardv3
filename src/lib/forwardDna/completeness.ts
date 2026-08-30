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
