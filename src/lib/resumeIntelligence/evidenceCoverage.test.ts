import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { NullEvidenceCoverageProvider, CareerVaultEvidenceCoverageProvider } from './evidenceCoverage'

/**
 * Evidence Coverage must read Career Vault's confirmed
 * career_win_capabilities — never invent substitute evidence (locked
 * decision). Career Vault does not exist yet, so Phase 1 ships only the
 * interface (src/types/resume.ts#EvidenceCoverageProvider) plus this null
 * implementation, which reports the dimension as honestly 'unavailable'.
 */
describe('NullEvidenceCoverageProvider', () => {
  it('reports the dimension as unavailable with a null score, never invented evidence', async () => {
    const provider = new NullEvidenceCoverageProvider()
    const result = await provider.score({ userId: 'user-1', claimedSkills: ['sql', 'leadership'] })

    expect(result.key).toBe('evidenceCoverage')
    expect(result.status).toBe('unavailable')
    expect(result.score).toBeNull()
    expect(result.unavailableReason).toContain('Career Vault')
    expect(result.findings).toEqual([])
  })
})

function makeFakeClient(confirmedSkillNames: string[], queryError: { message: string } | null = null) {
  const eqStatusMock = vi.fn().mockResolvedValue({ data: confirmedSkillNames.map((skill_name) => ({ skill_name })), error: queryError })
  const eqUserMock = vi.fn().mockReturnValue({ eq: eqStatusMock })
  const selectMock = vi.fn().mockReturnValue({ eq: eqUserMock })
  const fromMock = vi.fn().mockReturnValue({ select: selectMock })
  return { from: fromMock } as unknown as SupabaseClient
}

describe('CareerVaultEvidenceCoverageProvider', () => {
  it('reports unavailable (never a fabricated zero-coverage score) when the resume claims no skills at all', async () => {
    const provider = new CareerVaultEvidenceCoverageProvider(makeFakeClient([]))
    const result = await provider.score({ userId: 'user-1', claimedSkills: [] })
    expect(result.status).toBe('unavailable')
    expect(result.score).toBeNull()
  })

  it('scores 100 when every claimed skill has a confirmed career_win_capabilities row', async () => {
    const provider = new CareerVaultEvidenceCoverageProvider(makeFakeClient(['SQL', 'Leadership']))
    const result = await provider.score({ userId: 'user-1', claimedSkills: ['sql', 'leadership'] })
    expect(result.status).toBe('scored')
    expect(result.score).toBe(100)
    expect(result.findings).toEqual([])
  })

  it('reports a SKILL_MISSING_VAULT_EVIDENCE finding (never invented coverage) for a claimed skill with no confirmed evidence', async () => {
    const provider = new CareerVaultEvidenceCoverageProvider(makeFakeClient(['sql']))
    const result = await provider.score({ userId: 'user-1', claimedSkills: ['sql', 'leadership'] })
    expect(result.score).toBe(50)
    expect(result.findings).toHaveLength(1)
    expect(result.findings[0]).toMatchObject({ code: 'SKILL_MISSING_VAULT_EVIDENCE', evidence: 'leadership' })
  })

  it('matches skill names case-insensitively', async () => {
    const provider = new CareerVaultEvidenceCoverageProvider(makeFakeClient(['Sql']))
    const result = await provider.score({ userId: 'user-1', claimedSkills: ['SQL'] })
    expect(result.score).toBe(100)
  })

  it('surfaces a database error as unavailable rather than a fabricated score', async () => {
    const provider = new CareerVaultEvidenceCoverageProvider(makeFakeClient([], { message: 'connection refused' }))
    const result = await provider.score({ userId: 'user-1', claimedSkills: ['sql'] })
    expect(result.status).toBe('unavailable')
    expect(result.unavailableReason).toContain('connection refused')
  })
})
