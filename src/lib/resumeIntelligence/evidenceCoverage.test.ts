import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { NullEvidenceCoverageProvider, CareerVaultEvidenceCoverageProvider } from './evidenceCoverage'

/**
 * Evidence Coverage must read Career Vault's confirmed
 * career_win_capabilities — never invent substitute evidence (locked
 * decision). This suite covers the `NullEvidenceCoverageProvider`, which
 * reports the dimension as honestly 'unavailable' whenever no real
 * evidence provider is injected (e.g. no database round trip available),
 * separately from `CareerVaultEvidenceCoverageProvider` below, which is
 * the real, shipped implementation.
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

  it('scores 100 and reports WEAK evidence findings when every claimed skill has exactly one confirmed career_win_capabilities row', async () => {
    const provider = new CareerVaultEvidenceCoverageProvider(makeFakeClient(['SQL', 'Leadership']))
    const result = await provider.score({ userId: 'user-1', claimedSkills: ['sql', 'leadership'] })
    expect(result.status).toBe('scored')
    expect(result.score).toBe(100)
    expect(result.findings).toHaveLength(2)
    expect(result.findings.every((f) => f.code === 'SKILL_WEAK_VAULT_EVIDENCE')).toBe(true)
  })

  it('reports STRONG evidence when a claimed skill has 2+ confirmed career_win_capabilities rows', async () => {
    const provider = new CareerVaultEvidenceCoverageProvider(makeFakeClient(['SQL', 'SQL', 'SQL']))
    const result = await provider.score({ userId: 'user-1', claimedSkills: ['sql'] })
    expect(result.score).toBe(100)
    expect(result.findings).toEqual([expect.objectContaining({ code: 'SKILL_STRONG_VAULT_EVIDENCE', evidence: 'sql' })])
  })

  it('reports a SKILL_MISSING_VAULT_EVIDENCE finding (never invented coverage) for a claimed skill with no confirmed evidence', async () => {
    const provider = new CareerVaultEvidenceCoverageProvider(makeFakeClient(['sql']))
    const result = await provider.score({ userId: 'user-1', claimedSkills: ['sql', 'leadership'] })
    expect(result.score).toBe(50)
    const missing = result.findings.filter((f) => f.code === 'SKILL_MISSING_VAULT_EVIDENCE')
    expect(missing).toHaveLength(1)
    expect(missing[0]).toMatchObject({ code: 'SKILL_MISSING_VAULT_EVIDENCE', evidence: 'leadership' })
  })

  it('surfaces confirmed Career Vault evidence for a skill NOT claimed on this resume as an honest opportunity finding -- never silently adds it', async () => {
    const provider = new CareerVaultEvidenceCoverageProvider(makeFakeClient(['python']))
    const result = await provider.score({ userId: 'user-1', claimedSkills: ['sql'] })
    const notOnResume = result.findings.filter((f) => f.code === 'VAULT_EVIDENCE_NOT_ON_RESUME')
    expect(notOnResume).toHaveLength(1)
    expect(notOnResume[0]).toMatchObject({ evidence: 'python' })
    // the claimed skill itself still gets its own (missing-evidence) finding -- the reverse finding is purely additive
    expect(result.findings.some((f) => f.code === 'SKILL_MISSING_VAULT_EVIDENCE')).toBe(true)
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
