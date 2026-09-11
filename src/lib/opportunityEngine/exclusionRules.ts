import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase as defaultClient } from '@/lib/supabase'
import type { MemberExclusionRule } from './memberOpportunityProfile'
import type { JobLike } from './jobNormalization'
import { normalizeCompanyName, normalizeTitle } from './jobNormalization'

/**
 * OE 2.0 Phase 9 -- persistent "don't show me this again" rules.
 *
 * Complements, does not replace, the existing `jobs_to_avoid` hard
 * constraint (src/lib/freshFitScore/exclusions.ts, OE 2.0 Phase 2):
 * `jobs_to_avoid` is a small free-text list of job TITLES a member
 * states once during onboarding; these rules are member-initiated,
 * ongoing "block this company/keyword/industry going forward" actions
 * that accumulate over time (e.g. from repeatedly dismissing similar
 * matches) and can be added or removed independently of that onboarding
 * field. Both are read into `MemberOpportunityProfile`
 * (memberOpportunityProfile.ts) and both ultimately feed the same
 * pre-filter step in `scripts/syncFreshFitScores.ts` -- two input
 * sources, one enforcement point, never two parallel filtering systems.
 */

/**
 * Pure matcher -- true when a job matches at least one of the member's
 * exclusion rules. Reuses Phase 1's `normalizeTitle`/`normalizeCompanyName`
 * (no new text-matching logic invented here) so "Acme Inc." and "acme"
 * match a company rule the exact same way the rest of this codebase
 * already treats them.
 */
export function isExcludedByRules(job: JobLike, rules: MemberExclusionRule[]): boolean {
  if (rules.length === 0) return false

  const normalizedCompany = normalizeCompanyName(job.company)
  const normalizedTitle = normalizeTitle(job.title)

  return rules.some((rule) => {
    const normalizedValue = rule.ruleType === 'company' ? normalizeCompanyName(rule.value) : normalizeTitle(rule.value)
    if (!normalizedValue) return false

    switch (rule.ruleType) {
      case 'company':
        return normalizedCompany === normalizedValue
      case 'title_keyword':
        return normalizedTitle.includes(normalizedValue)
      case 'industry':
        // No structured industry field exists on scraped_jobs today --
        // best-effort keyword match against the free-text description.
        // Same "Unknown != Missing" caution as everywhere else in this
        // codebase: a miss here only ever means "not excluded," never a
        // false-positive block.
        return normalizeTitle(job.description).includes(normalizedValue)
      default:
        return false
    }
  })
}

export async function getExclusionRules(
  memberId: string,
  client: SupabaseClient = defaultClient
): Promise<MemberExclusionRule[]> {
  const { data, error } = await client
    .from('member_job_exclusion_rules')
    .select('rule_type, value')
    .eq('member_id', memberId)

  if (error) {
    // Expected, safe degradation until the Phase 9 migration is applied
    // -- see that migration's own docs. No exclusion rules simply means
    // nothing gets pre-filtered; scoring/ranking behavior is unaffected.
    console.error('Error fetching member exclusion rules:', error)
    return []
  }

  return (data ?? []).map((row) => ({
    ruleType: row.rule_type as MemberExclusionRule['ruleType'],
    value: row.value as string,
  }))
}

export async function addExclusionRule(
  memberId: string,
  rule: MemberExclusionRule,
  client: SupabaseClient = defaultClient
): Promise<void> {
  const { error } = await client
    .from('member_job_exclusion_rules')
    .upsert(
      { member_id: memberId, rule_type: rule.ruleType, value: rule.value },
      { onConflict: 'member_id,rule_type,value' }
    )

  if (error) console.error('Error adding member exclusion rule:', error)
}

export async function removeExclusionRule(
  memberId: string,
  rule: MemberExclusionRule,
  client: SupabaseClient = defaultClient
): Promise<void> {
  const { error } = await client
    .from('member_job_exclusion_rules')
    .delete()
    .eq('member_id', memberId)
    .eq('rule_type', rule.ruleType)
    .eq('value', rule.value)

  if (error) console.error('Error removing member exclusion rule:', error)
}
