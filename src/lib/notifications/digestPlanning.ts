import { computeDigestEligibility, type DigestPreferencesLike } from './eligibility'
import { isDigestDue, DEFAULT_WEEKLY_DIGEST_FREQUENCY_DAYS } from './schedule'
import { selectDigestCandidates, type DigestCandidateMatch } from './digestCandidates'
import { buildWeeklyDigestPayload } from './digestPayload'
import type { NotificationPayload } from './provider'

/**
 * OE 2.0 Phase 10 -- composes eligibility, scheduling, candidate
 * selection, and payload construction into a single per-member
 * decision: `scripts/sendDigests.ts` calls this once per member with
 * bulk-fetched data (same "fetch once, compose per member" shape as
 * `scripts/syncFreshFitScores.ts`) and only has to act on the result --
 * all the actual decision logic stays here, pure and independently
 * testable without touching Supabase or any provider.
 */

export interface DigestPlanInput {
  toEmail: string
  memberFirstName: string | null
  prefs: DigestPreferencesLike | null
  matches: DigestCandidateMatch[]
  lastDigestSentAt: string | null
  previouslySentMatchIds: string[]
  now: Date
  frequencyDays?: number
}

export interface DigestPlan {
  matchIds: string[]
  payload: NotificationPayload
}

/**
 * Returns `null` when no digest should be sent this run -- either the
 * member isn't eligible (opted out), it isn't due yet (frequency not
 * elapsed), or there's simply nothing new to tell them about (every
 * digest-worthy match was already sent last time, or none exist). A
 * `null` result is never itself logged as an error -- "nothing to send"
 * is the overwhelmingly common, entirely expected case on most runs.
 */
export function planWeeklyDigest(input: DigestPlanInput): DigestPlan | null {
  const eligibility = computeDigestEligibility(input.prefs)
  if (!eligibility.weeklyDigestEligible) return null

  const frequencyDays = input.frequencyDays ?? DEFAULT_WEEKLY_DIGEST_FREQUENCY_DAYS
  if (!isDigestDue(input.lastDigestSentAt, input.now, frequencyDays)) return null

  const candidates = selectDigestCandidates(input.matches, input.previouslySentMatchIds)
  if (candidates.length === 0) return null

  return {
    matchIds: candidates.map((m) => m.id),
    payload: buildWeeklyDigestPayload(input.toEmail, input.memberFirstName, candidates),
  }
}
