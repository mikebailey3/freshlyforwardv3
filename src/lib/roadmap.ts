import { supabase } from '@/lib/supabase'
import type { CareerTimelineEvent } from '@/types'

export interface AddRoadmapMilestoneInput {
  memberId: string
  title: string
  description?: string
  eventDate?: string
  idempotencyKey?: string
}

export interface AddRoadmapMilestoneResult {
  milestone: CareerTimelineEvent | null
  error: string | null
}

/**
 * Creates a career_roadmap timeline milestone via the add_roadmap_milestone
 * SECURITY DEFINER RPC (supabase/migrations/20260907000000_add_roadmap_milestone_rpc.sql).
 * Unlike addTimelineEvent() (@/lib/profile), this deliberately returns
 * { error } to the caller instead of only console-logging it -- a failed
 * roadmap write must be visible to whoever tried to make it, not silent.
 */
export async function addRoadmapMilestone(input: AddRoadmapMilestoneInput): Promise<AddRoadmapMilestoneResult> {
  const { data, error } = await supabase.rpc('add_roadmap_milestone', {
    p_member_id: input.memberId,
    p_title: input.title,
    p_description: input.description ?? null,
    p_event_date: input.eventDate ?? null,
    p_idempotency_key: input.idempotencyKey ?? null,
  })

  if (error) {
    console.error('Error adding roadmap milestone:', error)
    return { milestone: null, error: error.message }
  }

  if (!data || typeof data !== 'object' || !('id' in data)) {
    console.error('Unexpected response from add_roadmap_milestone RPC:', data)
    return { milestone: null, error: 'Unexpected response from server' }
  }

  return { milestone: data as CareerTimelineEvent, error: null }
}
