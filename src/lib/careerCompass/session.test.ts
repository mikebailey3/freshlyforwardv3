import { describe, it, expect, vi } from 'vitest'
import {
  ensureAuthenticatedSession,
  startOrResumeAssessment,
  saveAssessmentAnswers,
  completeAssessment,
} from './session'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ArchetypeResult, ReadinessResult, PlanRecommendation } from '@/types/careerCompass'

// A minimal fake Supabase query builder: every chain method returns the
// same builder (for fluent chaining), and the builder itself is thenable
// so `await client.from(...).update(...).eq(...)` resolves even when no
// terminal method like .single()/.maybeSingle() is called.
function makeBuilder(response: { data: unknown; error: { message: string } | null }) {
  const builder: Record<string, unknown> = {
    select: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn(() => Promise.resolve(response)),
    single: vi.fn(() => Promise.resolve(response)),
    then: (resolve: (value: typeof response) => unknown) => Promise.resolve(response).then(resolve),
  }
  return builder
}

function makeFakeClient(opts: {
  fromImpl?: (table: string) => Record<string, unknown>
  getSession?: () => Promise<{ data: { session: { user: { id: string } } | null } }>
  signInAnonymously?: () => Promise<{ data: { user: { id: string } | null }; error: { message: string } | null }>
}): SupabaseClient {
  return {
    from: vi.fn(opts.fromImpl ?? (() => makeBuilder({ data: null, error: null }))),
    auth: {
      getSession: vi.fn(opts.getSession ?? (() => Promise.resolve({ data: { session: null } }))),
      signInAnonymously: vi.fn(opts.signInAnonymously ?? (() => Promise.resolve({ data: { user: { id: 'anon-uid' } }, error: null }))),
    },
  } as unknown as SupabaseClient
}

describe('ensureAuthenticatedSession', () => {
  it('returns the existing session\'s user id without creating a new one', async () => {
    const client = makeFakeClient({
      getSession: () => Promise.resolve({ data: { session: { user: { id: 'existing-uid' } } } }),
    })
    const result = await ensureAuthenticatedSession(client)
    expect(result).toEqual({ userId: 'existing-uid' })
    expect(client.auth.signInAnonymously).not.toHaveBeenCalled()
  })

  it('signs in anonymously and returns the new user id when no session exists', async () => {
    const client = makeFakeClient({
      getSession: () => Promise.resolve({ data: { session: null } }),
      signInAnonymously: () => Promise.resolve({ data: { user: { id: 'new-anon-uid' } }, error: null }),
    })
    const result = await ensureAuthenticatedSession(client)
    expect(result).toEqual({ userId: 'new-anon-uid' })
  })

  it('returns an error if anonymous sign-in itself fails', async () => {
    const client = makeFakeClient({
      getSession: () => Promise.resolve({ data: { session: null } }),
      signInAnonymously: () => Promise.resolve({ data: { user: null }, error: { message: 'anon sign-in disabled' } }),
    })
    const result = await ensureAuthenticatedSession(client)
    expect(result).toEqual({ error: 'anon sign-in disabled' })
  })
})

describe('startOrResumeAssessment', () => {
  it('resumes an existing in-progress assessment instead of creating a new one', async () => {
    const existingRow = { id: 'assess-1', archetype_answers: { q1: 3 }, readiness_answers: {} }
    const client = makeFakeClient({ fromImpl: () => makeBuilder({ data: existingRow, error: null }) })
    const result = await startOrResumeAssessment('user-1', client)
    expect(result).toEqual({ assessmentId: 'assess-1', archetypeAnswers: { q1: 3 }, readinessAnswers: {} })
  })

  it('creates a new assessment when none is in progress', async () => {
    let call = 0
    const client = makeFakeClient({
      fromImpl: () => {
        call += 1
        return call === 1
          ? makeBuilder({ data: null, error: null }) // select found nothing
          : makeBuilder({ data: { id: 'new-assess' }, error: null }) // insert
      },
    })
    const result = await startOrResumeAssessment('user-1', client)
    expect(result).toEqual({ assessmentId: 'new-assess', archetypeAnswers: {}, readinessAnswers: {} })
  })
})

