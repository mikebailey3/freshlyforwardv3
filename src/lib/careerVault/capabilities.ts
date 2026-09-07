import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase as defaultClient } from '@/lib/supabase'
import type { CareerWinCapability, CapabilitySource } from '@/types/careerVault'

export interface ConfirmCapabilityInput {
  careerWinId: string
  skillName: string
  source: CapabilitySource
  inferenceReason: string | null
}

/**
 * Upgrades one skill to 'demonstrated' without ever downgrading it, using
 * two atomic single-table statements instead of a read-then-write snapshot
 * (fix round 1 -- a read-then-write check was racy against the existing
 * SkillEvidenceCard UI, which lets a member set their own skill straight to
 * 'supported' via a direct upsertSkillState call at any time):
 *
 * 1. Conditional UPDATE, guarded by its own WHERE clause -- only matches
 *    (and only touches) a row that is currently weaker than 'demonstrated'.
 *    A row already at 'demonstrated' or 'supported' can never match this
 *    statement, regardless of timing, because Postgres evaluates the WHERE
 *    clause against the row's state at the instant of the UPDATE.
 * 2. INSERT ... ON CONFLICT (user_id, skill_name) DO NOTHING -- only fires
 *    when no row exists at all yet. If a row already exists in any state
 *    (including one created by a concurrent request between steps 1 and 2),
 *    this is a guaranteed no-op; it can never overwrite an existing row.
 *
 * Together these two atomic, independently-safe statements make the
 * never-downgrade guarantee hold regardless of concurrent writers, with no
 * read-modify-write window and no application-level locking required.
 * This intentionally does NOT reuse the shared `upsertSkillState` from
 * forwardDna/skills.ts, which is a correct *blind* upsert for its own use
 * case (a member directly picking a state in SkillEvidenceCard always means
 * exactly what they clicked) but would silently reintroduce this race if
 * reused here.
 */
async function upgradeSkillToDemonstratedIfWeaker(
  userId: string,
  skillName: string,
  client: SupabaseClient
): Promise<{ error: string | null }> {
  // Order matters (fix round 2): INSERT first, UPDATE second. If we did
  // UPDATE-then-INSERT, a concurrent writer that creates the row (e.g.
  // syncSkillsFromProfile inserting a brand-new skill at 'claimed' on page
  // load) between our two statements would make our own INSERT's ON
  // CONFLICT DO NOTHING silently no-op, permanently stranding the skill at
  // 'claimed' with no later statement left to catch it. With INSERT first,
  // whichever statement "loses" a race to create the row, the UPDATE runs
  // unconditionally afterward and will still find and fix any row weaker
  // than 'demonstrated' -- regardless of which statement actually created
  // it. Both statements individually already guarantee never-downgrade;
  // this ordering additionally guarantees the upgrade itself can't be lost.
  const { error: insertError } = await client
    .from('career_skills')
    .upsert(
      { user_id: userId, skill_name: skillName, state: 'demonstrated', evidence_note: null },
      { onConflict: 'user_id,skill_name', ignoreDuplicates: true }
    )
  if (insertError) return { error: insertError.message }

  const { error: updateError } = await client
    .from('career_skills')
    .update({ state: 'demonstrated' })
    .eq('user_id', userId)
    .eq('skill_name', skillName)
    .neq('state', 'demonstrated')
    .neq('state', 'supported')

  return { error: updateError?.message ?? null }
}

function dedupeByWinAndSkill(inputs: ConfirmCapabilityInput[]): ConfirmCapabilityInput[] {
  const seen = new Set<string>()
  const deduped: ConfirmCapabilityInput[] = []
  for (const input of inputs) {
    const key = `${input.careerWinId}::${input.skillName}`
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(input)
  }
  return deduped
}

/**
 * Persists one confirmed career_win_capabilities row per input, then
 * upgrades career_skills.state to 'demonstrated' for each skill_name.
 * Locked to 'demonstrated' for v1 (spec section 7.1, Decision 1) -- this
 * function has no parameter that could produce 'supported', matching the
 * DB CHECK constraint from Task 1.
 *
 * Idempotent across repeat calls with the same (careerWinId, skillName)
 * pairs (fix round 2) -- e.g. a double-click on "Confirm" or a client-side
 * retry after a flaky response resubmits identical rows. Uses
 * upsert(..., ignoreDuplicates) rather than a plain insert so a resubmit
 * silently skips already-persisted pairs instead of hard-failing the
 * entire batch (a plain multi-row INSERT would reject all rows together
 * if even one violated the UNIQUE (career_win_id, skill_name) constraint).
 * Within a single call, duplicates are also pre-filtered by
 * dedupeByWinAndSkill so the same pair is never sent twice in one request.
 *
 * Attempts every input's skill-state upgrade even if an earlier one fails
 * (fix round 1) -- a single transient failure on one skill in a batch no
 * longer silently abandons the rest. All caught errors are joined into one
 * message; the caller should treat a non-null error as "some upgrades may
 * not have applied" and can re-check state via getSkillStates if needed.
 *
 * Consumer contract callers must not violate (per review):
 * - A resubmit of an already-persisted (careerWinId, skillName) pair
 *   returns `capabilities: [], error: null` -- this is success, not
 *   failure. Do not treat an empty array as "nothing was confirmed."
 * - If ever called twice for the same pair with DIFFERENT source/
 *   inferenceReason values (not the case in Task 7's single-Save call
 *   pattern today), the second call's metadata is silently discarded --
 *   ON CONFLICT DO NOTHING keeps whichever write landed first. Fine for
 *   an identical-retry/double-click resubmit; would need a real upsert
 *   (not ignoreDuplicates) if a future "re-infer and re-confirm" flow
 *   needs the newer metadata to win.
 */
export async function confirmCapabilities(
  userId: string,
  inputs: ConfirmCapabilityInput[],
  client: SupabaseClient = defaultClient
): Promise<{ capabilities: CareerWinCapability[]; error: string | null }> {
  if (inputs.length === 0) return { capabilities: [], error: null }

  const deduped = dedupeByWinAndSkill(inputs)
  const now = new Date().toISOString()
  const rows = deduped.map((input) => ({
    career_win_id: input.careerWinId,
    user_id: userId,
    skill_name: input.skillName,
    suggested_state: 'demonstrated' as const,
    source: input.source,
    inference_reason: input.inferenceReason,
    status: 'confirmed' as const,
    decided_at: now,
  }))

  const { data, error } = await client
    .from('career_win_capabilities')
    .upsert(rows, { onConflict: 'career_win_id,skill_name', ignoreDuplicates: true })
    .select('*')
  if (error) return { capabilities: [], error: error.message }

  const upgradeErrors: string[] = []
  for (const input of deduped) {
    const { error: upgradeError } = await upgradeSkillToDemonstratedIfWeaker(userId, input.skillName, client)
    if (upgradeError) upgradeErrors.push(`${input.skillName}: ${upgradeError}`)
  }

  return {
    capabilities: (data as CareerWinCapability[]) ?? [],
    error: upgradeErrors.length > 0 ? upgradeErrors.join('; ') : null,
  }
}

export async function getCapabilitiesForCareerWin(
  careerWinId: string,
  client: SupabaseClient = defaultClient
): Promise<{ capabilities: CareerWinCapability[]; error: string | null }> {
  const { data, error } = await client
    .from('career_win_capabilities')
    .select('*')
    .eq('career_win_id', careerWinId)
    .eq('status', 'confirmed')

  return { capabilities: (data as CareerWinCapability[]) ?? [], error: error?.message ?? null }
}
