import { supabase } from '@/lib/supabase'
import type { CareerTimelineEvent } from '@/types'

// The only two career_timeline event types /roadmap (and the Career
// Success roadmap teaser, independently) treat as roadmap milestones.
export const ROADMAP_EVENT_TYPES = ['career_roadmap', 'promotion_coaching'] as const

export function isRoadmapMilestoneEvent(event: CareerTimelineEvent): boolean {
  return (ROADMAP_EVENT_TYPES as readonly string[]).includes(event.event_type)
}

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

export interface GetRoadmapMilestonesResult {
  milestones: CareerTimelineEvent[]
  error: string | null
}

/**
 * Fetches THE CALLER'S OWN roadmap milestones from career_timeline.
 *
 * Self-view only: this issues a plain client-side query, which is still
 * gated by career_timeline's owner-only RLS policy (`auth.uid() = user_id`).
 * Unlike add_roadmap_milestone (the SECURITY DEFINER RPC), there is no
 * strategist/admin-aware read path here -- calling this with a member id
 * other than the caller's own auth.uid() will silently return an empty
 * list (RLS filters the rows, it does not error). Do not wire this into
 * any strategist-facing screen without adding a paired SECURITY DEFINER
 * read RPC first.
 *
 * Deliberately does NOT reuse getTimeline() (@/lib/profile) even though
 * the query shape is nearly identical: getTimeline() swallows Supabase
 * errors internally and always resolves to [], which makes a genuine
 * fetch failure indistinguishable from a genuine empty roadmap. Three
 * other call sites (CalendarPage, CareerSuccessRoadmapTeaser) rely on
 * that swallow-everything behavior today, so it is not changed here --
 * this is a small, intentional duplication of one query shape, not a
 * refactor of getTimeline().
 */
export async function getRoadmapMilestones(userId: string): Promise<GetRoadmapMilestonesResult> {
  const { data, error } = await supabase
    .from('career_timeline')
    .select('*')
    .eq('user_id', userId)
    .in('event_type', ROADMAP_EVENT_TYPES as unknown as string[])

  if (error) {
    console.error('Error fetching roadmap milestones:', error)
    return { milestones: [], error: error.message }
  }

  return {
    milestones: (data ?? []) as CareerTimelineEvent[],
    error: null,
  }
}

// --- Timezone-safe calendar-date helpers -----------------------------
//
// <input type="date"> hands back a bare "YYYY-MM-DD" string with no time
// or timezone info. Naively doing `new Date('2026-01-15')` and later
// formatting it with local-timezone getters (e.g. toLocaleDateString())
// shifts the displayed day by one for any viewer behind UTC. To avoid
// that entirely, every roadmap target date is anchored at UTC midnight
// on write, and every read/compare/sort operates on the plain
// "YYYY-MM-DD" calendar-day string sliced out of the stored ISO value --
// never on a Date object's local getters. ISO "YYYY-MM-DD" strings also
// sort correctly with plain string comparison, so this doubles as the
// sort/compare primitive for groupRoadmapMilestones() below.

export function dateInputValueToRoadmapEventDate(value: string): string {
  return `${value}T00:00:00.000Z`
}

export function roadmapEventDateToCalendarDay(isoString: string): string {
  return isoString.slice(0, 10)
}

const ROADMAP_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
})

export function formatRoadmapEventDate(isoString: string): string {
  const [year, month, day] = roadmapEventDateToCalendarDay(isoString).split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  if (Number.isNaN(date.getTime())) {
    console.error('formatRoadmapEventDate received an unparsable event_date:', isoString)
    return 'Unknown date'
  }
  return ROADMAP_DATE_FORMATTER.format(date)
}

// The viewer's LOCAL calendar day -- deliberately NOT toISOString() (UTC).
// Milestone target dates are fixed, timezone-agnostic UTC-anchored
// calendar days (see dateInputValueToRoadmapEventDate above), but "today"
// must reflect where the *viewer* actually is: someone in the evening in
// a UTC-behind timezone is already on "tomorrow" in UTC while still on
// today's calendar date locally, and a milestone due today must not flip
// to overdue hours before their local day is actually over.
function localCalendarDay(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export interface GroupedRoadmapMilestones {
  next: CareerTimelineEvent | null
  upcoming: CareerTimelineEvent[]
  overdue: CareerTimelineEvent[]
}

function compareMilestones(a: CareerTimelineEvent, b: CareerTimelineEvent): number {
  const dayCompare = roadmapEventDateToCalendarDay(a.event_date).localeCompare(
    roadmapEventDateToCalendarDay(b.event_date)
  )
  if (dayCompare !== 0) return dayCompare
  // Stable, deterministic tiebreaker for same-day milestones -- earlier
  // created_at sorts first, rather than relying on incidental fetch order.
  return a.created_at.localeCompare(b.created_at)
}

/**
 * Pure partition/sort of roadmap milestones into next/upcoming/overdue.
 * `now` is injected (rather than read from `new Date()` internally) so
 * callers -- and tests -- can pin "today" deterministically. A milestone
 * dated exactly today counts as upcoming, never overdue.
 */
export function groupRoadmapMilestones(events: CareerTimelineEvent[], now: Date): GroupedRoadmapMilestones {
  const today = localCalendarDay(now)

  const upcoming = events
    .filter((e) => roadmapEventDateToCalendarDay(e.event_date) >= today)
    .sort(compareMilestones)
  const overdue = events
    .filter((e) => roadmapEventDateToCalendarDay(e.event_date) < today)
    .sort(compareMilestones)

  const [next = null, ...rest] = upcoming

  return { next, upcoming: rest, overdue }
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
