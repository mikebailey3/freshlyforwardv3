import type { MemberProfile, ScrapedJob } from '@/types'
import type { FreshFitDimensionResult, FreshFitHardConstraint } from './types'

const HOURS_PER_YEAR = 2080 // 40hr/week x 52 weeks -- same convention used across this codebase's few salary-adjacent calcs

function toNumber(raw: string): number {
  return Number(raw.replace(/,/g, ''))
}

/**
 * Best-effort, regex-based salary-range extraction from free-text
 * `scraped_jobs.salary_text` -- same technique/confidence level as
 * `forwardDna/matching.ts`'s parseScopeSignals (BUDGET_RE). Returns
 * annual dollar amounts, or null when the text doesn't parse. A null
 * result must never be treated as a mismatch -- only as "no data."
 */
export function parseSalaryRange(salaryText: string | null): { min: number; max: number } | null {
  if (!salaryText) return null

  const hourlyMatch = salaryText.match(/\$\s?(\d+(?:\.\d+)?)\s?(?:\/\s?|\s?per\s?)(?:hr|hour)/i)
  if (hourlyMatch) {
    const hourly = Number(hourlyMatch[1])
    const annual = Math.round(hourly * HOURS_PER_YEAR)
    return { min: annual, max: annual }
  }

  const rangeMatch = salaryText.match(
    /\$\s?([\d,.]+)\s?(k)?\s*(?:-|–|to)\s*\$?\s?([\d,.]+)\s?(k)?/i
  )
  if (rangeMatch) {
    const min = toNumber(rangeMatch[1]) * (rangeMatch[2] ? 1000 : 1)
    const max = toNumber(rangeMatch[3]) * (rangeMatch[4] ? 1000 : 1)
    return { min, max }
  }

  const singleMatch = salaryText.match(/\$\s?([\d,.]+)\s?(k)?\b/i)
  if (singleMatch) {
    const value = toNumber(singleMatch[1]) * (singleMatch[2] ? 1000 : 1)
    return { min: value, max: value }
  }

  return null
}

/**
 * Compensation Alignment dimension. "Unknown != Missing": missing or
 * unparseable salary data on either side is `no-data`, scored neutrally
 * (50) -- never treated as a mismatch. Only a *confident* comparison
 * (both a parsed job range AND a member-stated minimum) can produce a
 * weak score.
 */
export function scoreCompensationDimension(profile: MemberProfile, job: ScrapedJob): FreshFitDimensionResult {
  const parsed = parseSalaryRange(job.salary_text)
  const floor = profile.salary_min

  if (parsed === null || (floor === null && profile.salary_max === null)) {
    return {
      key: 'compensation',
      label: 'Compensation Alignment',
      score: 50,
      weight: 0.15,
      status: 'no-data',
      explanation: parsed === null
        ? "This posting doesn't list a salary range, so FreshFit can't compare it to your compensation expectations."
        : "You haven't set a salary expectation on your Career Profile yet.",
      evidence: [],
      gaps: [],
      unknowns: ['whether pay meets your expectations'],
      improvementLink: parsed === null ? null : { label: 'Set your salary expectations', to: '/career-profile' },
    }
  }

  if (floor !== null && parsed.max < floor) {
    const score = Math.max(0, Math.round((parsed.max / floor) * 40))
    return {
      key: 'compensation',
      label: 'Compensation Alignment',
      score,
      weight: 0.15,
      status: 'weak',
      explanation: `This posting's range tops out below your stated minimum of $${floor.toLocaleString()}.`,
      evidence: [],
      gaps: ['posted pay range meets your stated minimum'],
      unknowns: [],
      improvementLink: null,
    }
  }

  return {
    key: 'compensation',
    label: 'Compensation Alignment',
    score: 90,
    weight: 0.15,
    status: 'strong',
    explanation: 'This posting\'s range meets or exceeds your stated compensation minimum.',
    evidence: ['posted pay range meets your stated minimum'],
    gaps: [],
    unknowns: [],
    improvementLink: null,
  }
}

/**
 * V1's one active salary-related hard constraint (design spec Q4): only
 * fires HARD_BLOCKER when both a parsed job range and a member-stated
 * minimum exist and confidently conflict. Missing data on either side
 * is UNKNOWN, never a false block.
 */
export function compensationHardConstraint(profile: MemberProfile, job: ScrapedJob): FreshFitHardConstraint {
  const parsed = parseSalaryRange(job.salary_text)
  const floor = profile.salary_min

  if (parsed === null || floor === null) {
    return {
      key: 'compensationFloor',
      label: 'Compensation Floor',
      status: 'unknown',
      reason: parsed === null
        ? "This posting doesn't list a salary range."
        : "You haven't set a stated salary minimum.",
    }
  }

  if (parsed.max < floor) {
    return {
      key: 'compensationFloor',
      label: 'Compensation Floor',
      status: 'hard_blocker',
      reason: `Posted range ($${parsed.min.toLocaleString()}-$${parsed.max.toLocaleString()}) tops out below your stated minimum of $${floor.toLocaleString()}.`,
    }
  }

  return {
    key: 'compensationFloor',
    label: 'Compensation Floor',
    status: 'confirmed_match',
    reason: `Posted range meets your stated minimum of $${floor.toLocaleString()}.`,
  }
}
