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
 * Phase 5-8 completion pass: the member-facing requirement is "understand
 * WHY Evidence Coverage produced its result", not just a bare percentage.
 * This now reports four distinguishable finding kinds, each carrying its
 * own literal evidence and action, rather than only the original
 * missing-evidence gap:
 *  - `SKILL_STRONG_VAULT_EVIDENCE`  -- 2+ confirmed Career Wins back this claim.
 *  - `SKILL_WEAK_VAULT_EVIDENCE`    -- exactly 1 confirmed Career Win backs it.
 *  - `SKILL_MISSING_VAULT_EVIDENCE` -- claimed on the resume, zero confirmed evidence.
 *  - `VAULT_EVIDENCE_NOT_ON_RESUME` -- the reverse gap: a skill has confirmed
 *    Career Vault evidence but is not claimed anywhere on this resume version.
 *    Surfaced only as a finding/suggestion -- never silently added to the
 *    resume or promoted into canonical Profile fields (locked: Career
 *    Vault is evidence-only, mutated only through its own explicit
 *    propose/confirm flow).
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

    // Count confirmed capability rows per skill (case-insensitive) rather
    // than only presence/absence -- this is what lets a member tell
    // "strong" evidence (multiple confirmed wins) apart from "weak"
    // (exactly one), not just covered/not-covered.
    const confirmedCountBySkill = new Map<string, number>()
    for (const row of (data ?? []) as { skill_name: string }[]) {
      const key = row.skill_name.toLowerCase()
      confirmedCountBySkill.set(key, (confirmedCountBySkill.get(key) ?? 0) + 1)
    }

    const findings: ResumeFinding[] = []
    let coveredCount = 0
    const claimedSkillKeys = new Set(input.claimedSkills.map((s) => s.toLowerCase()))

    for (const skill of input.claimedSkills) {
      const confirmedCount = confirmedCountBySkill.get(skill.toLowerCase()) ?? 0
      if (confirmedCount >= 2) {
        coveredCount++
        findings.push({
          code: 'SKILL_STRONG_VAULT_EVIDENCE',
          severity: 'info',
          meaning: `This skill has strong Career Vault evidence -- ${confirmedCount} confirmed Career Wins demonstrate it.`,
          evidence: skill,
          action: 'No action needed.',
        })
      } else if (confirmedCount === 1) {
        coveredCount++
        findings.push({
          code: 'SKILL_WEAK_VAULT_EVIDENCE',
          severity: 'info',
          meaning: 'This skill has only one confirmed Career Vault win behind it -- evidence exists, but it is thin.',
          evidence: skill,
          action: 'Add another confirmed Career Win that demonstrates this skill to strengthen it.',
        })
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

    // Reverse direction: confirmed evidence the member already has, for a
    // skill this resume version doesn't claim at all. Surfaced as an
    // honest opportunity finding only -- never silently added to the
    // resume and never written back into member_profiles/Career Vault.
    for (const [skillKey, confirmedCount] of confirmedCountBySkill.entries()) {
      if (claimedSkillKeys.has(skillKey)) continue
      findings.push({
        code: 'VAULT_EVIDENCE_NOT_ON_RESUME',
        severity: 'info',
        meaning: `You have ${confirmedCount} confirmed Career Vault win(s) demonstrating this skill, but it is not claimed anywhere on this resume version.`,
        evidence: skillKey,
        action: 'Consider adding this skill to your resume if it is relevant to the role you are targeting.',
      })
    }

    const score = input.claimedSkills.length === 0 ? 0 : Math.round((coveredCount / input.claimedSkills.length) * 100)

    return {
      key: 'evidenceCoverage',
      label: 'Evidence Coverage',
      status: 'scored',
      score,
      findings,
    }
  }
}
