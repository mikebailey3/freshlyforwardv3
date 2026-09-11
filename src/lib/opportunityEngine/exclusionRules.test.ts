import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { isExcludedByRules, getExclusionRules, addExclusionRule, removeExclusionRule } from './exclusionRules'
import type { MemberExclusionRule } from './memberOpportunityProfile'
import type { JobLike } from './jobNormalization'

function makeJob(overrides: Partial<JobLike> = {}): JobLike {
  return {
    source: 'test-source',
    title: 'Data Analyst',
    company: 'Acme Corp',
    location: 'Springfield, IL',
    description: 'A great role in the retail industry.',
    salary_text: null,
    employment_type: 'full_time',
    posting_url: 'https://example.com/job/1',
    posted_at: null,
    ...overrides,
  }
}

describe('isExcludedByRules (pure)', () => {
  it('is false when there are no rules at all', () => {
    expect(isExcludedByRules(makeJob(), [])).toBe(false)
  })

  it('matches a company rule case/legal-suffix-insensitively (reuses jobNormalization)', () => {
    const rules: MemberExclusionRule[] = [{ ruleType: 'company', value: 'acme' }]
    expect(isExcludedByRules(makeJob({ company: 'ACME Inc.' }), rules)).toBe(true)
  })

  it('does not match a different company', () => {
    const rules: MemberExclusionRule[] = [{ ruleType: 'company', value: 'globex' }]
    expect(isExcludedByRules(makeJob({ company: 'Acme Corp' }), rules)).toBe(false)
  })

  it('matches a title_keyword rule as a substring of the normalized title', () => {
    const rules: MemberExclusionRule[] = [{ ruleType: 'title_keyword', value: 'analyst' }]
    expect(isExcludedByRules(makeJob({ title: 'Senior Data Analyst' }), rules)).toBe(true)
  })

  it('does not match a title_keyword that is not present', () => {
    const rules: MemberExclusionRule[] = [{ ruleType: 'title_keyword', value: 'engineer' }]
    expect(isExcludedByRules(makeJob({ title: 'Senior Data Analyst' }), rules)).toBe(false)
  })

  it('matches an industry rule against the job description as a best-effort keyword check', () => {
    const rules: MemberExclusionRule[] = [{ ruleType: 'industry', value: 'retail' }]
    expect(isExcludedByRules(makeJob({ description: 'A role in the retail industry.' }), rules)).toBe(true)
  })

  it('a miss on an industry rule only ever means "not excluded," never a false block', () => {
    const rules: MemberExclusionRule[] = [{ ruleType: 'industry', value: 'healthcare' }]
    expect(isExcludedByRules(makeJob({ description: 'A role in the retail industry.' }), rules)).toBe(false)
  })

  it('matches if ANY rule matches, out of several', () => {
    const rules: MemberExclusionRule[] = [
      { ruleType: 'company', value: 'globex' },
      { ruleType: 'title_keyword', value: 'analyst' },
    ]
    expect(isExcludedByRules(makeJob({ title: 'Data Analyst' }), rules)).toBe(true)
  })

  it('ignores a rule with an empty/blank value rather than matching everything', () => {
    const rules: MemberExclusionRule[] = [{ ruleType: 'title_keyword', value: '   ' }]
    expect(isExcludedByRules(makeJob(), rules)).toBe(false)
  })
})

function makeFakeClient(overrides: Partial<Record<string, unknown>> = {}) {
  const eq = vi.fn().mockResolvedValue({ data: [], error: null, ...overrides })
  const select = vi.fn().mockReturnValue({ eq })
  const upsert = vi.fn().mockResolvedValue({ error: null })
  const deleteEq3 = vi.fn().mockResolvedValue({ error: null })
  const deleteEq2 = vi.fn().mockReturnValue({ eq: deleteEq3 })
  const deleteEq1 = vi.fn().mockReturnValue({ eq: deleteEq2 })
  const del = vi.fn().mockReturnValue({ eq: deleteEq1 })
  const fromMock = vi.fn().mockReturnValue({ select, upsert, delete: del })
  return { client: { from: fromMock } as unknown as SupabaseClient, fromMock, select, eq, upsert, del, deleteEq1, deleteEq2, deleteEq3 }
}

describe('getExclusionRules', () => {
  it('maps snake_case rows to MemberExclusionRule shape', async () => {
    const { client } = makeFakeClient({ data: [{ rule_type: 'company', value: 'Acme' }] })
    const result = await getExclusionRules('member-1', client)
    expect(result).toEqual([{ ruleType: 'company', value: 'Acme' }])
  })

  it('degrades to [] on a query error (e.g. table not migrated yet) rather than throwing', async () => {
    const { client } = makeFakeClient({ data: null, error: { message: 'relation does not exist' } })
    const result = await getExclusionRules('member-1', client)
    expect(result).toEqual([])
  })
})

describe('addExclusionRule / removeExclusionRule', () => {
  it('upserts on the member+type+value conflict key', async () => {
    const { client, upsert } = makeFakeClient()
    await addExclusionRule('member-1', { ruleType: 'company', value: 'Acme' }, client)
    expect(upsert).toHaveBeenCalledWith(
      { member_id: 'member-1', rule_type: 'company', value: 'Acme' },
      { onConflict: 'member_id,rule_type,value' }
    )
  })

  it('deletes scoped to member_id + rule_type + value', async () => {
    const { client, del, deleteEq1, deleteEq2, deleteEq3 } = makeFakeClient()
    await removeExclusionRule('member-1', { ruleType: 'company', value: 'Acme' }, client)
    expect(del).toHaveBeenCalled()
    expect(deleteEq1).toHaveBeenCalledWith('member_id', 'member-1')
    expect(deleteEq2).toHaveBeenCalledWith('rule_type', 'company')
    expect(deleteEq3).toHaveBeenCalledWith('value', 'Acme')
  })
})
