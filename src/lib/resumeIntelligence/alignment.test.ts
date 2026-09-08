import { describe, expect, it } from 'vitest'
import { NullTargetRoleAlignmentProvider } from './alignment'

/**
 * Target Role Alignment must call FreshFit's existing matching engine —
 * never a second matcher (locked decision). Phase 1 ships only the
 * interface (src/types/resume.ts#TargetRoleAlignmentProvider) plus this
 * null implementation, which reports the dimension as honestly
 * 'unavailable' rather than fabricating a score. A real
 * FreshFitTargetRoleAlignmentProvider is a later, interface-compatible
 * swap.
 */
describe('NullTargetRoleAlignmentProvider', () => {
  it('reports the dimension as unavailable with a null score, never a fabricated number', async () => {
    const provider = new NullTargetRoleAlignmentProvider()
    const result = await provider.score({ resumeSkills: ['sql', 'leadership'], targetRole: 'Product Manager', opportunityId: null })

    expect(result.key).toBe('targetRoleAlignment')
    expect(result.status).toBe('unavailable')
    expect(result.score).toBeNull()
    expect(result.unavailableReason).toBeTruthy()
    expect(result.findings).toEqual([])
  })

  it('returns the same unavailable result regardless of input, since it never inspects it', async () => {
    const provider = new NullTargetRoleAlignmentProvider()
    const withRole = await provider.score({ resumeSkills: [], targetRole: 'Engineer', opportunityId: 'opp-1' })
    const withoutRole = await provider.score({ resumeSkills: [], targetRole: null, opportunityId: null })
    expect(withRole).toEqual(withoutRole)
  })
})
