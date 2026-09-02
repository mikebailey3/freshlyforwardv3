// src/hooks/useForwardScore.ts
import { useEffect, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase as defaultClient } from '@/lib/supabase'
import { getAllScopeForUser } from '@/lib/forwardDna/scope'
import { getAllResponsibilitiesForUser } from '@/lib/forwardDna/responsibilities'
import { getSkillStates } from '@/lib/forwardDna/skills'
import { buildForwardDnaCompletenessInput, calculateForwardDnaCompleteness } from '@/lib/forwardDna/completeness'
import { computeForwardScore, getNextBestMove } from '@/lib/forwardScore'
import type { ForwardScoreInputs } from '@/lib/forwardScore'
import type { ForwardScoreResult, NextBestMove } from '@/types/forwardScore'
import type { MemberProfile, Application, MockInterview } from '@/types'
import type { ArchetypeKey } from '@/types/careerCompass'

/**
 * Application statuses that no longer count as "active" -- mirrors
 * DashboardPage.tsx's `activeApplications` derivation exactly, so the two
 * pages never silently disagree about what an active application is.
 */
const INACTIVE_APPLICATION_STATUSES = ['rejected', 'closed', 'offer_accepted']

const MS_PER_DAY = 86400000

interface CompassRow {
  readiness_scores: { careerDirection?: number | null } | null
  primary_archetype: ArchetypeKey | null
  recommended_plan_slug: string | null
}

interface UnreadMessageRow {
  id: string
}

/** The small subset of the `career_compass_results` row DashboardPage's
 * Career Compass summary card needs -- exposed here so that card and
 * this hook share the single fetch of that table instead of each
 * running its own competing query for a different column slice. */
export interface CompassSummary {
  primary_archetype: ArchetypeKey
  recommended_plan_slug: string | null
}

export interface UseForwardScoreResult {
  forwardScore: ForwardScoreResult | null
  nextBestMove: NextBestMove | null
  loading: boolean
  /** Raw rows this hook already fetched -- exposed so DashboardPage.tsx
   * doesn't need its own separate applications/mock_interviews queries
   * just to render the Applications/Interviews stat cards and
   * recommendations (Task 7: DRY, one fetch instead of two). */
  applications: Application[]
  mockInterviews: MockInterview[]
  /** The exact same two booleans the Career Momentum pillar is built
   * from -- exposed for DashboardPage's Search Readiness card visual
   * emphasis so that decision never drifts from this hook's own
   * definition of "active application" / "recent or upcoming
   * interview". */
  hasActiveApplication: boolean
  hasRecentOrUpcomingInterview: boolean
  /** Null while loading, while the member has no current Career Compass
   * result, or if that row failed to load -- same fail-closed shape the
   * page's old standalone compass fetch used. */
  compassSummary: CompassSummary | null
}

/**
 * Fetches every raw input the Forward Score composite needs, derives
 * `ForwardScoreInputs` from it, and returns the computed score plus the
 * deterministic Next Best Move. Takes `profile` as a parameter (from the
 * caller's existing `useAuth()`) rather than fetching it itself -- no
 * redundant profile fetch.
 *
 * Reuses the same DI pattern as `lib/forwardDna/*` -- an injectable
 * `client`, defaulting to the real `supabase` singleton -- so tests can
 * pass a hand-built fake client instead of mocking the network.
 *
 * Fail-closed, same discipline as `useEntitlements`: a failed sub-query
 * degrades that one input to its empty/zero state rather than crashing
 * the whole hook or leaving `loading` stuck `true`.
 */
