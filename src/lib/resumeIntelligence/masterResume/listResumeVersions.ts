import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase as defaultClient } from '@/lib/supabase'

export interface ResumeVersionSummary {
  id: string
  title: string
  isMaster: boolean
  targetOpportunityId: string | null
  createdAt: string
}

interface ResumeVersionRow {
  id: string
  title: string
  is_master: boolean
  is_archived: boolean
  target_opportunity_id: string | null
  created_at: string
}

/**
 * Lists a member's non-archived resume versions (Master + any tailored
 * versions), ordered Master-first then newest-first -- the data behind
 * the Phase 4 "Resume Versions" panel that exposes
 * `promoteResumeVersionToMaster`. No tailored-version creation flow
 * exists yet (out of scope for Phase 4), so in practice this list is
 * just the Master today; it's written against the general shape rather
 * than a Master-only query so it needs no changes once tailoring ships.
 */
export async function listResumeVersions(
  userId: string,
  client: SupabaseClient = defaultClient,
): Promise<ResumeVersionSummary[]> {
  const { data } = await client
    .from('resume_versions')
    .select('id, title, is_master, is_archived, target_opportunity_id, created_at')
    .eq('member_id', userId)
    .eq('is_archived', false)
    .order('is_master', { ascending: false })

  return ((data ?? []) as ResumeVersionRow[]).map((row) => ({
    id: row.id,
    title: row.title,
    isMaster: row.is_master,
    targetOpportunityId: row.target_opportunity_id,
    createdAt: row.created_at,
  }))
}
