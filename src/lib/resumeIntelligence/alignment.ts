import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase as defaultClient } from '@/lib/supabase'
import { findSkillsInText } from '@/lib/freshFitScore/skillMatching'
import type { ResumeDimensionResult, ResumeFinding, TargetRoleAlignmentInput, TargetRoleAlignmentProvider } from '@/types/resume'

/**
 * Target Role Alignment — how well this resume's skills/content match a
 * target role or a specific opportunity.
 *
 * Locked decision: this must call FreshFit's existing skill/role matching
 * (`src/lib/freshFitScore/{skillMatching,roleRelevance}.ts`) — never a
 * second job-matching engine. Phase 1 shipped only the
 * `TargetRoleAlignmentProvider` interface and this null implementation.
 * Phase 6 adds the real `FreshFitTargetRoleAlignmentProvider` below,
 * which reuses FreshFit's own `findSkillsInText` dictionary matcher
 * (the exact function `analyzeTailoringFit.ts` also reuses) rather than
 * inventing a second matcher.
 */
export class NullTargetRoleAlignmentProvider implements TargetRoleAlignmentProvider {
  score(_input: TargetRoleAlignmentInput): Promise<ResumeDimensionResult> {
    return Promise.resolve({
      key: 'targetRoleAlignment',
      label: 'Target Role Alignment',
      status: 'unavailable',
      score: null,
      unavailableReason:
        'Target-role alignment is not wired to FreshFit\'s matching engine yet. This dimension will score once a FreshFitTargetRoleAlignmentProvider is implemented.',
      findings: [],
    })
  }
}

/**
 * Phase 6 — resolves a job description to compare against (either
 * `opportunityId`'s `opportunities.full_job_description`, or a bare
 * `targetRole` string used as-is), extracts its skill-dictionary terms
 * with FreshFit's `findSkillsInText`, and reports what fraction the
 * resume's own skills already cover. Honestly 'unavailable' (never a
 * fabricated score) when there's nothing to align against, the
 * opportunity can't be found, or no recognizable skill terms exist in
 * the text to compare against.
 */
export class FreshFitTargetRoleAlignmentProvider implements TargetRoleAlignmentProvider {
  constructor(private readonly client: SupabaseClient = defaultClient) {}

  async score(input: TargetRoleAlignmentInput): Promise<ResumeDimensionResult> {
    const unavailable = (reason: string): ResumeDimensionResult => ({
      key: 'targetRoleAlignment',
      label: 'Target Role Alignment',
      status: 'unavailable',
      score: null,
      unavailableReason: reason,
      findings: [],
    })

    if (!input.opportunityId && !input.targetRole) {
      return unavailable('No target role or opportunity was specified to align this resume against.')
    }

    let jobText = input.targetRole ?? ''

    if (input.opportunityId) {
      const { data, error } = await this.client
        .from('opportunities')
        .select('job_title, full_job_description')
        .eq('id', input.opportunityId)
        .maybeSingle()

      if (error || !data) {
        return unavailable(`Could not load the target opportunity to align against: ${error?.message ?? 'not found'}.`)
      }
      const row = data as { job_title: string; full_job_description: string | null }
      jobText = [row.job_title, row.full_job_description].filter(Boolean).join(' ')
    }

    const jdSkills = findSkillsInText(jobText)
    if (jdSkills.length === 0) {
      return unavailable('Could not identify any recognizable skill keywords in the target role/job description to compare against.')
    }

    const resumeSkillSet = new Set(input.resumeSkills.map((s) => s.toLowerCase()))
    const findings: ResumeFinding[] = []
    let matchedCount = 0

    for (const skill of jdSkills) {
      if (resumeSkillSet.has(skill.toLowerCase())) {
        matchedCount++
      } else {
        findings.push({
          code: 'TARGET_ROLE_SKILL_GAP',
          severity: 'info',
          meaning: 'This skill appears in the target role/job description but is not present on this resume.',
          evidence: skill,
          action: 'Add this skill to your resume if it genuinely applies to you, or tailor a version specifically for this opportunity.',
        })
      }
    }

    return {
      key: 'targetRoleAlignment',
      label: 'Target Role Alignment',
      status: 'scored',
      score: Math.round((matchedCount / jdSkills.length) * 100),
      findings,
    }
  }
}