export function useForwardScore(
  profile: MemberProfile | null,
  client: SupabaseClient = defaultClient
): UseForwardScoreResult {
  const [forwardScore, setForwardScore] = useState<ForwardScoreResult | null>(null)
  const [nextBestMove, setNextBestMove] = useState<NextBestMove | null>(null)
  const [loading, setLoading] = useState(!!profile)
  const [applications, setApplications] = useState<Application[]>([])
  const [mockInterviews, setMockInterviews] = useState<MockInterview[]>([])
  const [hasActiveApplication, setHasActiveApplication] = useState(false)
  const [hasRecentOrUpcomingInterview, setHasRecentOrUpcomingInterview] = useState(false)
  const [compassSummary, setCompassSummary] = useState<CompassSummary | null>(null)

  useEffect(() => {
    if (!profile) {
      setForwardScore(null)
      setNextBestMove(null)
      setLoading(false)
      setApplications([])
      setMockInterviews([])
      setHasActiveApplication(false)
      setHasRecentOrUpcomingInterview(false)
      setCompassSummary(null)
      return
    }

    let cancelled = false
    setLoading(true)

    const load = async () => {
      const userId = profile.user_id

      const [scopeRes, respRes, skillsRes, compassRes, appsRes, mockRes, messagesRes] = await Promise.all([
        getAllScopeForUser(userId, client),
        getAllResponsibilitiesForUser(userId, client),
        getSkillStates(userId, client),
        client
          .from('career_compass_results')
          .select('readiness_scores, primary_archetype, recommended_plan_slug')
          .eq('user_id', userId)
          .eq('is_current', true)
          .maybeSingle(),
        client.from('applications').select('*').eq('member_id', userId),
        client.from('mock_interviews').select('*').eq('user_id', userId),
        client.from('messages').select('id').eq('user_id', userId).eq('is_read', false),
      ])

      if (cancelled) return

      const scope = scopeRes.scope
      const responsibilities = respRes.responsibilities
      const skills = skillsRes.skills

      const compassResult = compassRes.error ? null : (compassRes.data as CompassRow | null)
      const applications = (appsRes.error ? null : (appsRes.data as Application[] | null)) ?? []
      const mockInterviews = (mockRes.error ? null : (mockRes.data as MockInterview[] | null)) ?? []
      const unreadMessages = (messagesRes.error ? null : (messagesRes.data as UnreadMessageRow[] | null)) ?? []

      const compassSummary: CompassSummary | null = compassResult?.primary_archetype
        ? { primary_archetype: compassResult.primary_archetype, recommended_plan_slug: compassResult.recommended_plan_slug ?? null }
        : null

      const hasCareerCompassResult = !!compassResult
      const completenessInput = buildForwardDnaCompletenessInput(
        profile,
        scope,
        responsibilities,
        skills,
        hasCareerCompassResult
      )
      const forwardDnaCompletenessScore = calculateForwardDnaCompleteness(completenessInput).score

      const now = new Date()
      const thirtyDaysAgo = new Date(now.getTime() - 30 * MS_PER_DAY)

      const inputs: ForwardScoreInputs = {
        forwardDnaCompletenessScore,
        careerSkills: skills,
        flatSkills: profile.skills || [],
        momentum: {
          hasActiveApplication:
            applications.filter((a) => !INACTIVE_APPLICATION_STATUSES.includes(a.status)).length > 0,
          submittedInLast30Days: applications.some(
            (a) => a.date_submitted && new Date(a.date_submitted) >= thirtyDaysAgo
          ),
          hasRecentOrUpcomingInterview:
            applications.some((a) => a.interview_date && new Date(a.interview_date) >= now) ||
            mockInterviews.some((m) => m.status === 'completed' || m.status === 'scheduled'),
          hasRespondedToMessages: unreadMessages.length === 0,
        },
        careerDirectionScore: compassResult?.readiness_scores?.careerDirection ?? null,
      }

      const score = computeForwardScore(inputs)
      const move = getNextBestMove(score, { hasActiveApplication: inputs.momentum.hasActiveApplication })

      setForwardScore(score)
      setNextBestMove(move)
      setApplications(applications)
      setMockInterviews(mockInterviews)
      setHasActiveApplication(inputs.momentum.hasActiveApplication)
      setHasRecentOrUpcomingInterview(inputs.momentum.hasRecentOrUpcomingInterview)
      setCompassSummary(compassSummary)
      setLoading(false)
    }

    load().catch(() => {
      // Fail-closed, same discipline as useEntitlements's own try/catch:
      // an unexpected rejection (not a per-query `{ error }` shape, e.g. a
      // thrown network error) shouldn't leave `loading` stuck true forever.
      if (cancelled) return
      setForwardScore(null)
      setNextBestMove(null)
      setApplications([])
      setMockInterviews([])
      setHasActiveApplication(false)
      setHasRecentOrUpcomingInterview(false)
      setCompassSummary(null)
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [profile, client])

  return {
    forwardScore,
    nextBestMove,
    loading,
    applications,
    mockInterviews,
    hasActiveApplication,
    hasRecentOrUpcomingInterview,
    compassSummary,
  }
}
