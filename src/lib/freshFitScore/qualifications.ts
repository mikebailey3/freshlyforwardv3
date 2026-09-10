import type { MemberProfile, ScrapedJob } from '@/types'
import type { CareerSkill } from '@/types/forwardDna'
import type { FreshFitHardConstraint } from './types'
import { findSkillsInText, classifySkill } from './skillMatching'

const MUST_HAVE_HEADING_RE =
  /(?:must[\s-]?have(?:s)?|required qualifications|requirements|minimum qualifications|required skills)\s*:?/i
const NICE_TO_HAVE_HEADING_RE =
  /(?:nice[\s-]?to[\s-]?have(?:s)?|preferred qualifications|preferred skills|bonus points|a plus)\s*:?/i

/**
 * Slices out the text between one heading and whichever *other* heading
 * comes next (or the end of the text) -- shared by both extractors
 * below. Returns '' (never a guess) when the requested heading isn't
 * present at all.
 */
function extractSection(jobText: string, headingRe: RegExp, otherHeadingRe: RegExp): string {
  const text = jobText || ''
  const headingMatch = text.match(headingRe)
  if (!headingMatch || headingMatch.index === undefined) return ''

  const afterHeading = text.slice(headingMatch.index + headingMatch[0].length)
  const otherMatch = afterHeading.match(otherHeadingRe)
  return otherMatch?.index !== undefined ? afterHeading.slice(0, otherMatch.index) : afterHeading
}

/**
 * Skills detected specifically within a "Must Have / Required /
 * Minimum Qualifications"-style section of the JD -- not the whole
 * posting. Returns [] (never guesses) when no such heading exists,
 * exactly like `jobNormalization.ts`'s `extractResponsibilities`.
 */
export function extractMustHaveSkills(jobText: string): string[] {
  const section = extractSection(jobText, MUST_HAVE_HEADING_RE, NICE_TO_HAVE_HEADING_RE)
  return section ? [...new Set(findSkillsInText(section))] : []
}

/** Skills detected specifically within a "Nice to Have / Preferred / Bonus"-style section of the JD. */
export function extractNiceToHaveSkills(jobText: string): string[] {
  const section = extractSection(jobText, NICE_TO_HAVE_HEADING_RE, MUST_HAVE_HEADING_RE)
  return section ? [...new Set(findSkillsInText(section))] : []
}

/**
 * OE 2.0 Phase 2 -- separates a confidently-total mismatch on a
 * posting's own literal must-have requirements from an ordinary soft
 * skill gap. Every detected skill (must-have or nice-to-have) already
 * shows up as a `gaps`/`unknowns` entry in the Skills & Evidence
 * dimension (`skillMatching.ts`) when it's missing -- that soft
 * treatment is intentionally left untouched here. This hard constraint
 * only fires for the narrower, higher-stakes case: the specific skills
 * a job explicitly labels as required.
 *
 * Deliberately conservative, mirroring every other FreshFit hard
 * constraint's "only a *confident* violation ever blocks" rule:
 * - No recognizable must-have section -> 'unknown' (nothing to check).
 * - At least one must-have skill is confirmed_match/likely_transferable
 *   -> 'confirmed_match' (partial coverage is never a block).
 * - Any must-have skill is merely 'unknown' (no evidence either way,
 *   not a confirmed absence) -> 'unknown', never escalated to a block
 *   on incomplete profile data.
 * - Only when EVERY must-have skill is a `confirmed_gap` (real,
 *   confident evidence of absence, per skillMatching.ts's
 *   "Unknown != Missing" sparse-profile rule) -> 'hard_blocker'.
 */
export function mustHaveSkillsHardConstraint(
  profile: MemberProfile,
  job: ScrapedJob,
  careerSkills: CareerSkill[],
  confirmedCapabilities: string[] = []
): FreshFitHardConstraint {
  const jobText = `${job.title} ${job.description}`
  const mustHaveSkills = extractMustHaveSkills(jobText)

  if (mustHaveSkills.length === 0) {
    return {
      key: 'mustHaveSkillsCoverage',
      label: 'Must-Have Requirements',
      status: 'unknown',
      reason: "This posting doesn't clearly separate must-have requirements, so FreshFit can't confirm a hard mismatch.",
    }
  }

  const statuses = mustHaveSkills.map((skill) =>
    classifySkill(skill, profile.skills || [], careerSkills, confirmedCapabilities)
  )

  if (statuses.some((status) => status === 'confirmed_match' || status === 'likely_transferable')) {
    return {
      key: 'mustHaveSkillsCoverage',
      label: 'Must-Have Requirements',
      status: 'confirmed_match',
      reason: "You have evidence for at least one of this posting's stated must-have requirements.",
    }
  }

  if (statuses.some((status) => status === 'unknown')) {
    return {
      key: 'mustHaveSkillsCoverage',
      label: 'Must-Have Requirements',
      status: 'unknown',
      reason: "FreshFit doesn't have enough evidence on your profile yet to confirm this posting's must-have requirements one way or the other.",
    }
  }

  return {
    key: 'mustHaveSkillsCoverage',
    label: 'Must-Have Requirements',
    status: 'hard_blocker',
    reason: `This posting's stated must-have requirements (${mustHaveSkills.join(', ')}) don't match anything on your current profile.`,
  }
}
