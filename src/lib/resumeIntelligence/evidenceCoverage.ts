import type { EvidenceCoverageInput, EvidenceCoverageProvider, ResumeDimensionResult } from '@/types/resume'

/**
 * Evidence Coverage — what share of this resume's claimed skills have
 * confirmed Career Vault evidence behind them.
 *
 * Locked decision: this must read Career Vault's confirmed
 * `career_win_capabilities` rows — never invent substitute evidence.
 * Career Vault (`docs/superpowers/specs/2026-09-01-career-vault-capability-engine-design.md`)
 * has not been implemented yet (spec + plan approved, no migration
 * applied), so Phase 1 ships only the `EvidenceCoverageProvider`
 * interface (see src/types/resume.ts) and this null implementation,
 * which honestly reports the dimension as unavailable rather than
 * fabricating coverage data. A `CareerVaultEvidenceCoverageProvider` is a
 * later, interface-compatible swap once Career Vault ships.
 */
export class NullEvidenceCoverageProvider implements EvidenceCoverageProvider {
  score(_input: EvidenceCoverageInput): Promise<ResumeDimensionResult> {
    return Promise.resolve({
      key: 'evidenceCoverage',
      label: 'Evidence Coverage',
      status: 'unavailable',
      score: null,
      unavailableReason:
        'Career Vault does not exist yet, so no confirmed evidence is available to check skill coverage against. This dimension will score once a CareerVaultEvidenceCoverageProvider is implemented.',
      findings: [],
    })
  }
}
