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

/**
 * Application statuses that no longer count as "active" -- mirrors
 * DashboardPage.tsx's `activeApplications` derivation exactly, so the two
 * pages never silently disagree about what an active application is.
 */
const INACTIVE_APPLICATION_STATUSES = ['rejected', 'closed', 'offer_accepted']

const MS_PER_DAY = 86400000

interface CompassReadinessRow {
  readiness_scores: { careerDirection?: number | null } | null
}

interface UnreadMessageRow {
  id: string
}

export interface UseForwardScoreResult {
  forwardScore: ForwardScoreResult | null
  nextBestMove: NextBestMove | null
  loading: boolean
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

  useEffect(() => {
    if (!profile) {
      setForwardScore(null)
      setNextBestMove(null)
      setLoading(false)
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
          .select('readiness_scores')
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

      const compassResult = compassRes.error ? null : (compassRes.data as CompassReadinessRow | null)
      const applications = (appsRes.error ? null : (appsRes.data as Application[] | null)) ?? []
      const mockInterviews = (mockRes.error ? null : (mockRes.data as MockInterview[] | null)) ?? []
      const unreadMessages = (messagesRes.error ? null : (messagesRes.data as UnreadMessageRow[] | null)) ?? []

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
      setLoading(false)
    }

    load().catch(() => {
      // Fail-closed, same discipline as useEntitlements's own try/catch:
      // an unexpected rejection (not a per-query `{ error }` shape, e.g. a
      // thrown network error) shouldn't leave `loading` stuck true forever.
      if (cancelled) return
      setForwardScore(null)
      setNextBestMove(null)
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [profile, client])

  return { forwardScore, nextBestMove, loading }
}
