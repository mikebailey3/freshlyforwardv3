// src/lib/forwardScore/nextBestMove.test.ts
import { describe, it, expect } from 'vitest'
import { getNextBestMove } from './nextBestMove'
import type { ForwardScorePillarKey, ForwardScorePillarResult, ForwardScoreResult } from '@/types/forwardScore'

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

describe('getNextBestMove', () => {
  it('rule 1: recommends add_career_win to /forward-dna when Evidence Quality is lowest and below threshold', () => {
    const result = buildResult({ evidenceQuality: 20 })
    const move = getNextBestMove(result, { hasActiveApplication: false })
    expect(move.key).toBe('add_career_win')
    expect(move.cta.to).toBe('/forward-dna')
  })

  it('rule 2: recommends complete_forward_dna to /forward-dna when Forward DNA Depth is lowest and below threshold', () => {
    const result = buildResult({ forwardDnaDepth: 20 })
    const move = getNextBestMove(result, { hasActiveApplication: false })
    expect(move.key).toBe('complete_forward_dna')
    expect(move.cta.to).toBe('/forward-dna')
  })

  it('rule 3: recommends review_direction to /career-compass when Goal Alignment is lowest and below threshold', () => {
    const result = buildResult({ goalAlignment: 20 })
    const move = getNextBestMove(result, { hasActiveApplication: false })
    expect(move.key).toBe('review_direction')
    expect(move.cta.to).toBe('/career-compass')
  })

  it('rule 4: recommends review_activity to /applications when Career Momentum is lowest, below threshold, AND hasActiveApplication is true', () => {
    const result = buildResult({ careerMomentum: 20 })
    const move = getNextBestMove(result, { hasActiveApplication: true })
    expect(move.key).toBe('review_activity')
    expect(move.cta.to).toBe('/applications')
  })

  it('Career Momentum low but hasActiveApplication false does NOT trigger review_activity -- falls through to the neutral fallback', () => {
    const result = buildResult({ careerMomentum: 5 })
    const move = getNextBestMove(result, { hasActiveApplication: false })
    expect(move.key).not.toBe('review_activity')
    expect(move.key).toBe('stay_the_course')
  })

  it('breaks a tie between two below-threshold pillars using the fixed priority order (evidenceQuality before forwardDnaDepth)', () => {
    const result = buildResult({ evidenceQuality: 20, forwardDnaDepth: 20 })
    const first = getNextBestMove(result, { hasActiveApplication: false })
    const second = getNextBestMove(result, { hasActiveApplication: false })
    expect(first.key).toBe('add_career_win')
    // Deterministic: repeated calls on the identical fixture always agree.
    expect(second).toEqual(first)
  })

  it('breaks a full four-way tie using the fixed priority order (evidenceQuality wins over forwardDnaDepth, goalAlignment, careerMomentum)', () => {
    const result = buildResult({
      evidenceQuality: 10, forwardDnaDepth: 10, goalAlignment: 10, careerMomentum: 10,
    })
    const move = getNextBestMove(result, { hasActiveApplication: true })
    expect(move.key).toBe('add_career_win')
  })

  it('breaks a tie among the remaining three pillars using the fixed priority order once evidenceQuality is healthy', () => {
    const result = buildResult({ forwardDnaDepth: 10, goalAlignment: 10, careerMomentum: 10 })
    const move = getNextBestMove(result, { hasActiveApplication: true })
    expect(move.key).toBe('complete_forward_dna')
  })

  it('fallback is reachable: every pillar at or above threshold returns a well-formed neutral NextBestMove', () => {
    const result = buildResult({})
    const move = getNextBestMove(result, { hasActiveApplication: false })
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
    const move = getNextBestMove(result, { hasActiveApplication: false })
    expect(move.key).toBe('stay_the_course')
  })

  it('is fully deterministic across repeated calls with identical input', () => {
    const result = buildResult({ goalAlignment: 15 })
    const first = getNextBestMove(result, { hasActiveApplication: true })
    const second = getNextBestMove(result, { hasActiveApplication: true })
    expect(first).toEqual(second)
  })

  it('regression: every possible cta.to across every branch is one of the three routes that exist on this branch', () => {
    const allowedRoutes = new Set(['/forward-dna', '/career-compass', '/applications'])

    const fixtures: { result: ForwardScoreResult; context: { hasActiveApplication: boolean } }[] = [
      { result: buildResult({ evidenceQuality: 20 }), context: { hasActiveApplication: false } },
      { result: buildResult({ forwardDnaDepth: 20 }), context: { hasActiveApplication: false } },
      { result: buildResult({ goalAlignment: 20 }), context: { hasActiveApplication: false } },
      { result: buildResult({ careerMomentum: 20 }), context: { hasActiveApplication: true } },
      { result: buildResult({ careerMomentum: 20 }), context: { hasActiveApplication: false } },
      { result: buildResult({}), context: { hasActiveApplication: false } },
    ]

    for (const { result, context } of fixtures) {
      const move = getNextBestMove(result, context)
      expect(allowedRoutes.has(move.cta.to)).toBe(true)
    }
  })
})
