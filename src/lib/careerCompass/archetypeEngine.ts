// src/lib/careerCompass/archetypeEngine.ts
import { calculateDimensionScores } from './scoring'
import type {
  DimensionScores, ArchetypeScores, ArchetypeKey, ArchetypeResult,
  ArchetypeQuestion, ArchetypeAnswers,
} from '@/types/careerCompass'

const ARCHETYPE_PRIORITY: ArchetypeKey[] = [
  'driver', 'connector', 'strategist', 'builder', 'explorer', 'creator',
]

/**
 * Weighted combinations of the six dimension scores. Each archetype's
 * weights sum to 1.0 and every input is already 0-100, so outputs land
 * naturally in 0-100 with no separate re-normalization step.
 */
export function calculateArchetypeScores(d: DimensionScores): ArchetypeScores {
  return {
    driver: Math.round(
      d.leadershipDrive * 0.35 + d.workPace * 0.25 + d.peopleFocus * 0.15 + d.ambiguityTolerance * 0.25
    ),
    connector: Math.round(
      d.peopleFocus * 0.45 + d.leadershipDrive * 0.20 + d.ambiguityTolerance * 0.15 + d.workPace * 0.20
    ),
    strategist: Math.round(
      d.analyticalOrientation * 0.40 + d.structurePreference * 0.30 + (100 - d.peopleFocus) * 0.15 + (100 - d.workPace) * 0.15
    ),
    builder: Math.round(
      d.structurePreference * 0.45 + (100 - d.ambiguityTolerance) * 0.30 + d.leadershipDrive * 0.15 + d.peopleFocus * 0.10
    ),
    explorer: Math.round(
      d.ambiguityTolerance * 0.40 + (100 - d.structurePreference) * 0.30 + d.workPace * 0.15 + d.peopleFocus * 0.15
    ),
    creator: Math.round(
      (100 - d.analyticalOrientation) * 0.40 + d.ambiguityTolerance * 0.25 + (100 - d.peopleFocus) * 0.20 + (100 - d.structurePreference) * 0.15
    ),
  }
}

/**
 * Primary = highest score, secondary = second highest. Ties are broken
 * deterministically by ARCHETYPE_PRIORITY: Array.prototype.sort is
 * stable (guaranteed since ES2019), so archetypes with equal scores
 * keep their original ARCHETYPE_PRIORITY order rather than being
 * reordered arbitrarily.
 */
export function determinePrimarySecondary(scores: ArchetypeScores): { primary: ArchetypeKey; secondary: ArchetypeKey } {
  const sorted = [...ARCHETYPE_PRIORITY].sort((a, b) => scores[b] - scores[a])
  return { primary: sorted[0], secondary: sorted[1] }
}

export function runArchetypeAssessment(
  questions: ArchetypeQuestion[],
  answers: ArchetypeAnswers
): ArchetypeResult {
  const dimensionScores = calculateDimensionScores(questions, answers)
  const archetypeScores = calculateArchetypeScores(dimensionScores)
  const { primary, secondary } = determinePrimarySecondary(archetypeScores)
  return {
    dimensionScores,
    archetypeScores,
    primaryArchetype: primary,
    secondaryArchetype: secondary,
  }
}
