import type { MemberProfile, ScrapedJob } from '@/types'
import type { FreshFitDimensionResult } from './types'

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

/**
 * Role Relevance dimension -- title overlap between the JD and the
 * member's preferred job titles + past employment titles. Same jaccard
 * technique the original engine used, extracted and explained per-member
 * rather than folded into a single opaque number.
 */
export function scoreRoleRelevanceDimension(profile: MemberProfile, job: ScrapedJob): FreshFitDimensionResult {
  const titleTokens = tokenize(job.title)
  const candidateTitles = [
    ...(profile.preferred_jobs || []),
    ...(profile.employment_history || []).map((e) => e.title),
  ].join(' ')
  const candidateTokens = tokenize(candidateTitles)

  if (candidateTokens.size === 0) {
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

  const similarity = jaccardSimilarity(titleTokens, candidateTokens)
  const score = Math.round(similarity * 100)
  const status = score >= 60 ? 'strong' : score >= 30 ? 'moderate' : 'weak'

  return {
    key: 'roleRelevance',
    label: 'Role Relevance',
    score,
    weight: 0.2,
    status,
    explanation:
      status === 'strong'
        ? `"${job.title}" closely matches your preferred roles and work history.`
        : status === 'moderate'
          ? `"${job.title}" partially overlaps with your preferred roles and work history.`
          : `"${job.title}" doesn't closely match your preferred roles or past titles on file.`,
    evidence: status === 'weak' ? [] : [job.title],
    gaps: status === 'weak' ? [job.title] : [],
    unknowns: [],
    improvementLink: score < 100 ? { label: 'Update your preferred job titles', to: '/career-profile' } : null,
  }
}
