// src/lib/forwardScore/nextBestMove.test.ts
import { describe, it, expect } from 'vitest'
import { getNextBestMove } from './nextBestMove'
import type {
  ForwardScorePillarKey, ForwardScorePillarResult, ForwardScoreResult, NextBestMoveContext,
} from '@/types/forwardScore'

const PILLAR_KEYS: ForwardScorePillarKey[] = [
  'forwardDnaDepth', 'evidenceQuality', 'careerMomentum', 'goalAlignment',
]

/**
 * Builds a well-formed ForwardScoreResult fixture. Every pillar defaults
 * to a healthy 80 (well above the 40 threshold); pass `overrides` to
 * push specific pillars below (or keep them at/above) the threshold.
 */
function buildResult(overrides: Partial<Record<ForwardScorePillarKey, number>>): ForwardScoreResult {
  const scores: Record<ForwardScorePillarKey, number> = {
    forwardDnaDepth: 80,
    evidenceQuality: 80,
    careerMomentum: 80,
    goalAlignment: 80,
    ...overrides,
  }

  const pillars: ForwardScorePillarResult[] = PILLAR_KEYS.map((key) => ({
    key,
    label: key,
    score: scores[key],
    weight: 0.25,
    explanation: '',
    improvementLink: null,
  }))

  return { total: 80, pillars }
}

/**
 * Builds a well-formed NextBestMoveContext fixture. All four signals
 * default to `false` ("no lifecycle signals, no active application") --
 * pass `overrides` to flip specific ones. This is required (not
 * optional) precisely so a future test can't silently omit a signal the
 * way the pre-N13a call site silently discarded three of them.
 */
function buildContext(overrides: Partial<NextBestMoveContext> = {}): NextBestMoveContext {
  return {
    hasActiveApplication: false,
    hasUpcomingInterview: false,
    submittedRecently: false,
    hasUnreadInboundMessages: false,
    ...overrides,
  }
}

