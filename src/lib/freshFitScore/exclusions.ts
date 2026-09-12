import type { MemberProfile, ScrapedJob } from '@/types'
import type { FreshFitHardConstraint } from './types'

function normalize(text: string | null | undefined): string {
  return (text || '').toLowerCase().trim()
}

/**
 * OE 2.0 Phase 2 -- `jobs_to_avoid` hard constraint. Deliberately
 * matches only `job.title` + `job.company`, never `job.description`:
 * the description is far more likely to produce a false-positive
 * incidental mention (e.g. "call center" appearing once in a benefits
 * blurb about a company's support line, on a role that isn't actually
 * a call-center job). Restricting the match to title/company keeps
 * this a high-precision, deterministic signal instead of a fuzzy
 * full-text search -- consistent with every other hard constraint in
 * this engine ("only a *confident* violation ever blocks").
 *
 * This is exclusion/flagging only -- it never removes a job from the
 * results list or skips scoring. Per the "shown prominently, never
 * silently hide a match" rule every other FreshFit hard constraint
 * already follows, a member should always be able to see *why* a
 * posting was flagged, not have it silently vanish.
 */
export function jobsToAvoidHardConstraint(profile: MemberProfile, job: ScrapedJob): FreshFitHardConstraint {
  const avoidPhrases = (profile.jobs_to_avoid || []).map(normalize).filter(Boolean)

  if (avoidPhrases.length === 0) {
    return {
      key: 'jobsToAvoidExclusion',
      label: 'Roles/Companies to Avoid',
      status: 'unknown',
      reason: "You haven't told us any roles or companies to avoid yet.",
    }
  }

  const haystack = `${normalize(job.title)} ${normalize(job.company)}`
  const matchedPhrase = avoidPhrases.find((phrase) => haystack.includes(phrase))

  if (matchedPhrase) {
    return {
      key: 'jobsToAvoidExclusion',
      label: 'Roles/Companies to Avoid',
      status: 'hard_blocker',
      reason: `This posting matches something you told us to avoid: "${matchedPhrase}".`,
    }
  }

  return {
    key: 'jobsToAvoidExclusion',
    label: 'Roles/Companies to Avoid',
    status: 'confirmed_match',
    reason: "This posting doesn't match anything you told us to avoid.",
  }
}
