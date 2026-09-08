import { scoreFromFindings } from './score'
import type { ResumeContentInput } from './types'
import type { ResumeDimensionResult, ResumeFinding } from '@/types/resume'

/**
 * ATS Readability — can an applicant-tracking-system parser correctly
 * extract this resume's identity/contact fields? Pattern-adapted from
 * reactive-resume's ATS rule-catalog shape (findings with
 * code/severity/meaning/action) — studied as reference only, no code
 * reused (MIT-licensed, reimplemented clean-room against our own types
 * and conventions).
 *
 * Deliberately narrow in Phase 1: only the fields most ATS parsers key a
 * candidate record on. Structural completeness (experience/education/
 * skills presence) is a separate dimension — see structuralQuality.ts —
 * kept apart because "can a parser read your contact info" and "is your
 * resume structurally complete" are different failure modes with
 * different fixes.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function buildFindings(content: ResumeContentInput): ResumeFinding[] {
  const findings: ResumeFinding[] = []

  if (!content.fullName.trim()) {
    findings.push({
      code: 'MISSING_NAME',
      severity: 'error',
      meaning: 'A parser has nothing to file this resume under without a name.',
      evidence: '(no name provided)',
      action: 'Add your full name to the resume header.',
    })
  }

  if (!content.email.trim()) {
    findings.push({
      code: 'MISSING_EMAIL',
      severity: 'error',
      meaning: 'Email is the field most applicant-tracking systems key a candidate record on.',
      evidence: '(no email provided)',
      action: 'Add an email address to the resume header.',
    })
  } else if (!EMAIL_RE.test(content.email.trim())) {
    findings.push({
      code: 'MALFORMED_EMAIL',
      severity: 'error',
      meaning: 'An email address in an unrecognized shape may be dropped or mis-parsed by a screening system.',
      evidence: content.email,
      action: 'Use a plain address such as name@example.com, with no surrounding text.',
    })
  }

  if (!content.phone.trim()) {
    findings.push({
      code: 'MISSING_PHONE',
      severity: 'warning',
      meaning: 'Some applicant-tracking systems require a phone number before a submission is accepted.',
      evidence: '(no phone number provided)',
      action: 'Add a phone number to the resume header.',
    })
  }

  if (!content.location.trim()) {
    findings.push({
      code: 'MISSING_LOCATION',
      severity: 'info',
      meaning: 'Many systems use location to match a candidate against a role\'s region.',
      evidence: '(no location provided)',
      action: 'Add at least a city and state/region to the resume header.',
    })
  }

  return findings
}

export function evaluateAtsReadability(content: ResumeContentInput): ResumeDimensionResult {
  const findings = buildFindings(content)
  return {
    key: 'atsReadability',
    label: 'ATS Readability',
    status: 'scored',
    score: scoreFromFindings(findings),
    findings,
  }
}
