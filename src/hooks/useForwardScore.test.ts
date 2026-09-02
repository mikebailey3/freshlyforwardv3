// src/hooks/useForwardScore.test.ts
import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useForwardScore } from './useForwardScore'
import type { MemberProfile } from '@/types'

const baseProfile: MemberProfile = {
  id: 'profile-1',
  user_id: 'u1',
  plan_id: null,
  status: 'active',
  username: null,
  avatar_url: null,
  headline: null,
  summary: null,
  full_name: 'Ada Lovelace',
  phone: null,
  location: null,
  linkedin_url: null,
  portfolio_url: null,
  employment_history: [],
  education: [{ institution: 'MIT', degree: 'BS', field: 'CS', graduation_year: '2010' }],
  certifications: [],
  skills: ['SQL', 'Leadership'],
  preferred_jobs: [],
  jobs_to_avoid: [],
  preferred_industries: [],
  salary_min: null,
  salary_max: null,
  salary_currency: 'USD',
  preferred_benefits: [],
  schedule_preference: null,
  max_commute_minutes: null,
  remote_preference: null,
  willing_to_relocate: null,
  travel_willingness: null,
  work_style: null,
  career_goals: null,
  strengths: null,
  weaknesses: null,
  jobs_enjoyed: null,
  jobs_not_enjoyed: null,
  motivators: null,
  biggest_challenge: null,
  target_role: 'VP of Operations',
  target_timeframe: 'within 12 months',
  application_authorized: true,
  electronic_consent: true,
  consent_date: null,
  search_readiness_score: 0,
  onboarding_completed: true,
  onboarding_completed_at: null,
  stripe_customer_id: null,
  stripe_subscription_id: null,
  subscription_status: 'active',
  account_status: 'active',
  account_status_reason: null,
  account_status_changed_at: null,
  is_strategist: false,
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
}

interface TableResult {
  data: unknown
  error: { message: string } | null
}

/** Minimal hand-built fake Supabase client (DI pattern used throughout
 * lib/forwardDna/): per-table canned results, chainable select()/eq(),
 * a resolvable maybeSingle(), and thenable so plain `await builder` also
 * resolves -- same convention as scope.test.ts / DashboardPage.test.tsx. */
function makeFakeClient(tables: Record<string, TableResult>) {
  const eqCalls: { table: string; args: unknown[] }[] = []

  const fromMock = vi.fn((table: string) => {
    const result: TableResult = tables[table] ?? { data: [], error: null }
    const builder: Record<string, unknown> = {}
    builder.select = vi.fn(() => builder)
    builder.eq = vi.fn((...args: unknown[]) => {
      eqCalls.push({ table, args })
      return builder
    })
    builder.maybeSingle = vi.fn(() => Promise.resolve(result))
    builder.then = (resolve: (value: TableResult) => void) => resolve(result)
    return builder
  })

  return { client: { from: fromMock } as unknown as SupabaseClient, fromMock, eqCalls }
}

const emptyOk: TableResult = { data: [], error: null }

function allTables(overrides: Record<string, TableResult> = {}): Record<string, TableResult> {
  return {
    career_scope: emptyOk,
    career_responsibilities: emptyOk,
    career_skills: emptyOk,
    career_compass_results: { data: null, error: null },
    applications: emptyOk,
    mock_interviews: emptyOk,
    messages: emptyOk,
    ...overrides,
  }
}

