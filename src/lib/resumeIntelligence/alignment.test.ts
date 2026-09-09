import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { NullTargetRoleAlignmentProvider, FreshFitTargetRoleAlignmentProvider } from './alignment'

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

function makeFakeClient(opportunity: { job_title: string; full_job_description: string | null } | null, error: { message: string } | null = null) {
  const maybeSingleMock = vi.fn().mockResolvedValue({ data: opportunity, error })
  const eqMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock })
  const selectMock = vi.fn().mockReturnValue({ eq: eqMock })
  const fromMock = vi.fn().mockReturnValue({ select: selectMock })
  return { from: fromMock } as unknown as SupabaseClient
}

describe('FreshFitTargetRoleAlignmentProvider', () => {
  it('reports unavailable when neither a target role nor an opportunity is given', async () => {
    const provider = new FreshFitTargetRoleAlignmentProvider(makeFakeClient(null))
    const result = await provider.score({ resumeSkills: ['sql'], targetRole: null, opportunityId: null })
    expect(result.status).toBe('unavailable')
  })

  it('scores against a bare targetRole string using FreshFit\'s own skill dictionary matcher, never a second matcher', async () => {
    const provider = new FreshFitTargetRoleAlignmentProvider(makeFakeClient(null))
    const result = await provider.score({ resumeSkills: ['sql', 'leadership'], targetRole: 'Looking for strong SQL and leadership skills', opportunityId: null })
    expect(result.status).toBe('scored')
    expect(result.score).toBe(100)
    expect(result.findings).toEqual([])
  })

  it('fetches the opportunity job description when opportunityId is given, and reports a gap finding for each JD skill missing from the resume', async () => {
    const client = makeFakeClient({ job_title: 'Analyst', full_job_description: 'Requires SQL experience.' })
    const provider = new FreshFitTargetRoleAlignmentProvider(client)
    const result = await provider.score({ resumeSkills: ['sql'], targetRole: null, opportunityId: 'opp-1' })
    expect(result.score).toBe(100)
    expect(result.findings).toEqual([])
  })

  it('reports a gap finding for a JD skill genuinely missing from the resume', async () => {
    const client = makeFakeClient({ job_title: 'Analyst', full_job_description: 'Requires SQL and Python experience.' })
    const provider = new FreshFitTargetRoleAlignmentProvider(client)
    const result = await provider.score({ resumeSkills: ['sql'], targetRole: null, opportunityId: 'opp-1' })
    expect(result.score).toBe(50)
    expect(result.findings).toHaveLength(1)
    expect(result.findings[0]).toMatchObject({ code: 'TARGET_ROLE_SKILL_GAP', evidence: 'python' })
  })

  it('reports unavailable when the given opportunity cannot be found', async () => {
    const provider = new FreshFitTargetRoleAlignmentProvider(makeFakeClient(null))
    const result = await provider.score({ resumeSkills: [], targetRole: null, opportunityId: 'ghost' })
    expect(result.status).toBe('unavailable')
  })

  it('reports unavailable (never a fabricated score) when the job text has no recognizable skill-dictionary terms', async () => {
    const provider = new FreshFitTargetRoleAlignmentProvider(makeFakeClient(null))
    const result = await provider.score({ resumeSkills: ['sql'], targetRole: 'A wonderful opportunity awaits!', opportunityId: null })
    expect(result.status).toBe('unavailable')
  })
})