describe('getNextBestMove -- pillar rules (no lifecycle signals present)', () => {
  it('rule 1: recommends add_career_win to /forward-dna when Evidence Quality is lowest and below threshold', () => {
    const result = buildResult({ evidenceQuality: 20 })
    const move = getNextBestMove(result, buildContext())
    expect(move.key).toBe('add_career_win')
    expect(move.cta.to).toBe('/forward-dna')
  })

  it('rule 2: recommends complete_forward_dna to /forward-dna when Forward DNA Depth is lowest and below threshold', () => {
    const result = buildResult({ forwardDnaDepth: 20 })
    const move = getNextBestMove(result, buildContext())
    expect(move.key).toBe('complete_forward_dna')
    expect(move.cta.to).toBe('/forward-dna')
  })

  it('rule 3: recommends review_direction to /career-compass when Goal Alignment is lowest and below threshold', () => {
    const result = buildResult({ goalAlignment: 20 })
    const move = getNextBestMove(result, buildContext())
    expect(move.key).toBe('review_direction')
    expect(move.cta.to).toBe('/career-compass')
  })

  it('rule 4: recommends review_activity to /applications when Career Momentum is lowest, below threshold, AND hasActiveApplication is true', () => {
    const result = buildResult({ careerMomentum: 20 })
    const move = getNextBestMove(result, buildContext({ hasActiveApplication: true }))
    expect(move.key).toBe('review_activity')
    expect(move.cta.to).toBe('/applications')
  })

  it('Career Momentum low but hasActiveApplication false does NOT trigger review_activity -- falls through to the neutral fallback', () => {
    const result = buildResult({ careerMomentum: 5 })
    const move = getNextBestMove(result, buildContext())
    expect(move.key).not.toBe('review_activity')
    expect(move.key).toBe('stay_the_course')
  })

  it('breaks a tie between two below-threshold pillars using the fixed priority order (evidenceQuality before forwardDnaDepth)', () => {
    const result = buildResult({ evidenceQuality: 20, forwardDnaDepth: 20 })
    const first = getNextBestMove(result, buildContext())
    const second = getNextBestMove(result, buildContext())
    expect(first.key).toBe('add_career_win')
    // Deterministic: repeated calls on the identical fixture always agree.
    expect(second).toEqual(first)
  })

  it('breaks a full four-way tie using the fixed priority order (evidenceQuality wins over forwardDnaDepth, goalAlignment, careerMomentum)', () => {
    const result = buildResult({
      evidenceQuality: 10, forwardDnaDepth: 10, goalAlignment: 10, careerMomentum: 10,
    })
    const move = getNextBestMove(result, buildContext({ hasActiveApplication: true }))
    expect(move.key).toBe('add_career_win')
  })

  it('breaks a tie among the remaining three pillars using the fixed priority order once evidenceQuality is healthy', () => {
    const result = buildResult({ forwardDnaDepth: 10, goalAlignment: 10, careerMomentum: 10 })
    const move = getNextBestMove(result, buildContext({ hasActiveApplication: true }))
    expect(move.key).toBe('complete_forward_dna')
  })

  it('fallback is reachable: every pillar at or above threshold returns a well-formed neutral NextBestMove', () => {
    const result = buildResult({})
    const move = getNextBestMove(result, buildContext())
    expect(move).not.toBeNull()
    expect(move.key).toBe('stay_the_course')
    expect(typeof move.headline).toBe('string')
    expect(move.headline.length).toBeGreaterThan(0)
    expect(typeof move.detail).toBe('string')
    expect(move.detail.length).toBeGreaterThan(0)
    expect(move.cta).toBeTruthy()
  })

  it('a pillar scored exactly at the threshold (40) is treated as healthy, not below threshold', () => {
    const result = buildResult({ evidenceQuality: 40 })
    const move = getNextBestMove(result, buildContext())
    expect(move.key).toBe('stay_the_course')
  })

  it('is fully deterministic across repeated calls with identical input', () => {
    const result = buildResult({ goalAlignment: 15 })
    const first = getNextBestMove(result, buildContext({ hasActiveApplication: true }))
    const second = getNextBestMove(result, buildContext({ hasActiveApplication: true }))
    expect(first).toEqual(second)
  })
})

