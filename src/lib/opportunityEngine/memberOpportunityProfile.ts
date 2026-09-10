import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase as defaultClient } from '@/lib/supabase'
import { getSkillStates } from '@/lib/forwardDna/skills'
import { getAllScopeForUser } from '@/lib/forwardDna/scope'
import type { CareerSkill, CareerScope } from '@/types/forwardDna'
import type { MemberProfile } from '@/types'

/**
 * Phase 0 (OE 2.0) — the canonical, read-only "member opportunity profile"
 * composition. This is the single place Opportunity Engine / FreshFit
 * assemble everything they need to know about a member, sourced entirely
 * from existing canonical systems:
 *
 *  - Forward Profile / `member_profiles` — passed in by the caller (every
 *    call site already has it loaded; re-fetching it here would be a
 *    redundant round trip, not a DRY win, and would risk a second,
 *    possibly-stale read of the one canonical identity record).
 *  - Forward DNA (`career_skills`, `career_scope`) — the skills/scope
 *    evidence layer FreshFit's skills dimension already reads from.
 *  - Career Vault (`career_win_capabilities`, status = 'confirmed') — the
 *    strongest possible evidence: a member-confirmed, capability-engine
 *    -reasoned skill promoted out of a real Career Win. Career Vault
 *    remains the evidence/source-of-truth layer; nothing here writes to
 *    it or duplicates its state machine.
 *  - Career Compass (`career_compass_results`, `is_current` row) — the
 *    existing career-direction signal already used by FreshFit's
 *    `careerDirection` dimension.
 *
 * This function is a pure read/composition step — no new table, no new
 * identity concept, no writes anywhere. It replaces the fetch logic that
 * used to live independently (and had started to drift) in
 * `opportunityEngine.ts::submitMemberJob` and
 * `scripts/syncFreshFitScores.ts::main`.
 *
 * PRIVACY: Career Vault evidence and confirmed capabilities are strictly
 * internal to the Opportunity Engine / FreshFit scoring path. This
 * function must never be called from, or have its output attached to,
 * anything rendered on a public Forward Profile page (`/u/:username`) --
 * that surface has its own explicit allow-list (see publicProfile.ts)
 * and Career Vault evidence is not on it. Nothing in this file changes
 * that; it only reads Career Vault for scoring, same trust boundary the
 * existing member-only Career Vault RLS policies already enforce.
 */

/**
 * Forward-looking placeholder for Phase 9's `member_job_exclusion_rules`
 * table, which does not exist yet. Modeled as a real (if currently
 * unused) type -- rather than `unknown[]` -- so Phase 9 only has to add
 * the query and populate this array; it does not need to touch this
 * interface's shape or any Phase 0 call site.
 */
export interface MemberExclusionRule {
  ruleType: 'company' | 'title_keyword' | 'industry'
  value: string
}

export interface MemberOpportunityProfile {
  /** As-is, canonical Forward Profile -- never refetched, always the caller's own loaded copy. */
  profile: MemberProfile
  /** Forward DNA skill-evidence state machine. */
  skills: CareerSkill[]
  /** Forward DNA scope evidence (team size, budget, etc.). */
  scope: CareerScope[]
  /** Career Vault: confirmed (status='confirmed') skill names only -- never 'pending'/'rejected'. */
  confirmedCapabilities: string[]
  /** Career Compass's current readiness_scores.careerDirection, or null if none/not completed. */
  careerDirectionScore: number | null
  /** Always empty until Phase 9 wires the real table -- present now so later phases don't change this interface's shape. */
  exclusionRules: MemberExclusionRule[]
}

interface ConfirmedCapabilityRow {
  skill_name: string
}

interface CareerCompassReadinessRow {
  readiness_scores: { careerDirection?: number | null } | null
}

/**
 * De-dupes and normalizes raw `career_win_capabilities` rows into a flat
 * skill-name list. Pure and independently testable -- malformed/duplicate
 * rows (e.g. the same skill confirmed via two different Career Wins)
 * must never produce duplicate or crash-inducing output.
 */
export function extractConfirmedCapabilitySkills(
  rows: ConfirmedCapabilityRow[] | null | undefined
): string[] {
  if (!rows) return []
  return [...new Set(rows.map((row) => row.skill_name).filter((name): name is string => Boolean(name)))]
}

/**
 * Pulls the career-direction score out of a `career_compass_results` row
 * shape. Pure and independently testable against every malformed shape
 * FreshFit's "Unknown != Missing" principle requires tolerating: no row
 * at all, a row with a null `readiness_scores`, or a row whose
 * `readiness_scores` simply doesn't carry `careerDirection` yet.
 */
export function extractCareerDirectionScore(
  row: CareerCompassReadinessRow | null | undefined
): number | null {
  return row?.readiness_scores?.careerDirection ?? null
}

/**
 * The pure composition step, deliberately separated from the async fetch
 * below. `submitMemberJob` (one member, interactive) and
 * `scripts/syncFreshFitScores.ts` (all members, batch) fetch these same
 * four inputs with two very different query strategies for good reason
 * -- one member's worth of per-user queries is cheap and simple for an
 * interactive submission; re-running four per-user queries once per
 * member inside a batch script that already bulk-fetches
 * `career_skills`/`career_scope`/`career_compass_results` once each
 * would be a real N+1 regression, not a DRY win. Sharing *this* function
 * -- "how do we turn already-fetched rows into a MemberOpportunityProfile"
 * -- is the actual duplication to eliminate; each call site keeps
 * whichever fetch strategy fits its access pattern.
 */
export function composeMemberOpportunityProfile(
  profile: MemberProfile,
  inputs: {
    skills: CareerSkill[]
    scope: CareerScope[]
    confirmedCapabilityRows: ConfirmedCapabilityRow[] | null | undefined
    compassRow: CareerCompassReadinessRow | null | undefined
    exclusionRules?: MemberExclusionRule[]
  }
): MemberOpportunityProfile {
  return {
    profile,
    skills: inputs.skills,
    scope: inputs.scope,
    confirmedCapabilities: extractConfirmedCapabilitySkills(inputs.confirmedCapabilityRows),
    careerDirectionScore: extractCareerDirectionScore(inputs.compassRow),
    exclusionRules: inputs.exclusionRules ?? [],
  }
}

/**
 * Single-member fetch + compose, for interactive call sites that already
 * have exactly one member's `MemberProfile` in hand (e.g. a member
 * submitting their own job lead). Runs all four canonical reads in
 * parallel; never writes anything.
 */
export async function buildMemberOpportunityProfile(
  userId: string,
  profile: MemberProfile,
  client: SupabaseClient = defaultClient
): Promise<MemberOpportunityProfile> {
  const [{ skills }, { scope }, capabilitiesResult, compassResult] = await Promise.all([
    getSkillStates(userId, client),
    getAllScopeForUser(userId, client),
    client.from('career_win_capabilities').select('skill_name').eq('user_id', userId).eq('status', 'confirmed'),
    client.from('career_compass_results').select('readiness_scores').eq('user_id', userId).eq('is_current', true).maybeSingle(),
  ])

  return composeMemberOpportunityProfile(profile, {
    skills,
    scope,
    confirmedCapabilityRows: (capabilitiesResult.data as ConfirmedCapabilityRow[] | null) ?? [],
    compassRow: compassResult.data as CareerCompassReadinessRow | null,
  })
}
