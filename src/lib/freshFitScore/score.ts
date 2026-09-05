import type { MemberProfile, ScrapedJob, JobMatchScoreBreakdown } from '@/types'
import type { CareerSkill, CareerScope } from '@/types/forwardDna'
import { scoreSkillsDimension } from './skillMatching'
import { scoreRoleRelevanceDimension } from './roleRelevance'
import { scoreCareerDirectionDimension } from './careerDirection'
import { scoreCompensationDimension, compensationHardConstraint } from './compensation'
import { scoreLocationDimension, remoteHardConstraint } from './location'
import { computeConfidence } from './confidence'
import { computeRecommendation } from './recommendation'
import { getFreshFitTier } from './tiers'
import type { FreshFitDimensionResult, FreshFitResult, LegacyScoreBreakdown } from './types'

/**
 * Dimension weights -- sum to 1.0. Provisional (design spec §5.2,
 * MEDIUM CONFIDENCE): preserves Skills & Evidence's dominant share from
 * the original engine (it was 50-of-100 raw points before; 0.4 here is
 * the closest equivalent once Career Direction/Compensation/Location
 * are real weighted dimensions instead of small flat bonuses). Validate
 * against real production score distributions before treating as final.
 */
const WEIGHTS = {
  skillsEvidence: 0.4,
  roleRelevance: 0.2,
  careerDirection: 0.15,
  compensation: 0.15,
  locationAndLogistics: 0.1,
} as const

const STOPWORDS = new Set([
  'the', 'and', 'for', 'are', 'with', 'you', 'your', 'our', 'a', 'an', 'to',
  'of', 'in', 'on', 'is', 'be', 'will', 'we', 'this', 'that', 'as', 'or',
  'at', 'by', 'from', 'have', 'has', 'it', 'its', 'their', 'they', 'who',
  'all', 'can', 'able', 'strong', 'work', 'working', 'job', 'role', 'team',
])

function tokenize(text: string): Set<string> {
  return new Set(
    (text || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 3 && !STOPWORDS.has(word)),
  )
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let intersection = 0
  for (const word of a) if (b.has(word)) intersection++
  const union = a.size + b.size - intersection
  return union === 0 ? 0 : intersection / union
}

/**
 * Legacy-only: the original engine's `keywordDensity` factor (profile
 * summary/headline/goals/strengths vs. JD word overlap, max 10 raw
 * points). Not part of the v2 dimension model -- kept solely so the
 * required `JobMatchScoreBreakdown.keywordDensity` field stays populated
 * for any old reader, per the additive-breakdown backward-compat rule.
 */
function legacyKeywordDensity(profile: MemberProfile, job: ScrapedJob): number {
  const profileText = [profile.summary, profile.headline, profile.career_goals, profile.strengths]
    .filter(Boolean)
    .join(' ')
  const jdText = `${job.title} ${job.description}`
  return Math.round(jaccard(tokenize(profileText), tokenize(jdText)) * 10)
}

function statusFromScore(score: number): FreshFitDimensionResult['status'] {
  if (score >= 70) return 'strong'
  if (score >= 40) return 'moderate'
  return 'weak'
}

/**
 * FreshFit Score v2 -- pure, deterministic, explainable job-fit
 * intelligence. No LLM, no external API. Composes five independently
 * testable dimensions (see ./skillMatching, ./roleRelevance,
 * ./careerDirection, ./compensation, ./location) into one 0-100
 * composite, plus hard constraints, confidence, and a deterministic
 * recommendation.
 *
 * `careerDirectionScore` is optional and additive (defaults to null) --
 * every existing call site keeps compiling; callers that have a Career
 * Compass result (the sync script, submitMemberJob) pass it through.
 */
