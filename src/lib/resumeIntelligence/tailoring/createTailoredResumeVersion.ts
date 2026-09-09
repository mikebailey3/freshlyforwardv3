import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase as defaultClient } from '@/lib/supabase'
import { duplicateResumeVersion } from '../masterResume/duplicateResumeVersion'

export interface CreateTailoredResumeVersionResult {
  newResumeVersionId: string | null
  error: string | null
}

/**
 * Phase 6 (6.4) — creates a job-specific derived resume version. This is
 * intentionally a thin wrapper around the existing `duplicateResumeVersion`
 * (Phase 5) rather than a second copy-a-version code path (DRY) -- it only
 * adds the one thing tailoring needs on top: stamping `target_opportunity_id`
 * so this version's lineage back to both its source version AND the
 * opportunity it was tailored for is durable and queryable.
 *
 * Never mutates the source (Master or otherwise) -- "tailoring never
 * silently changes the Master" (locked) holds here because the write path
 * underneath is the same duplicate-then-diverge path Phase 5 already
 * proved never touches the source row.
 */
export async function createTailoredResumeVersion(
  userId: string,
  sourceResumeVersionId: string,
  opportunityId: string,
  title: string,
  client: SupabaseClient = defaultClient,
): Promise<CreateTailoredResumeVersionResult> {
  const { newResumeVersionId, error } = await duplicateResumeVersion(userId, sourceResumeVersionId, title, client)
  if (error || !newResumeVersionId) return { newResumeVersionId: null, error }

  const { error: linkError } = await client.from('resume_versions').update({ target_opportunity_id: opportunityId }).eq('id', newResumeVersionId)
  if (linkError) return { newResumeVersionId, error: linkError.message }

  return { newResumeVersionId, error: null }
}
