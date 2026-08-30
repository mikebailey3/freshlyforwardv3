import { useEffect, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { Compass, Percent, Sparkles } from 'lucide-react'
import { LinkButton } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import type {
  ArchetypeResult, ReadinessResult, PlanRecommendation, ArchetypeKey, ReadinessBarrierKey,
} from '@/types/careerCompass'

/** Shape navigated forward from CareerCompassAssessmentPage (Task 2, shipped, unchanged). */
export interface CareerCompassResultNavState {
  assessmentId: string
  archetype: ArchetypeResult
  readiness: ReadinessResult
  recommendation: PlanRecommendation
}

const ARCHETYPE_COPY: Record<ArchetypeKey, { label: string; description: string }> = {
  driver: {
    label: 'Driver',
    description:
      "Drivers are decisive, results-oriented, and energized by ownership. You gravitate toward roles where you can set the pace, make the call, and see your impact land quickly. In a job search, that same drive shows up as momentum -- you want a clear next step, not months of ambiguity.",
  },
  connector: {
    label: 'Connector',
    description:
      "Connectors build their career through relationships -- you're at your best when you're building rapport, aligning stakeholders, and bringing people together around a shared goal. Networking, warm introductions, and mentor-style guidance tend to move you forward faster than a job board ever could. You thrive in roles with genuine human connection at the center.",
  },
  strategist: {
    label: 'Strategist',
    description:
      "Strategists think several moves ahead, weighing tradeoffs and mapping out the smartest path before committing to one. You bring structure and clear reasoning to ambiguous situations, and you're most engaged when a role rewards planning over reacting. A search that respects your need to understand the 'why' behind each step will feel far more natural than a scattershot approach.",
  },
  builder: {
    label: 'Builder',
    description:
      "Builders want to create something tangible and see it through from idea to finished result. You're energized by hands-on execution, incremental progress, and owning a project end-to-end. A role that lets you build, ship, and iterate -- rather than sit in endless planning -- is where you'll do your best work.",
  },
  explorer: {
    label: 'Explorer',
    description:
      "Explorers are energized by variety, new challenges, and the freedom to figure things out as they go. You adapt quickly, pick up new skills without much hand-holding, and get restless in roles that feel too routine. A search that stays open to different paths -- rather than one narrow lane -- will suit you far better than a rigid plan.",
  },
  creator: {
    label: 'Creator',
    description:
      "Creators bring original ideas, a distinctive point of view, and a preference for work that lets that show. You're most engaged when a role gives you room to shape the approach, not just execute someone else's playbook. A search that highlights your creative range -- rather than flattening you into a generic title -- will get you further, faster.",
  },
}

const BARRIER_LABELS: Record<ReadinessBarrierKey, string> = {
  careerDirection: 'Career direction clarity',
  resumePositioning: 'Resume positioning',
  searchStrategy: 'Search strategy',
  applicationConversion: 'Application conversion',
  interviewPerformance: 'Interview confidence',
}

const PLAN_NAMES: Record<Exclude<PlanRecommendation['planSlug'], null>, string> = {
  'career-kickstart': 'Career Kickstart',
  'founding-member': 'Founding Member',
  'career-growth': 'Career Growth',
  'career-concierge': 'Career Concierge',
}

/**
 * Fallback reasons used only for the slow-path (Supabase row) lookup.
 * `career_compass_results` stores the plan slug and fit score but not the
 * free-text `reasons` array -- that only ever existed on the in-memory
 * PlanRecommendation produced at assessment-completion time and isn't part
 * of the persisted schema. These mirror the first reason from each branch
 * of recommendPlan() so the copy stays consistent even when the exact
 * original reasons weren't persisted.
 */
const FALLBACK_REASONS: Record<'none' | Exclude<PlanRecommendation['planSlug'], null>, string[]> = {
  none: ['Your readiness is strong across the board.'],
  'career-kickstart': ['Your biggest opportunity is how your experience is presented.'],
  'career-concierge': ["You're navigating a complex career transition."],
  'career-growth': ["You're ready for more active, hands-on help."],
  'founding-member': ["You'd benefit from ongoing guidance and hand-selected opportunities."],
}

interface DbResultRow {
  dimension_scores: ArchetypeResult['dimensionScores']
  archetype_scores: ArchetypeResult['archetypeScores']
  primary_archetype: ArchetypeKey
  secondary_archetype: ArchetypeKey
  readiness_scores: ReadinessResult['dimensionScores']
  primary_barrier: ReadinessBarrierKey
  secondary_barrier: ReadinessBarrierKey
  recommended_plan_slug: PlanRecommendation['planSlug']
  service_fit_pct: number
}

/**
 * Same weighted-average formula as calculateReadiness() in
 * readinessEngine.ts, applied to already-computed dimension scores --
 * the DB only stores the computed result, not the raw answers a fresh
 * calculateReadiness() call would need.
 */
function overallScoreFrom(scores: ReadinessResult['dimensionScores']): number {
  return Math.round(
    scores.careerDirection * 0.25 +
    scores.resumePositioning * 0.25 +
    scores.searchStrategy * 0.20 +
    scores.applicationResults * 0.15 +
    scores.interviewConfidence * 0.15,
  )
}

function mapDbRowToNavState(assessmentId: string, row: DbResultRow): CareerCompassResultNavState {
  return {
    assessmentId,
    archetype: {
      dimensionScores: row.dimension_scores,
      archetypeScores: row.archetype_scores,
      primaryArchetype: row.primary_archetype,
      secondaryArchetype: row.secondary_archetype,
    },
    readiness: {
      dimensionScores: row.readiness_scores,
      // Not persisted -- unused by anything this page renders.
      supportNeed: 0,
      urgency: 0,
      transitionType: null,
      isComplexTransition: false,
      overallScore: overallScoreFrom(row.readiness_scores),
      primaryBarrier: row.primary_barrier,
      secondaryBarrier: row.secondary_barrier,
    },
    recommendation: {
      planSlug: row.recommended_plan_slug,
      serviceFitPct: row.service_fit_pct,
      reasons: FALLBACK_REASONS[row.recommended_plan_slug ?? 'none'],
    },
  }
}

function isNavState(value: unknown): value is CareerCompassResultNavState {
  return (
    !!value && typeof value === 'object' &&
    'assessmentId' in value && 'archetype' in value && 'readiness' in value && 'recommendation' in value
  )
}

export function CareerCompassResultsPage() {
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const stateResult = isNavState(location.state) ? location.state : null
  const assessmentIdParam = searchParams.get('assessmentId')

  const [lookupResult, setLookupResult] = useState<CareerCompassResultNavState | null>(null)
  const [loading, setLoading] = useState(!stateResult && !!assessmentIdParam)

  useEffect(() => {
    if (stateResult || !assessmentIdParam) return

    let cancelled = false
    setLoading(true)
    supabase
      .from('career_compass_results')
      .select('*')
      .eq('assessment_id', assessmentIdParam)
      .eq('is_current', true)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return
        setLookupResult(!error && data ? mapDbRowToNavState(assessmentIdParam, data as DbResultRow) : null)
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessmentIdParam])

  const result = stateResult ?? lookupResult

  if (loading) {
    return (
      <main>
        <section className="page-hero shell">
          <div>
            <p className="eyebrow">Career Compass</p>
            <h1>Loading your results…</h1>
          </div>
        </section>
      </main>
    )
  }

  if (!result) {
    return (
      <main>
        <section className="page-hero shell">
          <div>
            <p className="eyebrow">Career Compass</p>
            <h1>We couldn't find those results.</h1>
            <p>The link may be out of date, or this result may no longer be available. You can retake the free assessment in about five minutes.</p>
            <LinkButton to="/career-compass">Retake the assessment</LinkButton>
          </div>
        </section>
      </main>
    )
  }

  const { archetype, readiness, recommendation } = result
  const primary = ARCHETYPE_COPY[archetype.primaryArchetype]
  const secondary = ARCHETYPE_COPY[archetype.secondaryArchetype]
  const barrierLabel = BARRIER_LABELS[readiness.primaryBarrier]
  const planName = recommendation.planSlug ? PLAN_NAMES[recommendation.planSlug] : null

  return (
    <main>
      <section className="page-hero shell">
        <div>
          <p className="eyebrow">Your Career Compass results</p>
          <h1>You're a {primary.label}.</h1>
          <p>{primary.description}</p>
          <p>You also show strong {secondary.label} traits.</p>
        </div>
        <div className="page-hero-mark" aria-hidden="true">
          <Compass />
        </div>
      </section>

      <section className="authorization-grid shell">
        <article>
          <Percent />
          <div>
            <h2>Forward Readiness: {readiness.overallScore}%</h2>
            <p>Your biggest opportunity right now is <strong>{barrierLabel}</strong>.</p>
          </div>
        </article>
        <article>
          <Sparkles />
          <div>
            {planName ? (
              <>
                <h2>Recommended: {planName}</h2>
                <ul>
                  {recommendation.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </>
            ) : (
              <>
                <h2>You're in great shape -- no purchase needed right now.</h2>
                <ul>
                  {recommendation.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </article>
      </section>

      <section className="small-cta shell">
        <div>
          <h2>Save your Career Compass results</h2>
          <p>Create a free account so this report is always here when you need it.</p>
        </div>
        <div>
          <LinkButton to="/signup?compass=1">Save My Career Compass</LinkButton>
          <p className="auth-switch">
            <Link to="/signin?redirect=%2Fdashboard%3Fcompass%3Dsaved">Already have an account? Sign in instead</Link>
          </p>
          <p style={{ marginTop: '8px', fontSize: '.8rem', color: 'var(--muted, #6b7280)' }}>
            Signing in won't keep this specific result -- create a new account above to save it.
          </p>
        </div>
      </section>
    </main>
  )
}