describe('getNextBestMove -- N13a lifecycle signals (LIFECYCLE_PRIORITY, checked before pillar rules)', () => {
  // Every case here uses a catastrophic pillar fixture so a lifecycle
  // firing is unambiguous evidence it truly bypasses THRESHOLD, not a
  // coincidence of a healthy fixture.
  const catastrophicPillars = buildResult({
    evidenceQuality: 5, forwardDnaDepth: 5, goalAlignment: 5, careerMomentum: 5,
  })

  it('tier 1: hasUpcomingInterview alone fires prepare_for_interview to /interviews', () => {
    const move = getNextBestMove(catastrophicPillars, buildContext({ hasUpcomingInterview: true }))
    expect(move.key).toBe('prepare_for_interview')
    expect(move.cta.to).toBe('/interviews')
  })

  it('tier 2: submittedRecently alone fires follow_up_on_application to /applications', () => {
    const move = getNextBestMove(catastrophicPillars, buildContext({ submittedRecently: true }))
    expect(move.key).toBe('follow_up_on_application')
    expect(move.cta.to).toBe('/applications')
  })

  it('tier 3: hasUnreadInboundMessages alone fires reply_to_strategist to /messages', () => {
    const move = getNextBestMove(catastrophicPillars, buildContext({ hasUnreadInboundMessages: true }))
    expect(move.key).toBe('reply_to_strategist')
    expect(move.cta.to).toBe('/messages')
  })

  it('lifecycle signals fire even when every pillar is healthy -- lifecycle bypasses THRESHOLD entirely', () => {
    const healthyPillars = buildResult({})
    const move = getNextBestMove(healthyPillars, buildContext({ hasUpcomingInterview: true }))
    expect(move.key).toBe('prepare_for_interview')
  })

  it('C1 guard: a real ForwardScoreInputs-style caller can never accidentally set hasUpcomingInterview true from a mock interview -- this is a type/context-boundary guarantee, not a runtime check, so this test documents the contract: only interview-tier context flips this key', () => {
    // hasUpcomingInterview is the ONLY predicate this tier checks. If a
    // caller derives it correctly (excluding mock interviews, per
    // useForwardScore.ts), false-here always means "no real upcoming
    // interview" regardless of any mock interview history -- there is no
    // other input this rule can react to.
    const move = getNextBestMove(catastrophicPillars, buildContext({ hasUpcomingInterview: false }))
    expect(move.key).not.toBe('prepare_for_interview')
  })

  it('exhaustive 16-combination precedence table: array position alone determines the outcome, regardless of pillar state', () => {
    const booleanCombos: boolean[][] = []
    for (let i = 0; i < 16; i++) {
      booleanCombos.push([Boolean(i & 8), Boolean(i & 4), Boolean(i & 2), Boolean(i & 1)])
    }

    for (const [hasActiveApplication, hasUpcomingInterview, submittedRecently, hasUnreadInboundMessages] of booleanCombos) {
      const context = { hasActiveApplication, hasUpcomingInterview, submittedRecently, hasUnreadInboundMessages }
      const move = getNextBestMove(catastrophicPillars, context)

      if (hasUpcomingInterview) {
        expect(move.key).toBe('prepare_for_interview')
      } else if (submittedRecently) {
        expect(move.key).toBe('follow_up_on_application')
      } else if (hasUnreadInboundMessages) {
        expect(move.key).toBe('reply_to_strategist')
      } else {
        // No lifecycle signal -> falls through to the pillar algorithm.
        // catastrophicPillars has a careerMomentum tie at the bottom
        // broken by PILLAR_PRIORITY -> evidenceQuality wins regardless
        // of hasActiveApplication.
        expect(move.key).toBe('add_career_win')
      }
    }
  })

  it('is fully deterministic across repeated calls with identical lifecycle context', () => {
    const context = buildContext({ hasUpcomingInterview: true, hasUnreadInboundMessages: true })
    const first = getNextBestMove(catastrophicPillars, context)
    const second = getNextBestMove(catastrophicPillars, context)
    expect(first).toEqual(second)
  })
})

describe('getNextBestMove -- regression: cta.to route allow-list', () => {
  it('every possible cta.to across every branch is one of exactly the 5 routes that exist for this feature -- no rogue route, and no dead/unreachable route', () => {
    const allowedRoutes = new Set([
      '/forward-dna', '/career-compass', '/applications', '/interviews', '/messages',
    ])

    const fixtures: { result: ForwardScoreResult; context: NextBestMoveContext }[] = [
      { result: buildResult({ evidenceQuality: 20 }), context: buildContext() },
      { result: buildResult({ forwardDnaDepth: 20 }), context: buildContext() },
      { result: buildResult({ goalAlignment: 20 }), context: buildContext() },
      { result: buildResult({ careerMomentum: 20 }), context: buildContext({ hasActiveApplication: true }) },
      { result: buildResult({ careerMomentum: 20 }), context: buildContext() },
      { result: buildResult({}), context: buildContext() },
      { result: buildResult({}), context: buildContext({ hasUpcomingInterview: true }) },
      { result: buildResult({}), context: buildContext({ submittedRecently: true }) },
      { result: buildResult({}), context: buildContext({ hasUnreadInboundMessages: true }) },
    ]

    const producedRoutes = new Set<string>()
    for (const { result, context } of fixtures) {
      const move = getNextBestMove(result, context)
      expect(allowedRoutes.has(move.cta.to)).toBe(true)
      producedRoutes.add(move.cta.to)
    }

    // Bidirectional: every allowed route must actually be reachable by
    // some combination above -- a route nobody can ever reach is exactly
    // as dead as a stale docstring claiming a feature "doesn't exist".
    expect(producedRoutes).toEqual(allowedRoutes)
  })
})
