import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase as defaultClient } from '@/lib/supabase'
import type {
  ArchetypeAnswers, ReadinessAnswers, ArchetypeResult, ReadinessResult, PlanRecommendation,
} from '@/types/careerCompass'

export interface AssessmentProgress {
  assessmentId: string
  archetypeAnswers: ArchetypeAnswers
  readinessAnswers: ReadinessAnswers
}

export interface CareerCompassResultInsert {
  assessmentId: string
  userId: string
  archetype: ArchetypeResult
  readiness: ReadinessResult
  recommendation: PlanRecommendation
}

/**
 * Returns the current session's user id, or establishes a real (if
 * temporary) Supabase Anonymous Sign-In session and returns its id if no
 * session exists yet. Every visitor -- anonymous or already
 * authenticated -- ends up with a genuine `auth.uid()` this way, which
 * is what lets both Career Compass tables use one ordinary
 * `user_id = auth.uid()` RLS policy instead of a bespoke, unenforceable
 * client-side-token scheme.
 */
export async function ensureAuthenticatedSession(
  client: SupabaseClient = defaultClient
): Promise<{ userId: string } | { error: string }> {
  try {
    const { data: { session } } = await client.auth.getSession()
    if (session?.user) return { userId: session.user.id }

    const { data, error } = await client.auth.signInAnonymously()
    if (error) return { error: error.message }
    if (!data.user) return { error: 'Anonymous sign-in returned no user.' }
    return { userId: data.user.id }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

/**
 * Finds the caller's existing in-progress assessment, or starts a new
 * one. Never returns more than one open assessment per user.
 */
export async function startOrResumeAssessment(
  userId: string,
  client: SupabaseClient = defaultClient
): Promise<AssessmentProgress | { error: string }> {
  try {
    const { data: existing, error: selectError } = await client
      .from('career_compass_assessments')
      .select('id, archetype_answers, readiness_answers')
      .eq('user_id', userId)
      .eq('status', 'in_progress')
      .maybeSingle()

    if (selectError) return { error: selectError.message }
    if (existing) {
      const row = existing as { id: string; archetype_answers: ArchetypeAnswers | null; readiness_answers: ReadinessAnswers | null }
      return {
        assessmentId: row.id,
        archetypeAnswers: row.archetype_answers ?? {},
        readinessAnswers: row.readiness_answers ?? {},
      }
    }

    const { data: created, error: insertError } = await client
      .from('career_compass_assessments')
      .insert({ user_id: userId })
      .select('id')
      .single()

    if (insertError) return { error: insertError.message }
    return { assessmentId: (created as { id: string }).id, archetypeAnswers: {}, readinessAnswers: {} }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

/** Autosaves answers to the caller's open assessment. Safe to call after every answer. */
export async function saveAssessmentAnswers(
  assessmentId: string,
  archetypeAnswers: ArchetypeAnswers,
  readinessAnswers: ReadinessAnswers,
  client: SupabaseClient = defaultClient
): Promise<{ error: string | null }> {
  try {
    const { error } = await client
      .from('career_compass_assessments')
      .update({ archetype_answers: archetypeAnswers, readiness_answers: readinessAnswers })
      .eq('id', assessmentId)

    return { error: error?.message ?? null }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

/**
 * Marks the assessment completed and stores its computed result,
 * superseding any prior "current" result for this user (every user has
 * a real uid under this identity model, anonymous or not, so retake
 * history works identically for everyone).
 */
export async function completeAssessment(
  result: CareerCompassResultInsert,
  client: SupabaseClient = defaultClient
): Promise<{ error: string | null }> {
  try {
    const { error: statusError } = await client
      .from('career_compass_assessments')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', result.assessmentId)

    if (statusError) return { error: statusError.message }

    const { error: supersedeError } = await client
      .from('career_compass_results')
      .update({ is_current: false })
      .eq('user_id', result.userId)
      .eq('is_current', true)

    if (supersedeError) return { error: supersedeError.message }

    const { error: insertError } = await client
      .from('career_compass_results')
      .insert({
        assessment_id: result.assessmentId,
        user_id: result.userId,
        is_current: true,
        dimension_scores: result.archetype.dimensionScores,
        archetype_scores: result.archetype.archetypeScores,
        primary_archetype: result.archetype.primaryArchetype,
        secondary_archetype: result.archetype.secondaryArchetype,
        readiness_scores: result.readiness.dimensionScores,
        primary_barrier: result.readiness.primaryBarrier,
        secondary_barrier: result.readiness.secondaryBarrier,
        recommended_plan_slug: result.recommendation.planSlug,
        service_fit_pct: result.recommendation.serviceFitPct,
        reasons: result.recommendation.reasons,
      })

    return { error: insertError?.message ?? null }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Unknown error' }
  }
}
