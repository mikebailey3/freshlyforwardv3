import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase as defaultClient } from '@/lib/supabase'
import { fetchMasterResumeEntries } from '../masterResume/fetchMasterResumeEntries'
import type { MasterResumeEntryInput } from '../masterResume/resumeEntryValidation'

export interface ResumeVersionBuilderTargetOpportunity {
  id: string
  jobTitle: string
  employer: string
}

export interface ResumeVersionBuilderData {
  id: string
  title: string
  isMaster: boolean
  templateKey: string
  sectionOrder: string[] | null
  summaryOverride: string | null
  derivedFromResumeVersionId: string | null
  /** Null for the Master and for any derived version not tailored to a specific opportunity. */
  targetOpportunity: ResumeVersionBuilderTargetOpportunity | null
  entries: MasterResumeEntryInput[]
}

interface ResumeVersionRow {
  id: string
  title: string
  is_master: boolean
  template_key: string
  section_order: string[] | null
  summary_override: string | null
  derived_from_resume_version_id: string | null
  target_opportunity_id: string | null
}

/**
 * Phase 5 completion — the one loader the live Resume Builder page needs
 * for a given resume version: the version's own row (ownership +
 * non-archived checked here, exactly like every other version-scoped
 * write in this module) plus its entries. Deliberately does NOT also
 * fetch `member_profiles` -- every call site already has the signed-in
 * member's profile from `useAuth()`, and re-fetching it here would just
 * be a second, potentially-stale copy of the same canonical data.
 *
 * Returns null (never throws, never fabricates a placeholder version) if
 * the version does not exist, does not belong to this member, or is
 * archived -- the page renders this as an honest "not found" state.
 */
export async function fetchResumeVersionBuilderData(
  userId: string,
  resumeVersionId: string,
  client: SupabaseClient = defaultClient,
): Promise<ResumeVersionBuilderData | null> {
  const { data: version } = await client
    .from('resume_versions')
    .select('id, title, is_master, template_key, section_order, summary_override, derived_from_resume_version_id, target_opportunity_id')
    .eq('id', resumeVersionId)
    .eq('member_id', userId)
    .eq('is_archived', false)
    .maybeSingle()

  if (!version) return null

  const row = version as ResumeVersionRow
  const entries = await fetchMasterResumeEntries(resumeVersionId, client)

  let targetOpportunity: ResumeVersionBuilderTargetOpportunity | null = null
  if (row.target_opportunity_id) {
    const { data: opportunity } = await client
      .from('opportunities')
      .select('id, job_title, employer')
      .eq('id', row.target_opportunity_id)
      .maybeSingle()
    if (opportunity) {
      const oppRow = opportunity as { id: string; job_title: string; employer: string }
      targetOpportunity = { id: oppRow.id, jobTitle: oppRow.job_title, employer: oppRow.employer }
    }
  }

  return {
    id: row.id,
    title: row.title,
    isMaster: row.is_master,
    templateKey: row.template_key,
    sectionOrder: row.section_order,
    summaryOverride: row.summary_override,
    derivedFromResumeVersionId: row.derived_from_resume_version_id,
    targetOpportunity,
    entries,
  }
}
