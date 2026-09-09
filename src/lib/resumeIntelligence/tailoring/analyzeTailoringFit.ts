import { findSkillsInText } from '@/lib/freshFitScore/skillMatching'

/**
 * Phase 6 (6.3) — deterministic, keyword-based tailoring suggestions.
 * Deliberately reuses FreshFit's own `findSkillsInText` dictionary/
 * matcher rather than a second skill-matching implementation -- "FreshFit
 * remains the only alignment engine" (locked) means tailoring borrows its
 * matching logic, it doesn't duplicate it.
 *
 * Three buckets, each with a very deliberate meaning:
 *  - `matchedIncluded`   -- JD skill already on this resume version. No action needed.
 *  - `matchedNotIncluded`-- JD skill is TRUE on the member's canonical Profile
 *                           (Career Vault truth) but not turned on for this
 *                           resume version -- SAFE to suggest including,
 *                           because it is not new information, only a
 *                           presentation choice already true of the member.
 *  - `notOnFile`         -- JD skill that does not exist anywhere on the
 *                           member's canonical Profile. NEVER suggested as
 *                           something to add to the resume (that would be
 *                           fabrication) -- surfaced only as an honest gap
 *                           for the member to address (e.g. skill-building),
 *                           identical in spirit to FreshFit's own gap
 *                           reporting.
 */
export interface TailoringFitResult {
  jdSkillsFound: string[]
  matchedIncluded: string[]
  matchedNotIncluded: string[]
  notOnFile: string[]
}

export function analyzeTailoringFit(jobDescriptionText: string, canonicalSkills: string[], includedResumeSkills: string[]): TailoringFitResult {
  const jdSkillsFound = findSkillsInText(jobDescriptionText)
  const canonicalSet = new Set(canonicalSkills.map((s) => s.toLowerCase()))
  const includedSet = new Set(includedResumeSkills.map((s) => s.toLowerCase()))

  const matchedIncluded: string[] = []
  const matchedNotIncluded: string[] = []
  const notOnFile: string[] = []

  for (const skill of jdSkillsFound) {
    const key = skill.toLowerCase()
    if (!canonicalSet.has(key)) {
      notOnFile.push(skill)
    } else if (includedSet.has(key)) {
      matchedIncluded.push(skill)
    } else {
      matchedNotIncluded.push(skill)
    }
  }

  return { jdSkillsFound, matchedIncluded, matchedNotIncluded, notOnFile }
}
