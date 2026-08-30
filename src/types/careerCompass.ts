// src/types/careerCompass.ts

// ============================================================
// Part A — Career Archetype
// ============================================================

export type DimensionKey =
  | 'peopleFocus'
  | 'leadershipDrive'
  | 'structurePreference'
  | 'ambiguityTolerance'
  | 'analyticalOrientation'
  | 'workPace'

export type ArchetypeKey =
  | 'driver'
  | 'connector'
  | 'strategist'
  | 'builder'
  | 'explorer'
  | 'creator'

export interface ArchetypeQuestion {
  id: string
  text: string
  dimension: DimensionKey
  reverseScored: boolean
  weight: number
}

export type ArchetypeAnswer = 1 | 2 | 3 | 4 | 5

export type ArchetypeAnswers = Record<string, ArchetypeAnswer>

export type DimensionScores = Record<DimensionKey, number>

export type ArchetypeScores = Record<ArchetypeKey, number>

export interface ArchetypeResult {
  dimensionScores: DimensionScores
  archetypeScores: ArchetypeScores
  primaryArchetype: ArchetypeKey
  secondaryArchetype: ArchetypeKey
}

// ============================================================
// Part B — Forward Readiness
// ============================================================

export type ReadinessDimensionKey =
  | 'careerDirection'
  | 'resumePositioning'
  | 'searchStrategy'
  | 'applicationResults'
  | 'interviewConfidence'

export type ReadinessBarrierKey =
  | 'careerDirection'
  | 'resumePositioning'
  | 'searchStrategy'
  | 'applicationConversion'
  | 'interviewPerformance'

export type TransitionType =
  | 'first_job'
  | 'industry_change'
  | 'career_change'
  | 'advancement'
  | 'returning'

export interface ReadinessOption {
  label: string
  value: number
  transitionValue?: TransitionType
}

export interface ReadinessQuestion {
  id: string
  text: string
  dimension: ReadinessDimensionKey | 'supportNeed' | 'urgency' | 'transitionType'
  options: ReadinessOption[]
}

/** Maps a readiness question id to the index of the option the user chose. */
export type ReadinessAnswers = Record<string, number>

export interface ReadinessResult {
  dimensionScores: {
    careerDirection: number
    resumePositioning: number
    searchStrategy: number
    applicationResults: number
    interviewConfidence: number
  }
  supportNeed: number
  urgency: number
  transitionType: TransitionType | null
  isComplexTransition: boolean
  overallScore: number
  primaryBarrier: ReadinessBarrierKey
  secondaryBarrier: ReadinessBarrierKey
}

// ============================================================
// Recommendation Engine
// ============================================================

export type RecommendedPlanSlug =
  | 'career-kickstart'
  | 'founding-member'
  | 'career-growth'
  | 'career-concierge'
  | null

export interface PlanRecommendation {
  planSlug: RecommendedPlanSlug
  serviceFitPct: number
  reasons: string[]
}
