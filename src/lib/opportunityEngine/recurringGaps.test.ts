import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { extractRecurringGaps, getRecurringGaps, MIN_RECURRING_FREQUENCY } from './recurringGaps'
import type { FreshFitDimensionResult } from '@/lib/freshFitScore/types'

function skillsDimension(gaps: string[], unknowns: string[] = []): FreshFitDimensionResult {
  return {
    key: 'skillsEvidence',
    label: 'Skills & Evidence',
    score: 50,
    weight: 0.4,
    status: 'moderate',
    explanation: '',
    evidence: [],
    gaps,
    unknowns,
    improvementLink: null,
  }
}

function otherDimension(key: FreshFitDimensionResult['key'], gaps: string[]): FreshFitDimensionResult {
  return {
    key,
    label: key,
    score: 50,
    weight: 0.15,
    status: 'moderate',
    explanation: '',
    evidence: [],
    gaps,
    unknowns: [],
    improvementLink: null,
  }
}

function v2Row(dimensions: FreshFitDimensionResult[]) {
  return {
    score_breakdown: {
      skillsCoverage: 0, roleRelevance: 0, locationFit: 0, keywordDensity: 0,
      v2: {
        tier: 'good' as const, confidence: 'medium' as const, dimensions,
        hardConstraints: [], unknowns: [], recommendation: { key: 'worth_a_look' as const, headline: '', detail: '' },
      },
    },
  }
}

describe('extractRecurringGaps (pure)', () => {
  it('returns [] for null/undefined/empty input -- missing data, never a crash', () => {
    expect(extractRecurringGaps(null)).toEqual([])
    expect(extractRecurringGaps(undefined)).toEqual([])
    expect(extractRecurringGaps([])).toEqual([])
  })

  it('only counts a skill once it recurs at least MIN_RECURRING_FREQUENCY times', () => {
    const rows = [
      v2Row([skillsDimension(['sql'])]),
      v2Row([skillsDimension(['sql'])]),
    ]
    expect(extractRecurringGaps(rows)).toEqual([{ skill: 'sql', frequency: 2 }])
  })

  it('excludes a skill seen only once -- a single gap is not yet a pattern', () => {
    const rows = [v2Row([skillsDimension(['sql'])])]
    expect(extractRecurringGaps(rows)).toEqual([])
  })

  it('respects a custom minFrequency override', () => {
    const rows = [v2Row([skillsDimension(['sql'])]), v2Row([skillsDimension(['sql'])])]
    expect(extractRecurringGaps(rows, 3)).toEqual([])
    expect(extractRecurringGaps(rows, 1)).toEqual([{ skill: 'sql', frequency: 2 }])
  })

  it('reads only the skillsEvidence dimension -- gaps from other dimensions never leak in', () => {
    const rows = [
      v2Row([skillsDimension([]), otherDimension('compensation', ['posted pay range meets your stated minimum'])]),
      v2Row([skillsDimension([]), otherDimension('careerDirection', ['a clearer sense of career direction'])]),
    ]
    expect(extractRecurringGaps(rows, 1)).toEqual([])
  })

  it('never turns unknowns into gaps -- Unknown != Missing', () => {
    const rows = [
      v2Row([skillsDimension([], ['aws'])]),
      v2Row([skillsDimension([], ['aws'])]),
    ]
    expect(extractRecurringGaps(rows, 1)).toEqual([])
  })

  it('skips legacy engine_version=1-shaped rows (no v2 key) without throwing', () => {
    const rows = [{ score_breakdown: { skillsCoverage: 1, roleRelevance: 1, locationFit: 1, keywordDensity: 1 } }]
    expect(() => extractRecurringGaps(rows, 1)).not.toThrow()
    expect(extractRecurringGaps(rows, 1)).toEqual([])
  })

  it('skips malformed rows (null score_breakdown, missing skillsEvidence dimension) without throwing', () => {
    const rows = [{ score_breakdown: null }, v2Row([otherDimension('roleRelevance', ['x'])])]
    expect(() => extractRecurringGaps(rows, 1)).not.toThrow()
    expect(extractRecurringGaps(rows, 1)).toEqual([])
  })

  it('normalizes case/whitespace so the same skill is not double-counted', () => {
    const rows = [v2Row([skillsDimension(['SQL'])]), v2Row([skillsDimension([' sql '])])]
    expect(extractRecurringGaps(rows, 1)).toEqual([{ skill: 'sql', frequency: 2 }])
  })

  it('dedupes repeated mentions of the same skill within a single match\'s own gaps list', () => {
    const rows = [v2Row([skillsDimension(['sql', 'sql'])]), v2Row([skillsDimension(['sql'])])]
    expect(extractRecurringGaps(rows, 1)).toEqual([{ skill: 'sql', frequency: 2 }])
  })

  it('sorts by frequency descending, tie-broken alphabetically', () => {
    const rows = [
      v2Row([skillsDimension(['sql', 'excel'])]),
      v2Row([skillsDimension(['sql', 'excel'])]),
      v2Row([skillsDimension(['sql'])]),
    ]
    expect(extractRecurringGaps(rows, 1)).toEqual([
      { skill: 'sql', frequency: 3 },
      { skill: 'excel', frequency: 2 },
    ])
  })
})

function makeFakeClient(rows: unknown[] | null) {
  const eq2 = vi.fn().mockResolvedValue({ data: rows, error: null })
  const eq1 = vi.fn().mockReturnValue({ eq: eq2 })
  const select = vi.fn().mockReturnValue({ eq: eq1 })
  const fromMock = vi.fn().mockReturnValue({ select })
  return { client: { from: fromMock } as unknown as SupabaseClient, fromMock, eq1, eq2 }
}

describe('getRecurringGaps (async fetch + aggregate)', () => {
  it('queries job_matches scoped to the member and the v2 engine only', async () => {
    const { client, fromMock, eq1, eq2 } = makeFakeClient([])
    await getRecurringGaps('member-1', client)
    expect(fromMock).toHaveBeenCalledWith('job_matches')
    expect(eq1).toHaveBeenCalledWith('member_id', 'member-1')
    expect(eq2).toHaveBeenCalledWith('engine_version', 2)
  })

  it('aggregates the fetched rows through extractRecurringGaps', async () => {
    const rows = [v2Row([skillsDimension(['sql'])]), v2Row([skillsDimension(['sql'])])]
    const { client } = makeFakeClient(rows)
    const result = await getRecurringGaps('member-1', client)
    expect(result).toEqual([{ skill: 'sql', frequency: 2 }])
  })

  it('degrades to an empty array when the query returns no rows', async () => {
    const { client } = makeFakeClient(null)
    const result = await getRecurringGaps('member-1', client)
    expect(result).toEqual([])
  })

  it('accepts a custom minFrequency override', async () => {
    const rows = [v2Row([skillsDimension(['sql'])])]
    const { client } = makeFakeClient(rows)
    const result = await getRecurringGaps('member-1', client, 1)
    expect(result).toEqual([{ skill: 'sql', frequency: 1 }])
  })
})

describe('MIN_RECURRING_FREQUENCY', () => {
  it('is exported as the documented default of 2', () => {
    expect(MIN_RECURRING_FREQUENCY).toBe(2)
  })
})
