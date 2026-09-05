import type { MemberProfile, ScrapedJob } from '@/types'
import type { FreshFitDimensionResult } from './types'
import { inferSeniorityLevel, getMemberCurrentSeniority } from './seniority'

const STOPWORDS = new Set([
  'the', 'and', 'for', 'are', 'with', 'you', 'your', 'our', 'a', 'an', 'to',
  'of', 'in', 'on', 'is', 'be', 'will', 'we', 'this', 'that', 'as', 'or',
  'at', 'by', 'from', 'have', 'has', 'it', 'its', 'their', 'they', 'who',
  'all', 'can', 'able', 'strong', 'work', 'working', 'job', 'role', 'team',
])

function normalize(text: string): string {
  return (text || '').toLowerCase()
}

function tokenize(text: string): Set<string> {
  return new Set(
    normalize(text)
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 3 && !STOPWORDS.has(word)),
  )
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let intersection = 0
  for (const word of a) {
    if (b.has(word)) intersection++
  }
  const union = a.size + b.size - intersection
  return union === 0 ? 0 : intersection / union
}

/** A JD implying meaningfully more seniority than the member's current
 * level is a real, confirmed gap worth flagging. This threshold (2+
 * ladder rungs, e.g. mid -> director) deliberately ignores a 1-rung step
 * up (e.g. mid -> senior) -- that's a normal, reasonable stretch role,
 * not a mismatch worth surfacing. */
const SENIORITY_GAP_THRESHOLD = 2
/** Same threshold, the other direction -- the member looks meaningfully
 * more senior than the role. Not treated as a gap (they can obviously
 * still do the work) -- just an honest, informational note. */
const OVERQUALIFICATION_THRESHOLD = -2
/** Multiplies the base score when a real seniority gap is confirmed --
 * a real signal worth reflecting in the number, but not a hard veto
 * (title-based inference is best-effort, not certain). */
const SENIORITY_GAP_PENALTY = 0.7
/** Preferred-jobs similarity has to clear this bar, and work-history
 * similarity has to stay below it, before this counts as a deliberate
 * "pursuing something different from my past" signal rather than noise. */
const CAREER_CHANGE_PREFERRED_FLOOR = 0.3
const CAREER_CHANGE_HISTORY_CEILING = 0.1

/**
 * Role Relevance dimension -- title overlap between the JD and the
 * member's preferred job titles vs. their past employment titles,
 * scored separately (not as one combined bag of words) specifically so
 * a deliberate career changer -- someone whose *preferred* direction
 * doesn't match their *past* titles -- gets full credit for matching
 * where they're trying to go, not penalized for not yet having done it.
 * Also folds in a best-effort seniority comparison (src/./seniority.ts):
 * a JD implying meaningfully more seniority than the member's current
 * level is a confirmed gap; the reverse (overqualification) is an
 * honest, non-penalizing note, not a mismatch.
 */
export function scoreRoleRelevanceDimension(profile: MemberProfile, job: ScrapedJob): FreshFitDimensionResult {
  const titleTokens = tokenize(job.title)
  const preferredTokens = tokenize((profile.preferred_jobs || []).join(' '))
  const historyTitles = (profile.employment_history || []).map((e) => e.title)
  const historyTokens = tokenize(historyTitles.join(' '))

  if (preferredTokens.size === 0 && historyTokens.size === 0) {
    return {
      key: 'roleRelevance',
      label: 'Role Relevance',
      score: 40,
      weight: 0.2,
      status: 'no-data',
      explanation: 'No preferred job titles or work history on file yet to compare against this role.',
      evidence: [],
      gaps: [],
      unknowns: ['role relevance to your work history'],
      improvementLink: { label: 'Add preferred job titles', to: '/career-profile' },
    }
  }

  const preferredSimilarity = jaccardSimilarity(titleTokens, preferredTokens)
  const historySimilarity = jaccardSimilarity(titleTokens, historyTokens)
  const isCareerChangeSignal =
    preferredSimilarity >= CAREER_CHANGE_PREFERRED_FLOOR &&
    historySimilarity < CAREER_CHANGE_HISTORY_CEILING &&
    historyTokens.size > 0

  const jobLevel = inferSeniorityLevel(job.title)
  const memberLevel = getMemberCurrentSeniority(profile.employment_history || [])
  const seniorityDiff = jobLevel !== null && memberLevel !== null ? jobLevel - memberLevel : null
  const hasSeniorityGap = seniorityDiff !== null && seniorityDiff >= SENIORITY_GAP_THRESHOLD
  const isOverqualified = seniorityDiff !== null && seniorityDiff <= OVERQUALIFICATION_THRESHOLD

  let score = Math.round(Math.max(preferredSimilarity, historySimilarity) * 100)
  if (hasSeniorityGap) score = Math.round(score * SENIORITY_GAP_PENALTY)

  const status = score >= 60 ? 'strong' : score >= 30 ? 'moderate' : 'weak'

  let explanation: string
  if (isCareerChangeSignal) {
    explanation = `"${job.title}" matches the direction you're pursuing (your preferred roles), even though it differs from your recent work history.`
  } else if (status === 'strong') {
    explanation = `"${job.title}" closely matches your preferred roles and work history.`
  } else if (status === 'moderate') {
    explanation = `"${job.title}" partially overlaps with your preferred roles and work history.`
  } else {
    explanation = `"${job.title}" doesn't closely match your preferred roles or past titles on file.`
  }
  if (hasSeniorityGap) {
    explanation += ' This role also appears to call for more senior experience than your work history shows.'
  }
  if (isOverqualified) {
    explanation += ' Note: this role may be more junior than your most recent experience level -- still worth a look if you\'re open to it.'
  }

  const gaps = [...(status === 'weak' && !isCareerChangeSignal ? [job.title] : [])]
  if (hasSeniorityGap) gaps.push('seniority level (your work history shows less senior experience than this role appears to need)')

  return {
    key: 'roleRelevance',
    label: 'Role Relevance',
    score,
    weight: 0.2,
    status,
    explanation,
    evidence: status === 'weak' && !isCareerChangeSignal ? [] : [job.title],
    gaps,
    unknowns: [],
    improvementLink: score < 100 ? { label: 'Update your preferred job titles', to: '/career-profile' } : null,
  }
}
