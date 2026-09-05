import type { EmploymentEntry } from '@/types'

export type SeniorityLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6

/**
 * Best-effort seniority inference from a free-text job title -- same
 * confidence level as `forwardDna/matching.ts`'s scope-signal regexes:
 * a real, useful heuristic, not a precise measurement. Ladder, low to
 * high: intern(0) < junior/entry(1) < unmodified/mid(2) < senior(3) <
 * lead/principal/staff(4) < manager(5) < director/VP/executive(6).
 * An unmodified title defaults to mid-level (2) rather than null --
 * most job titles without an explicit modifier ARE mid-level, so this
 * is a reasonable default, not a guess dressed up as unknown data.
 * Returns null only when there's no title text to work with at all.
 */
const SENIORITY_PATTERNS: Array<{ level: SeniorityLevel; pattern: RegExp }> = [
  { level: 6, pattern: /\b(director|vp|vice president|chief|executive|ceo|cto|coo|cfo)\b/i },
  { level: 5, pattern: /\b(manager|head of)\b/i },
  { level: 4, pattern: /\b(lead|principal|staff)\b/i },
  { level: 3, pattern: /\b(senior|sr\.?)\b/i },
  { level: 1, pattern: /\b(junior|jr\.?|entry.level|associate|apprentice)\b/i },
  { level: 0, pattern: /\bintern(ship)?\b/i },
]

export function inferSeniorityLevel(title: string): SeniorityLevel | null {
  const trimmed = (title || '').trim()
  if (!trimmed) return null
  for (const { level, pattern } of SENIORITY_PATTERNS) {
    if (pattern.test(trimmed)) return level
  }
  return 2
}

/**
 * A member's current seniority level, inferred from the employment
 * history entry marked `current: true`, or the most recently started
 * entry if none is marked current. Returns null with no employment
 * history at all -- FreshFit should never guess a level from nothing.
 */
export function getMemberCurrentSeniority(employmentHistory: EmploymentEntry[]): SeniorityLevel | null {
  if (employmentHistory.length === 0) return null
  const current = employmentHistory.find((e) => e.current)
  const mostRecent =
    current ??
    [...employmentHistory].sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime())[0]
  return inferSeniorityLevel(mostRecent.title)
}