describe('saveAssessmentAnswers', () => {
  it('returns no error on a successful update', async () => {
    const client = makeFakeClient({ fromImpl: () => makeBuilder({ data: null, error: null }) })
    const result = await saveAssessmentAnswers('assess-1', { q1: 3 }, {}, client)
    expect(result.error).toBeNull()
  })

  it('surfaces the database error message on failure', async () => {
    const client = makeFakeClient({ fromImpl: () => makeBuilder({ data: null, error: { message: 'boom' } }) })
    const result = await saveAssessmentAnswers('assess-1', {}, {}, client)
    expect(result.error).toBe('boom')
  })
})

describe('completeAssessment', () => {
  const archetype: ArchetypeResult = {
    dimensionScores: { peopleFocus: 1, leadershipDrive: 1, structurePreference: 1, ambiguityTolerance: 1, analyticalOrientation: 1, workPace: 1 },
    archetypeScores: { driver: 1, connector: 1, strategist: 1, builder: 1, explorer: 1, creator: 1 },
    primaryArchetype: 'driver',
    secondaryArchetype: 'connector',
  }
  const readiness: ReadinessResult = {
    dimensionScores: { careerDirection: 1, resumePositioning: 1, searchStrategy: 1, applicationResults: 1, interviewConfidence: 1 },
    supportNeed: 1, urgency: 1, transitionType: null, isComplexTransition: false,
    overallScore: 1, primaryBarrier: 'careerDirection', secondaryBarrier: 'resumePositioning',
  }
  const recommendation: PlanRecommendation = { planSlug: 'founding-member', serviceFitPct: 80, reasons: ['because'] }

  it('supersedes the prior current result via an is_current update before inserting the new one, with correct field mappings', async () => {
    const calls: { table: string; builder: Record<string, unknown> }[] = []
    const client = makeFakeClient({
      fromImpl: (table) => {
        const builder = makeBuilder({ data: null, error: null })
        calls.push({ table, builder })
        return builder
      },
    })
    await completeAssessment({ assessmentId: 'assess-1', userId: 'user-1', archetype, readiness, recommendation }, client)

    const resultsCalls = calls.filter((c) => c.table === 'career_compass_results')
    expect(resultsCalls).toHaveLength(2)

    const [supersedeCall, insertCall] = resultsCalls
    expect(supersedeCall.builder.update).toHaveBeenCalledWith({ is_current: false })
    expect(supersedeCall.builder.insert).not.toHaveBeenCalled()

    expect(insertCall.builder.insert).toHaveBeenCalledWith({
      assessment_id: 'assess-1',
      user_id: 'user-1',
      is_current: true,
      dimension_scores: archetype.dimensionScores,
      archetype_scores: archetype.archetypeScores,
      primary_archetype: archetype.primaryArchetype,
      secondary_archetype: archetype.secondaryArchetype,
      readiness_scores: readiness.dimensionScores,
      primary_barrier: readiness.primaryBarrier,
      secondary_barrier: readiness.secondaryBarrier,
      recommended_plan_slug: recommendation.planSlug,
      service_fit_pct: recommendation.serviceFitPct,
      reasons: recommendation.reasons,
    })
    expect(insertCall.builder.update).not.toHaveBeenCalled()
  })

  it('stops and returns an error if superseding the prior current result fails, without ever inserting the new one', async () => {
    let resultsCallCount = 0
    const client = makeFakeClient({
      fromImpl: (table) => {
        if (table === 'career_compass_results') {
          resultsCallCount += 1
          if (resultsCallCount === 1) {
            return makeBuilder({ data: null, error: { message: 'supersede failed' } })
          }
        }
        return makeBuilder({ data: null, error: null })
      },
    })
    const result = await completeAssessment({ assessmentId: 'assess-1', userId: 'user-1', archetype, readiness, recommendation }, client)
    expect(result.error).toBe('supersede failed')
    expect(resultsCallCount).toBe(1)
  })

  it('stops and returns an error if marking the assessment completed fails, without touching results at all', async () => {
    const fromCalls: string[] = []
    const client = makeFakeClient({
      fromImpl: (table) => {
        fromCalls.push(table)
        return table === 'career_compass_assessments'
          ? makeBuilder({ data: null, error: { message: 'assessment update failed' } })
          : makeBuilder({ data: null, error: null })
      },
    })
    const result = await completeAssessment({ assessmentId: 'assess-1', userId: 'user-1', archetype, readiness, recommendation }, client)
    expect(result.error).toBe('assessment update failed')
    expect(fromCalls).not.toContain('career_compass_results')
  })
})
