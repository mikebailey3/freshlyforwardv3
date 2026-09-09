import { findCliches, WEAK_OPENERS } from '@/lib/textQuality'
import { scoreFromFindings } from './score'
import type { ResumeContentInput } from './types'
import type { ResumeDimensionResult, ResumeFinding } from '@/types/resume'

/**
 * Content Strength — clichés and weak/passive bullet openers, using the
 * same shared primitives as LinkedIn Optimizer (src/lib/textQuality/) so
 * the two features never maintain divergent copies of the same
 * heuristics.
 */
function startsWithWeakOpener(text: string): boolean {
  const lower = text.trim().toLowerCase()
  return WEAK_OPENERS.some((opener) => lower.startsWith(opener))
}

function buildFindings(content: ResumeContentInput): ResumeFinding[] {
  const findings: ResumeFinding[] = []

  const summary = content.summary.trim()
  if (summary) {
    const cliches = findCliches(summary)
    if (cliches.length > 0) {
      findings.push({
        code: 'CLICHE_IN_SUMMARY',
        severity: 'info',
        meaning: 'Generic phrases show up on thousands of resumes and add no differentiating signal.',
        evidence: cliches.join(', '),
        action: 'Replace the generic phrase with a specific, provable detail.',
      })
    }
  }

  for (const entry of content.employment) {
    const description = entry.description.trim()
    if (!description) continue

    const label = `${entry.title} at ${entry.company}`

    if (startsWithWeakOpener(description)) {
      findings.push({
        code: 'WEAK_OPENER_BULLET',
        severity: 'warning',
        meaning: 'A weak/passive opener (e.g. "Responsible for") describes a duty, not an outcome.',
        evidence: description,
        action: `Rewrite the "${label}" bullet to open with a strong action verb describing what you accomplished.`,
      })
    }

    const cliches = findCliches(description)
    if (cliches.length > 0) {
      findings.push({
        code: 'CLICHE_IN_BULLET',
        severity: 'info',
        meaning: 'Generic phrases show up on thousands of resumes and add no differentiating signal.',
        evidence: cliches.join(', '),
        action: `Replace the generic phrase in the "${label}" bullet with a specific, provable detail.`,
      })
    }
  }

  return findings
}

export function evaluateContentStrength(content: ResumeContentInput): ResumeDimensionResult {
  const findings = buildFindings(content)
  return {
    key: 'contentStrength',
    label: 'Content Strength',
    status: 'scored',
    score: scoreFromFindings(findings),
    findings,
  }
}
