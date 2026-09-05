/**
 * The original flat 6-field breakdown shape (skillsCoverage/roleRelevance/
 * locationFit/keywordDensity/dnaSkillEvidence/scopeFit). Duplicated here
 * (rather than importing `JobMatchScoreBreakdown` from `@/types`)
 * deliberately -- `@/types` imports FreshFit's dimension/constraint types
 * from this file to build its richer `v2` breakdown field, so this file
 * must not import back from `@/types` or the two modules would form a
 * circular dependency. Keep these fields in sync if the legacy shape
 * ever changes (it shouldn't -- it's frozen for backward compatibility).
 */
export interface LegacyScoreBreakdown {
  skillsCoverage: number
  roleRelevance: number
  locationFit: number
  keywordDensity: number
  dnaSkillEvidence?: number
  scopeFit?: number
}

/**
 * How confidently FreshFit can say something about one requirement or
 * constraint, given the evidence actually on file for this member.
 *
 * "Unknown != Missing" (locked product principle): when FreshlyForward
 * doesn't have enough evidence to confirm a requirement one way or the
 * other, that is 'unknown', never silently treated as a gap or a block.
 * Only 'confirmed_gap' means "we looked and it's genuinely not there,"
 * and only 'hard_blocker' should ever cause a hard-constraint failure.
 */
export type EvidenceStatus =
  | 'confirmed_match'
  | 'likely_transferable'
  | 'unknown'
  | 'confirmed_gap'
  | 'hard_blocker'

export type FreshFitDimensionKey =
  | 'skillsEvidence'
  | 'roleRelevance'
  | 'careerDirection'
  | 'compensation'
  | 'locationAndLogistics'

/**
 * One explainable slice of the composite FreshFit score. Deliberately
 * shaped like ForwardScorePillarResult (same key/label/score/weight/
 * explanation/improvementLink contract) so members see one consistent
 * "a score with a reason" UI language across Forward Score and FreshFit
 * -- but it's FreshFit's own type, not a shared import, because these
 * are two independent scoring systems (profile-readiness vs.
 * job-specific fit) that happen to share a good shape, not an identity.
 */
export interface FreshFitDimensionResult {
  key: FreshFitDimensionKey
  label: string
  /** 0-100, this dimension only. */
  score: number
  /** 0-1; all dimensions actually scored (status !== 'no-data') sum to 1. */
  weight: number
  status: 'strong' | 'moderate' | 'weak' | 'no-data'
  explanation: string
  /** What backed this score -- matched skills, scope evidence, etc. */
  evidence: string[]
  /** Confirmed gaps only -- never includes 'unknown' items (Unknown != Missing). */
  gaps: string[]
  /** Requirements FreshFit couldn't confirm either way given the evidence on file. */
  unknowns: string[]
  improvementLink: { label: string; to: string } | null
}

export type FreshFitHardConstraintKey = 'compensationFloor' | 'remoteRequirement'

/**
 * A requirement that -- when confidently violated -- should be shown
 * prominently rather than folded quietly into a dimension score. V1
 * activates exactly two (see the design spec, Q4): compensation floor
 * and remote-only mismatch, both with real member-stated data behind
 * them. A blocked constraint is always *shown*, never used to silently
 * hide a match.
 */
export interface FreshFitHardConstraint {
  key: FreshFitHardConstraintKey
  label: string
  /** Realistically 'confirmed_match' | 'hard_blocker' | 'unknown' for V1's two active constraints. */
  status: EvidenceStatus
  reason: string
}

export type FreshFitConfidence = 'high' | 'medium' | 'low'

export type FreshFitTier = 'strong' | 'good' | 'fair' | 'weak'

export type FreshFitRecommendationKey =
  | 'strong_pursue'
  | 'worth_a_look'
  | 'close_the_gap_first'
  | 'read_details_first'
  | 'likely_not_a_fit'

/** Deterministic, rule-based -- mirrors forwardScore/nextBestMove.ts's shape and technique. */
export interface FreshFitRecommendation {
  key: FreshFitRecommendationKey
  headline: string
  detail: string
}

export interface FreshFitResult {
  /** 0-100 composite -- unchanged contract, same DB CHECK constraint. */
  score: number
  tier: FreshFitTier
  confidence: FreshFitConfidence
  dimensions: FreshFitDimensionResult[]
  hardConstraints: FreshFitHardConstraint[]
  /** Aggregated across all dimensions -- de-duped, for a single top-level "what we're not sure about" list. */
  unknowns: string[]
  recommendation: FreshFitRecommendation
  /** Unchanged shape -- existing readers (MatchCard-style UI, buildWhyItMatches) keep working. */
  matchedSkills: string[]
  missingSkills: string[]
  /** Legacy flat breakdown, still populated additively for old readers. */
  breakdown: LegacyScoreBreakdown
}