describe('useForwardScore', () => {
  it('profile === null: returns null result immediately and performs zero queries', () => {
    const { client, fromMock } = makeFakeClient(allTables())
    const { result } = renderHook(() => useForwardScore(null, client))

    expect(result.current).toEqual({
      forwardScore: null,
      nextBestMove: null,
      loading: false,
      applications: [],
      mockInterviews: [],
      hasActiveApplication: false,
      hasRecentOrUpcomingInterview: false,
      compassSummary: null,
    })
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('happy path: derives a fully-shaped ForwardScoreResult and NextBestMove from fake data', async () => {
    const now = new Date()
    const tenDaysAgo = new Date(now.getTime() - 10 * 86400000).toISOString()

    const { client } = makeFakeClient(
      allTables({
        career_scope: { data: [{ id: 's1', user_id: 'u1', employment_entry_id: 'e1' }], error: null },
        career_responsibilities: { data: [{ id: 'r1', user_id: 'u1', employment_entry_id: 'e1', tag: 'Managed budget' }], error: null },
        career_skills: {
          data: [{ id: 'sk1', user_id: 'u1', skill_name: 'SQL', state: 'demonstrated', evidence_note: null }],
          error: null,
        },
        career_compass_results: {
          data: { readiness_scores: { careerDirection: 80 }, primary_archetype: 'driver', recommended_plan_slug: 'career-growth' },
          error: null,
        },
        applications: {
          data: [{ id: 'a1', member_id: 'u1', status: 'submitted', date_submitted: tenDaysAgo, interview_date: null }],
          error: null,
        },
        mock_interviews: { data: [{ id: 'm1', user_id: 'u1', status: 'completed' }], error: null },
        messages: { data: [], error: null },
      })
    )

    const { result } = renderHook(() => useForwardScore(baseProfile, client))

    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.forwardScore).not.toBeNull()
    const pillarByKey = (key: string) => result.current.forwardScore!.pillars.find((p) => p.key === key)!

    // Forward DNA Depth: hasCareerCompassResult, hasScopeEntry,
    // hasResponsibilityTag, education present, target role+timeframe
    // present -> only missing "skill evidence beyond claimed" is actually
    // satisfied too (SQL is 'demonstrated'), so this is fully complete.
    expect(pillarByKey('forwardDnaDepth').score).toBe(100)

    // Evidence Quality: SQL is demonstrated (career_skills), Leadership is
    // an untracked flat skill -> implicit 'claimed'. Weighted average of
    // the two matches pillars.ts's STATE_WEIGHT-driven calculation --
    // asserted as "some score between 0 and 100" plus the pillar key
    // shape, not a hand-duplicated weight table (that's pillars.ts's job).
    expect(pillarByKey('evidenceQuality').score).toBeGreaterThan(0)

    // Career Momentum: active application (submitted, not
    // rejected/closed/offer_accepted) + submitted within 30 days +
    // completed mock interview + zero unread messages -> all 4 signals.
    expect(pillarByKey('careerMomentum').score).toBe(100)

    // Goal Alignment: passes readiness_scores.careerDirection straight
    // through.
    expect(pillarByKey('goalAlignment').score).toBe(80)

    expect(result.current.nextBestMove).not.toBeNull()
    expect(result.current.nextBestMove!.key).toBe('stay_the_course')

    // Task 7: raw applications/mockInterviews rows and the momentum
    // booleans are exposed directly so DashboardPage.tsx doesn't need a
    // second, competing fetch of the same tables.
    expect(result.current.applications).toHaveLength(1)
    expect(result.current.mockInterviews).toHaveLength(1)
    expect(result.current.hasActiveApplication).toBe(true)
    expect(result.current.hasRecentOrUpcomingInterview).toBe(true)

    // Task 7: the Career Compass summary card's data comes from this
    // same single fetch instead of its own separate query.
    expect(result.current.compassSummary).toEqual({ primary_archetype: 'driver', recommended_plan_slug: 'career-growth' })
  })

  it('no career_compass_results row: careerDirectionScore is null, goalAlignment pillar is 0, does not throw', async () => {
    const { client } = makeFakeClient(allTables({ career_compass_results: { data: null, error: null } }))

    const { result } = renderHook(() => useForwardScore(baseProfile, client))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.forwardScore).not.toBeNull()
    const goalAlignment = result.current.forwardScore!.pillars.find((p) => p.key === 'goalAlignment')!
    expect(goalAlignment.score).toBe(0)
    expect(result.current.compassSummary).toBeNull()
  })

  it('empty career_skills and empty profile.skills: Evidence Quality pillar is 0, does not throw', async () => {
    const { client } = makeFakeClient(
      allTables({ career_skills: { data: [], error: null } })
    )
    const noSkillsProfile: MemberProfile = { ...baseProfile, skills: [] }

    const { result } = renderHook(() => useForwardScore(noSkillsProfile, client))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.forwardScore).not.toBeNull()
    const evidenceQuality = result.current.forwardScore!.pillars.find((p) => p.key === 'evidenceQuality')!
    expect(evidenceQuality.score).toBe(0)
  })

  it('a failed sub-query (applications) degrades to zero rows instead of crashing or hanging loading', async () => {
    const { client } = makeFakeClient(
      allTables({ applications: { data: null, error: { message: 'boom' } } })
    )

    const { result } = renderHook(() => useForwardScore(baseProfile, client))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.forwardScore).not.toBeNull()
    const careerMomentum = result.current.forwardScore!.pillars.find((p) => p.key === 'careerMomentum')!
    // No applications -> no active application, no recent submission --
    // whatever else contributes, hasActiveApplication/submittedInLast30Days
    // are both false, so momentum caps below the "all 4 signals" max.
    expect(careerMomentum.score).toBeLessThan(100)
  })
})
