import { scoreFromFindings } from './score'
import type { ResumeContentInput } from './types'
import type { ResumeDimensionResult, ResumeFinding } from '@/types/resume'

/**
 * Structural Quality — is the resume's structure complete, independent of
 * whether an ATS parser specifically can read it (see atsReadability.ts).
 * Same rule-catalog pattern (reactive-resume studied as reference only,
 * clean-room reimplementation).
 */
function buildFindings(content: ResumeContentInput): ResumeFinding[] {
  const findings: ResumeFinding[] = []

  if (content.employment.length === 0) {
    findings.push({
      code: 'NO_EXPERIENCE_ENTRIES',
      severity: 'warning',
      meaning: 'Most screening systems and reviewers rank on work experience.',
      evidence: '(no employment entries)',
      action: 'Add at least one employment entry, or use projects/volunteer work to show equivalent history.',
    })
  }

  for (const entry of content.employment) {
    const label = `${entry.title} at ${entry.company}`

    if (!entry.start_date.trim()) {
      findings.push({
        code: 'EMPLOYMENT_MISSING_START_DATE',
        severity: 'warning',
        meaning: 'A dated entry with no start date cannot be placed on a timeline.',
        evidence: label,
        action: `Add a start date to "${label}".`,
      })
    }

    if (!entry.description.trim()) {
      findings.push({
        code: 'EMPLOYMENT_MISSING_DESCRIPTION',
        severity: 'warning',
        meaning: 'An employment entry with no description gives a reviewer nothing to evaluate.',
        evidence: label,
        action: `Add at least one bullet describing impact for "${label}".`,
      })
    }
  }

  if (content.skills.length === 0) {
    findings.push({
      code: 'NO_SKILLS_LISTED',
      severity: 'warning',
      meaning: 'A resume with no listed skills is harder to match against keyword-searched requirements.',
      evidence: '(no skills listed)',
      action: 'Add at least 5 skills relevant to your target role.',
    })
  } else if (content.skills.length < 5) {
    findings.push({
      code: 'FEW_SKILLS_LISTED',
      severity: 'info',
      meaning: 'A short skills list narrows the set of keyword matches a screener or search can find.',
      evidence: content.skills.join(', '),
      action: 'Add a few more relevant skills, aiming for at least 5.',
    })
  }

  if (content.education.length === 0) {
    findings.push({
      code: 'NO_EDUCATION_ENTRIES',
      severity: 'info',
      meaning: 'Some roles/reviewers expect an education section, though many experienced candidates omit it deliberately.',
      evidence: '(no education entries)',
      action: 'Add an education entry if relevant to your target role, or leave this section out intentionally.',
    })
  }

  return findings
}

export function evaluateStructuralQuality(content: ResumeContentInput): ResumeDimensionResult {
  const findings = buildFindings(content)
  return {
    key: 'structuralQuality',
    label: 'Structural Quality',
    status: 'scored',
    score: scoreFromFindings(findings),
    findings,
  }
}
