import { hasMetric } from '@/lib/textQuality'
import { scoreFromFindings } from './score'
import type { ResumeContentInput } from './types'
import type { ResumeDimensionResult, ResumeFinding } from '@/types/resume'

/**
 * Quantification — what share of employment bullets show a measurable
 * number, %, or $ rather than a bare duty description. Uses the same
 * `hasMetric()` primitive as LinkedIn Optimizer's experience-bullet check
 * (src/lib/textQuality/).
 */
function buildFindings(content: ResumeContentInput): ResumeFinding[] {
  const bullets = content.employment
    .map((entry) => ({ entry, description: entry.description.trim() }))
    .filter(({ description }) => description.length > 0)

  if (bullets.length === 0) {
    return [{
      code: 'NO_BULLETS_TO_QUANTIFY',
      severity: 'info',
      meaning: 'There is no employment description text yet to check for quantified impact.',
      evidence: '(no employment descriptions)',
      action: 'Add at least one employment description with a measurable result.',
    }]
  }

  const findings: ResumeFinding[] = []
  for (const { entry, description } of bullets) {
    if (!hasMetric(description)) {
      findings.push({
        code: 'BULLET_NOT_QUANTIFIED',
        severity: 'info',
        meaning: 'A quantified result (a number, %, or $) is more credible than a duty description.',
        evidence: description,
        action: `Add a measurable outcome to the "${entry.title} at ${entry.company}" bullet (e.g. "by 20%", "for 50+ clients", "saving 5 hrs/week").`,
      })
    }
  }
  return findings
}

export function evaluateQuantification(content: ResumeContentInput): ResumeDimensionResult {
  const findings = buildFindings(content)
  return {
    key: 'quantification',
    label: 'Quantification',
    status: 'scored',
    score: scoreFromFindings(findings),
    findings,
  }
}
