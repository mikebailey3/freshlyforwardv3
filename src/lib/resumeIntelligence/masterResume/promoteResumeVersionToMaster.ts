import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase as defaultClient } from '@/lib/supabase'

export interface PromoteResumeVersionToMasterResult {
  error: string | null
}

/**
 * Phase 4 punch-list item #3: "promote a tailored version to Master",
 * using the already-authored `set_master_resume_version()` atomic-swap
 * RPC (in the Phase 2/3 migration, never called from application code
 * until now). Deliberately a thin wrapper -- the RPC itself is
 * `SECURITY DEFINER` and does the actual atomic single-statement swap
 * (see the migration's "Design note: atomic Master swap"); this
 * function's only job is exposing that swap to the UI layer as a typed,
 * non-throwing call.
 *
 * No tailored-version creation flow exists yet in this codebase
 * (explicitly out of scope for Phase 4 -- see the handoff's exclusions
 * list), so today the only versions available to promote are ones a
 * member already has. That's fine: this function has no dependency on
 * how a version was created, only that it exists and belongs to the
 * caller (enforced inside the RPC itself via `auth.uid()`).
 */
export async function promoteResumeVersionToMaster(
  resumeVersionId: string,
  client: SupabaseClient = defaultClient,
): Promise<PromoteResumeVersionToMasterResult> {
  const { error } = await client.rpc('set_master_resume_version', { p_new_master_id: resumeVersionId })
  return { error: error?.message ?? null }
}