export function computeFreshFitScore(
  profile: MemberProfile,
  job: ScrapedJob,
  dna: { skills: CareerSkill[]; scope: CareerScope[] } = { skills: [], scope: [] },
  careerDirectionScore: number | null = null
): FreshFitResult {
  const jobText = `${job.title} ${job.description}`

  const skillsResult = scoreSkillsDimension(profile.skills || [], dna.skills, dna.scope, jobText)
  const skillsDimension: FreshFitDimensionResult = {
    key: 'skillsEvidence',
    label: 'Skills & Evidence',
    score: skillsResult.score,
    weight: WEIGHTS.skillsEvidence,
    status: statusFromScore(skillsResult.score),
    explanation:
      skillsResult.gaps.length === 0 && skillsResult.unknowns.length === 0
        ? 'Your recorded skills and Forward DNA evidence cover what this role is looking for.'
        : `Matched on ${skillsResult.evidence.length} skill(s); ${skillsResult.gaps.length} confirmed gap(s), ${skillsResult.unknowns.length} unclear given your current profile.`,
    evidence: skillsResult.evidence,
    gaps: skillsResult.gaps,
    unknowns: skillsResult.unknowns,
    improvementLink: skillsResult.gaps.length > 0 ? { label: 'Add skill evidence to Forward DNA', to: '/forward-dna' } : null,
  }

  const roleDimension = scoreRoleRelevanceDimension(profile, job)
  const careerDimension = scoreCareerDirectionDimension(careerDirectionScore)
  const compensationDimension = scoreCompensationDimension(profile, job)
  const locationDimension = scoreLocationDimension(profile, job)

  const dimensions = [skillsDimension, roleDimension, careerDimension, compensationDimension, locationDimension]

  // Weighted composite, re-normalized across only the dimensions that
  // actually have data -- a missing Career Compass result or unlisted
  // salary shouldn't silently drag the whole score toward zero (same
  // "no signal = neutral, never a penalty" philosophy as the rest of
  // this engine, and directly required by "Unknown != Missing").
  const scoredDimensions = dimensions.filter((d) => d.status !== 'no-data')
  const activeDimensions = scoredDimensions.length > 0 ? scoredDimensions : dimensions
  const totalWeight = activeDimensions.reduce((sum, d) => sum + d.weight, 0)
  const rawScore = activeDimensions.reduce((sum, d) => sum + d.score * d.weight, 0) / totalWeight
  const score = Math.max(0, Math.min(100, Math.round(rawScore)))

  const tier = getFreshFitTier(score)
  const confidence = computeConfidence(dimensions)

  const hardConstraints = [compensationHardConstraint(profile, job), remoteHardConstraint(profile, job)]
  const hasConfirmedGaps = dimensions.some((d) => d.gaps.length > 0)
  const recommendation = computeRecommendation(tier, hardConstraints, hasConfirmedGaps)

  const unknowns = [...new Set(dimensions.flatMap((d) => d.unknowns))]
  const matchedSkills = [...new Set(skillsResult.evidence)].slice(0, 10)
  const missingSkills = skillsResult.gaps

  const breakdown: LegacyScoreBreakdown = {
    skillsCoverage: skillsResult.legacyBreakdown.skillsCoverage,
    roleRelevance: Math.round(roleDimension.score * 0.25),
    locationFit: Math.round(locationDimension.score * 0.15),
    keywordDensity: legacyKeywordDensity(profile, job),
    dnaSkillEvidence: skillsResult.legacyBreakdown.dnaSkillEvidence,
    scopeFit: skillsResult.legacyBreakdown.scopeFit,
  }

  return {
    score,
    tier,
    confidence,
    dimensions,
    hardConstraints,
    unknowns,
    recommendation,
    matchedSkills,
    missingSkills,
    breakdown,
  }
}

/**
 * Builds the full `job_matches.score_breakdown` jsonb payload for a
 * FreshFitResult -- the legacy flat keys (for old readers like
 * `buildWhyItMatches`) plus a `v2` object carrying everything the new
 * explainable UI needs. Purely additive to the jsonb column; no
 * migration required for this shape (see design spec §1.4/§5.1).
 */
export function toScoreBreakdownPayload(result: FreshFitResult): JobMatchScoreBreakdown {
  return {
    ...result.breakdown,
    v2: {
      tier: result.tier,
      confidence: result.confidence,
      dimensions: result.dimensions,
      hardConstraints: result.hardConstraints,
      unknowns: result.unknowns,
      recommendation: result.recommendation,
    },
  }
}
