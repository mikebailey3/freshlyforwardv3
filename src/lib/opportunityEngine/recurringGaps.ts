import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase as defaultClient } from '@/lib/supabase'
import type { JobMatchScoreBreakdown } from '@/types'

/**
 * OE 2.0 Phase 6 -- "you keep missing X" insight. Purely a derived,
 * read-only aggregation over data FreshFit already persists; no new
 * table, no second scoring engine, per the approved plan's explicit
 * YAGNI call ("aggregates confirmed_gap entries out of the member's
 * currently persisted job_matches.score_breakdown->v2->dimensions[].gaps
 * -- derived query over existing data"). If real usage later proves the
 * Top-N persistence pruning erases this signal before a pattern can
 * emerge, the plan's own fallback (a `gap_frequency_snapshots` table) is
 * a new schema decision that needs explicit approval -- not something
 * to add speculatively here.
 */
export interface RecurringGap {
  skill: string
  frequency: number
}

/**
 * A gap must show up in at least this many of a member's currently
 * persisted matches before it's "recurring" -- a single missed skill in
 * one job is just a gap, not a pattern. Deliberately small (the whole
 * point is catching a repeated theme early, not waiting for a large
 * sample); exported as a named constant rather than a magic number so
 * `getRecurringGaps`'s default and this file's tests can never drift.
 */
export const MIN_RECURRING_FREQUENCY = 2

interface JobMatchGapRow {
  score_breakdown: (JobMatchScoreBreakdown & { v2?: JobMatchScoreBreakdown['v2'] }) | Record<string, never> | null | undefined
}

/**
 * Pure aggregation step, deliberately separated from the fetch below
 * (same split as `memberOpportunityProfile.ts`'s compose/build pair) --
 * independently testable without a fake Supabase client.
 *
 * Reads ONLY the `skillsEvidence` dimension's `gaps` array. That field
 * is documented (see `FreshFitDimensionResult`) to hold confirmed gaps
 * exclusively -- it never includes `unknowns` -- so this can never turn
 * missing/unclear evidence into a false "you're missing this skill"
 * claim ("Unknown != Missing" is enforced upstream by FreshFit itself;
 * this function simply never reads the `unknowns` field at all). Other
 * dimensions' `gaps` arrays hold qualitatively different, non-skill text
 * (e.g. compensation/career-direction phrasing) that would not make
 * sense next to a "add skill evidence to Forward DNA" call to action,
 * so they are deliberately excluded -- this is a skills-evidence
 * insight, matching the plan's own remediation copy.
 *
 * Legacy (`engine_version = 1`) or malformed rows -- no `v2`, no
 * `dimensions`, no `skillsEvidence` entry -- are skipped, never thrown
 * on; a batch of scoring history is expected to contain a mix of engine
 * versions over a member's lifetime.
 */
export function extractRecurringGaps(
  rows: JobMatchGapRow[] | null | undefined,
  minFrequency: number = MIN_RECURRING_FREQUENCY
): RecurringGap[] {
  if (!rows) return []

  const frequencyBySkill = new Map<string, number>()

  for (const row of rows) {
    const breakdown = row?.score_breakdown
    const dimensions = breakdown && 'v2' in breakdown ? breakdown.v2?.dimensions : undefined
    if (!dimensions) continue

    const skillsDimension = dimensions.find((d) => d.key === 'skillsEvidence')
    if (!skillsDimension) continue

    // A skill counts once per job match, never once per duplicate
    // mention within the same match's own (already-deduped) gaps list --
    // this guards frequency semantics even if that upstream guarantee
    // ever changes.
    const seenThisMatch = new Set<string>()
    for (const gap of skillsDimension.gaps) {
      const skill = gap.trim().toLowerCase()
      if (!skill || seenThisMatch.has(skill)) continue
      seenThisMatch.add(skill)
      frequencyBySkill.set(skill, (frequencyBySkill.get(skill) ?? 0) + 1)
    }
  }

  return [...frequencyBySkill.entries()]
    .filter(([, frequency]) => frequency >= minFrequency)
    .map(([skill, frequency]) => ({ skill, frequency }))
    .sort((a, b) => b.frequency - a.frequency || a.skill.localeCompare(b.skill))
}

/**
 * Fetches a member's own currently-persisted `job_matches` (v2 engine
 * only -- the only version with a structured `score_breakdown.v2`) and
 * aggregates recurring skill gaps. Every match the member currently has
 * on file counts, regardless of dismissed/promoted status -- a
 * dismissal reflects what the member decided to do about one posting,
 * not whether the underlying skill-evidence gap FreshFit found was
 * real, so excluding dismissed/promoted rows would just undercount a
 * real pattern.
 *
 * Privacy: reads only this member's own `job_matches` rows (the same
 * RLS-scoped table every other Opportunity Engine read already uses) --
 * no cross-member aggregation, no new table, nothing exposed that this
 * member couldn't already see on their own match cards.
 */
export async function getRecurringGaps(
  memberId: string,
  client: SupabaseClient = defaultClient,
  minFrequency: number = MIN_RECURRING_FREQUENCY
): Promise<RecurringGap[]> {
  const { data } = await client
    .from('job_matches')
    .select('score_breakdown')
    .eq('member_id', memberId)
    .eq('engine_version', 2)

  return extractRecurringGaps(data as JobMatchGapRow[] | null, minFrequency)
}
