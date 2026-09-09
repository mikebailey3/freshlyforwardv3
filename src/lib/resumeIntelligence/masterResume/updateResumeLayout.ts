import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase as defaultClient } from '@/lib/supabase'
import { KNOWN_SECTION_KEYS } from '../presentation/types'
import { TEMPLATE_KEYS } from '../templates/registry'

export interface UpdateResumeLayoutResult {
  error: string | null
}

/**
 * Phase 5 — persists a member's chosen section order and template for one
 * of their own resume versions. Ownership-checked the same way as
 * `updateMasterResumeEntries` (ownership via `member_id = userId`, not
 * trusted from the client). Presentation-only: never touches
 * `member_profiles`, `resume_entries.included`, or which entries exist --
 * only `resume_versions.section_order`/`template_key`.
 */
export async function updateResumeLayout(
  userId: string,
  resumeVersionId: string,
  layout: { sectionOrder?: string[]; templateKey?: string },
  client: SupabaseClient = defaultClient,
): Promise<UpdateResumeLayoutResult> {
  const { data: version } = await client
    .from('resume_versions')
    .select('id')
    .eq('id', resumeVersionId)
    .eq('member_id', userId)
    .eq('is_archived', false)
    .maybeSingle()

  if (!version) {
    return { error: `Resume version '${resumeVersionId}' not found for this member -- refusing to write its layout.` }
  }

  const update: Record<string, unknown> = {}
  if (layout.sectionOrder) {
    const validSectionOrder = layout.sectionOrder.filter((key) => (KNOWN_SECTION_KEYS as string[]).includes(key))
    update.section_order = validSectionOrder
  }
  if (layout.templateKey) {
    if (!(TEMPLATE_KEYS as string[]).includes(layout.templateKey)) {
      return { error: `Unknown template '${layout.templateKey}'.` }
    }
    update.template_key = layout.templateKey
  }
  if (Object.keys(update).length === 0) return { error: null }

  const { error } = await client.from('resume_versions').update(update).eq('id', resumeVersionId)
  return { error: error?.message ?? null }
}
