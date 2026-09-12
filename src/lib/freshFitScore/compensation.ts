import type { MemberProfile, ScrapedJob } from '@/types'
import type { FreshFitDimensionResult, FreshFitHardConstraint } from './types'

const HOURS_PER_YEAR = 2080 // 40hr/week x 52 weeks -- same convention used across this codebase's few salary-adjacent calcs
const WEEKS_PER_YEAR = 52
const MONTHS_PER_YEAR = 12

function toNumber(raw: string): number {
  return Number(raw.replace(/,/g, ''))
}

interface PayPeriodUnit {
  /** Regex alternation fragment (no capture group) matching this unit's suffix text, e.g. "hr|hour". */
  pattern: string
  annualMultiplier: number
}

/**
 * OE 2.0 Phase 2 -- every pay-period suffix FreshFit annualizes, tried
 * in this order for both range and single-value matches. Deliberately
 * a small, explicit table (not a fuzzy "any word near a $" heuristic)
 * so adding a new supported period is a one-line, fully-tested change.
 */
const PAY_PERIOD_UNITS: PayPeriodUnit[] = [
  { pattern: 'hr|hour', annualMultiplier: HOURS_PER_YEAR },
  { pattern: 'mo|month', annualMultiplier: MONTHS_PER_YEAR },
  { pattern: 'wk|week', annualMultiplier: WEEKS_PER_YEAR },
]

/**
 * Tries every supported pay-period suffix for a RANGE, e.g.
 * "$25-$30/hr" or "$4,000 - $5,000/mo". Checked strictly before
 * `matchPeriodSingle` for the same text -- a naive single-value regex
 * would otherwise partial-match just the upper bound of a range (e.g.
 * misreading "$25-$30/hr" as one $30/hr value and silently dropping
 * the $25 floor), because the range's leading "$25-" doesn't satisfy a
 * single-value pattern anchored on "$<number>/hr".
 */
function matchPeriodRange(salaryText: string): { min: number; max: number } | null {
  for (const unit of PAY_PERIOD_UNITS) {
    const re = new RegExp(
      `\\$\\s?([\\d,.]+)\\s?(k)?\\s*(?:-|\u2013|to)\\s*\\$?\\s?([\\d,.]+)\\s?(k)?\\s?(?:\\/\\s?|\\s?per\\s?)(?:${unit.pattern})\\b`,
      'i'
    )
    const match = salaryText.match(re)
    if (!match) continue

    const min = toNumber(match[1]) * (match[2] ? 1000 : 1)
    const max = toNumber(match[3]) * (match[4] ? 1000 : 1)
    return { min: Math.round(min * unit.annualMultiplier), max: Math.round(max * unit.annualMultiplier) }
  }
  return null
}

/** Tries every supported pay-period suffix for a single value, e.g. "$18.50/hr" or "$5k/mo". */
function matchPeriodSingle(salaryText: string): { min: number; max: number } | null {
  for (const unit of PAY_PERIOD_UNITS) {
    const re = new RegExp(`\\$\\s?([\\d,.]+)\\s?(k)?\\s?(?:\\/\\s?|\\s?per\\s?)(?:${unit.pattern})\\b`, 'i')
    const match = salaryText.match(re)
    if (!match) continue

    const value = toNumber(match[1]) * (match[2] ? 1000 : 1)
    const annual = Math.round(value * unit.annualMultiplier)
    return { min: annual, max: annual }
  }
  return null
}

/**
 * Best-effort, regex-based salary-range extraction from free-text
 * `scraped_jobs.salary_text` -- same technique/confidence level as
 * `forwardDna/matching.ts`'s parseScopeSignals (BUDGET_RE). Returns
 * annual dollar amounts, or null when the text doesn't parse (e.g.
 * "Competitive salary, DOE" or a non-USD currency symbol -- deliberately
 * never guessed). A null result must never be treated as a mismatch --
 * only as "no data."
 */
export function parseSalaryRange(salaryText: string | null): { min: number; max: number } | null {
  if (!salaryText) return null

  const periodRange = matchPeriodRange(salaryText)
  if (periodRange) return periodRange

  const periodSingle = matchPeriodSingle(salaryText)
  if (periodSingle) return periodSingle

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
 * OE 2.0 Phase 2 -- `parseSalaryRange` always returns a plain USD
 * number with no currency tag, and `scraped_jobs.salary_text` has no
 * structured currency field either. Comparing that raw number against
 * a member's stated floor is only ever valid when the member's own
 * expectation is *also* in USD; otherwise FreshFit would be silently
 * comparing, say, a CAD expectation to a USD-assumed job range and
 * fabricating a numeric conflict (or match) that was never actually
 * confirmed. Defaults an unset/empty `salary_currency` to USD -- every
 * existing profile in this codebase's fixtures/prod data already is.
 */
function isNonUsdCurrency(profile: MemberProfile): boolean {
  const currency = (profile.salary_currency || 'USD').trim().toUpperCase()
  return currency !== 'USD' && currency !== ''
}

/**
 * Compensation Alignment dimension. "Unknown != Missing": missing or
 * unparseable salary data on either side is `no-data`, scored neutrally
 * (50) -- never treated as a mismatch. Only a *confident* comparison
 * (both a parsed job range AND a member-stated minimum, in the same
 * currency) can produce a weak score.
 */
export function scoreCompensationDimension(profile: MemberProfile, job: ScrapedJob): FreshFitDimensionResult {
  if (isNonUsdCurrency(profile)) {
    return {
      key: 'compensation',
      label: 'Compensation Alignment',
      score: 50,
      weight: 0.15,
      status: 'no-data',
      explanation: `Your salary expectations are set in ${profile.salary_currency}, and FreshFit currently compares USD-listed pay only, so this can't be confidently compared.`,
      evidence: [],
      gaps: [],
      unknowns: ['whether pay meets your expectations (non-USD currency)'],
      improvementLink: null,
    }
  }

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
 * minimum exist, in the same (USD) currency, and confidently conflict.
 * Missing data on either side -- or a non-USD member expectation, see
 * `isNonUsdCurrency` -- is UNKNOWN, never a false block.
 */
export function compensationHardConstraint(profile: MemberProfile, job: ScrapedJob): FreshFitHardConstraint {
  if (isNonUsdCurrency(profile)) {
    return {
      key: 'compensationFloor',
      label: 'Compensation Floor',
      status: 'unknown',
      reason: `Your salary expectations are set in ${profile.salary_currency}, which FreshFit can't yet confidently compare to this USD-listed posting.`,
    }
  }

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
