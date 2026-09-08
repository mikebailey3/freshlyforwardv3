import type { ResumeDimensionResult, TargetRoleAlignmentInput, TargetRoleAlignmentProvider } from '@/types/resume'

/**
 * Target Role Alignment — how well this resume's skills/content match a
 * target role or a specific opportunity.
 *
 * Locked decision: this must call FreshFit's existing skill/role matching
 * (`src/lib/freshFitScore/{skillMatching,roleRelevance}.ts`) — never a
 * second job-matching engine. Phase 1 does not wire that call yet; it
 * ships only the `TargetRoleAlignmentProvider` interface (see
 * src/types/resume.ts) and this null implementation, which honestly
 * reports the dimension as unavailable rather than inventing a score. A
 * `FreshFitTargetRoleAlignmentProvider` is a later, interface-compatible
 * swap — same pattern as Career Vault's `CareerWinInterpreter` ->
 * `DeterministicCareerWinInterpreter` boundary.
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
