// Barrel export -- preserves the existing `@/lib/freshFitScore` import
// path used by opportunityEngine.ts, linkedinOptimizer.ts, and
// scripts/syncFreshFitScores.ts. Converting freshFitScore.ts into this
// folder (with this file as its index.ts) means every existing import
// site resolves identically with zero changes required there.
export { computeFreshFitScore, toScoreBreakdownPayload } from './score'
export { SKILL_KEYWORDS, findSkillsInText } from './skillMatching'
export { getFreshFitTier, FRESHFIT_TIER_LABELS, FRESHFIT_TIER_STYLES } from './tiers'
export {
  selectMatchesToPersist,
  selectStaleMatchesToPrune,
  NOISE_FLOOR,
  TOP_N_PER_MEMBER,
} from './jobMatchPersistence'
export type { ScoredCandidate, ExistingMatchRow } from './jobMatchPersistence'
export type {
  FreshFitResult,
  FreshFitDimensionResult,
  FreshFitDimensionKey,
  FreshFitHardConstraint,
  FreshFitHardConstraintKey,
  FreshFitConfidence,
  FreshFitTier,
  FreshFitRecommendation,
  FreshFitRecommendationKey,
  EvidenceStatus,
} from './types'
