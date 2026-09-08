import { describe, expect, it } from 'vitest'
import { NullEvidenceCoverageProvider } from './evidenceCoverage'

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
