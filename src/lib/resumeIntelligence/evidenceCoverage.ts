import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase as defaultClient } from '@/lib/supabase'
import type { EvidenceCoverageInput, EvidenceCoverageProvider, ResumeDimensionResult, ResumeFinding } from '@/types/resume'

/**
 * Evidence Coverage — what share of this resume's claimed skills have
 * confirmed Career Vault evidence behind them.
 *
 * Locked decision: this must read Career Vault's confirmed
 * `career_win_capabilities` rows — never invent substitute evidence.
 * Career Vault has since shipped its schema
 * (`supabase/migrations/20260908000000_career_vault.sql`), so Phase 7
 * replaces the Phase 1 `NullEvidenceCoverageProvider` with a real,
 * interface-compatible `CareerVaultEvidenceCoverageProvider` below. The
 * Null provider is kept for callers/tests that want an honest
 * "unavailable" dimension without a database round trip (e.g. a resume
 * with zero claimed skills, or an environment with no Supabase client).
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

/**
 * Phase 7 — reads `career_win_capabilities` rows with
 * `status = 'confirmed'` for this member, matches them (case-insensitive)
 * against the resume's claimed skills, and reports what fraction have
 * confirmed evidence behind them. `pending`/`rejected` capability rows
 * never count as coverage -- only an explicit member- or system-then-
 * member-confirmed row is "confirmed evidence" (mirrors the propose/
 * accept discipline used everywhere else in this system).
 *
 * A skill with zero confirmed capability rows is reported as a finding,
 * not silently omitted -- the member should know which claims on their
 * resume currently have no vault evidence, exactly the same "coverage
 * gap, not a fabricated pass" spirit as FreshFit's gap reporting.
 */
export class CareerVaultEvidenceCoverageProvider implements EvidenceCoverageProvider {
  constructor(private readonly client: SupabaseClient = defaultClient) {}

  async score(input: EvidenceCoverageInput): Promise<ResumeDimensionResult> {
    if (input.claimedSkills.length === 0) {
      return {
        key: 'evidenceCoverage',
        label: 'Evidence Coverage',
        status: 'unavailable',
        score: null,
        unavailableReason: 'This resume does not claim any skills yet, so there is nothing to check evidence coverage against.',
        findings: [],
      }
    }

    const { data, error } = await this.client
      .from('career_win_capabilities')
      .select('skill_name')
      .eq('user_id', input.userId)
      .eq('status', 'confirmed')

    if (error) {
      return {
        key: 'evidenceCoverage',
        label: 'Evidence Coverage',
        status: 'unavailable',
        score: null,
        unavailableReason: `Could not read Career Vault evidence: ${error.message}`,
        findings: [],
      }
    }

    const confirmedSkills = new Set(((data ?? []) as { skill_name: string }[]).map((row) => row.skill_name.toLowerCase()))

    const findings: ResumeFinding[] = []
    let coveredCount = 0

    for (const skill of input.claimedSkills) {
      const covered = confirmedSkills.has(skill.toLowerCase())
      if (covered) {
        coveredCount++
      } else {
        findings.push({
          code: 'SKILL_MISSING_VAULT_EVIDENCE',
          severity: 'info',
          meaning: 'This skill is claimed on your resume but has no confirmed Career Vault evidence behind it yet.',
          evidence: skill,
          action: 'Add a Career Win that demonstrates this skill, or remove the claim if it no longer applies.',
        })
      }
    }

    const score = Math.round((coveredCount / input.claimedSkills.length) * 100)

    return {
      key: 'evidenceCoverage',
      label: 'Evidence Coverage',
      status: 'scored',
      score,
      findings,
    }
  }
}
