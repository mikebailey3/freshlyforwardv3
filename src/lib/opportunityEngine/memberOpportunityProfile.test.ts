import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildMemberOpportunityProfile,
  composeMemberOpportunityProfile,
  extractCareerDirectionScore,
  extractConfirmedCapabilitySkills,
} from './memberOpportunityProfile'
import type { MemberProfile } from '@/types'
import type { CareerSkill, CareerScope } from '@/types/forwardDna'

function makeProfile(): MemberProfile {
  return { user_id: 'user-1', skills: ['sql'] } as unknown as MemberProfile
}

describe('extractConfirmedCapabilitySkills (pure)', () => {
  it('dedupes repeated skill names -- e.g. the same skill confirmed via two different Career Wins', () => {
    const result = extractConfirmedCapabilitySkills([{ skill_name: 'python' }, { skill_name: 'python' }, { skill_name: 'sql' }])
    expect(result).toEqual(['python', 'sql'])
  })

  it('returns an empty array for null/undefined rows -- missing data, never a crash', () => {
    expect(extractConfirmedCapabilitySkills(null)).toEqual([])
    expect(extractConfirmedCapabilitySkills(undefined)).toEqual([])
  })

  it('returns an empty array for an empty row list', () => {
    expect(extractConfirmedCapabilitySkills([])).toEqual([])
  })

  it('filters out malformed rows with an empty/falsy skill_name rather than propagating garbage', () => {
    const result = extractConfirmedCapabilitySkills([{ skill_name: '' }, { skill_name: 'sql' }])
    expect(result).toEqual(['sql'])
  })
})

describe('extractCareerDirectionScore (pure)', () => {
  it('reads the careerDirection score off a well-formed row', () => {
    expect(extractCareerDirectionScore({ readiness_scores: { careerDirection: 72 } })).toBe(72)
  })

  it('returns null (never throws, never fabricates 0) when the row is missing entirely', () => {
    expect(extractCareerDirectionScore(null)).toBeNull()
    expect(extractCareerDirectionScore(undefined)).toBeNull()
  })

  it('returns null when readiness_scores itself is null -- malformed/incomplete row', () => {
    expect(extractCareerDirectionScore({ readiness_scores: null })).toBeNull()
  })

  it('returns null when readiness_scores exists but has no careerDirection key yet', () => {
    expect(extractCareerDirectionScore({ readiness_scores: {} })).toBeNull()
  })
})

describe('composeMemberOpportunityProfile (pure)', () => {
  it('composes all four canonical inputs into one profile', () => {
    const profile = makeProfile()
    const skills: CareerSkill[] = [{ id: 's1', user_id: 'user-1', skill_name: 'sql', state: 'demonstrated', evidence_note: null, created_at: '', updated_at: '' }]
    const scope: CareerScope[] = [{ id: 'sc1', user_id: 'user-1', employment_entry_id: 'e1', revenue_managed_cents: null, team_size: 5, budget_managed_cents: null, direct_reports: null, notes: null, created_at: '', updated_at: '' }]

    const result = composeMemberOpportunityProfile(profile, {
      skills,
      scope,
      confirmedCapabilityRows: [{ skill_name: 'python' }],
      compassRow: { readiness_scores: { careerDirection: 60 } },
    })

    expect(result.skills).toBe(skills)
    expect(result.scope).toBe(scope)
    expect(result.confirmedCapabilities).toEqual(['python'])
    expect(result.careerDirectionScore).toBe(60)
  })

  it('never refetches or duplicates the canonical Forward Profile -- the exact same object reference passed in comes back out', () => {
    const profile = makeProfile()
    const result = composeMemberOpportunityProfile(profile, {
      skills: [], scope: [], confirmedCapabilityRows: [], compassRow: null,
    })
    expect(result.profile).toBe(profile)
  })

  it('defaults exclusionRules to an empty array when omitted', () => {
    const result = composeMemberOpportunityProfile(makeProfile(), {
      skills: [], scope: [], confirmedCapabilityRows: [], compassRow: null,
    })
    expect(result.exclusionRules).toEqual([])
  })

  it('passes exclusionRules through when provided (OE 2.0 Phase 9)', () => {
    const rules = [{ ruleType: 'company' as const, value: 'Acme' }]
    const result = composeMemberOpportunityProfile(makeProfile(), {
      skills: [], scope: [], confirmedCapabilityRows: [], compassRow: null, exclusionRules: rules,
    })
    expect(result.exclusionRules).toEqual(rules)
  })

  it('defaults resumeSkills to an empty array when omitted (OE 2.0 Phase 5)', () => {
    const result = composeMemberOpportunityProfile(makeProfile(), {
      skills: [], scope: [], confirmedCapabilityRows: [], compassRow: null,
    })
    expect(result.resumeSkills).toEqual([])
  })

  it('passes resumeSkills through when provided (OE 2.0 Phase 5)', () => {
    const result = composeMemberOpportunityProfile(makeProfile(), {
      skills: [], scope: [], confirmedCapabilityRows: [], compassRow: null, resumeSkills: ['sql'],
    })
    expect(result.resumeSkills).toEqual(['sql'])
  })

  it('degrades gracefully for a member with no evidence anywhere on file (missing data)', () => {
    const result = composeMemberOpportunityProfile(makeProfile(), {
      skills: [], scope: [], confirmedCapabilityRows: null, compassRow: undefined,
    })
    expect(result.confirmedCapabilities).toEqual([])
    expect(result.careerDirectionScore).toBeNull()
  })
})

function makeFakeClient(opts: {
  capabilityRows?: { skill_name: string }[] | null
  capabilityError?: string
  compassRow?: { readiness_scores: { careerDirection?: number | null } | null } | null
  masterResume?: { id: string } | null
  resumeSkillEntries?: { skill_value: string | null }[]
  exclusionRuleRows?: { rule_type: string; value: string }[]
}) {
  const dnaEq = vi.fn().mockResolvedValue({ data: [], error: null })
  const dnaSelect = vi.fn().mockReturnValue({ eq: dnaEq })

  const capsEq2 = vi.fn().mockResolvedValue({
    data: opts.capabilityRows ?? [],
    error: opts.capabilityError ? { message: opts.capabilityError } : null,
  })
  const capsEq1 = vi.fn().mockReturnValue({ eq: capsEq2 })
  const capsSelect = vi.fn().mockReturnValue({ eq: capsEq1 })

  const compassMaybeSingle = vi.fn().mockResolvedValue({ data: opts.compassRow ?? null, error: null })
  const compassEq2 = vi.fn().mockReturnValue({ maybeSingle: compassMaybeSingle })
  const compassEq1 = vi.fn().mockReturnValue({ eq: compassEq2 })
  const compassSelect = vi.fn().mockReturnValue({ eq: compassEq1 })

  const masterMaybeSingle = vi.fn().mockResolvedValue({ data: opts.masterResume ?? null, error: null })
  const masterEq3 = vi.fn().mockReturnValue({ maybeSingle: masterMaybeSingle })
  const masterEq2 = vi.fn().mockReturnValue({ eq: masterEq3 })
  const masterEq1 = vi.fn().mockReturnValue({ eq: masterEq2 })
  const masterSelect = vi.fn().mockReturnValue({ eq: masterEq1 })

  const entriesEq3 = vi.fn().mockResolvedValue({ data: opts.resumeSkillEntries ?? [], error: null })
  const entriesEq2 = vi.fn().mockReturnValue({ eq: entriesEq3 })
  const entriesEq1 = vi.fn().mockReturnValue({ eq: entriesEq2 })
  const entriesSelect = vi.fn().mockReturnValue({ eq: entriesEq1 })

  const exclusionRulesEq = vi.fn().mockResolvedValue({ data: opts.exclusionRuleRows ?? [], error: null })
  const exclusionRulesSelect = vi.fn().mockReturnValue({ eq: exclusionRulesEq })

  const tablesTouched: string[] = []
  const fromMock = vi.fn((table: string) => {
    tablesTouched.push(table)
    if (table === 'career_skills' || table === 'career_scope') return { select: dnaSelect }
    if (table === 'career_win_capabilities') return { select: capsSelect }
    if (table === 'career_compass_results') return { select: compassSelect }
    if (table === 'resume_versions') return { select: masterSelect }
    if (table === 'resume_entries') return { select: entriesSelect }
    if (table === 'member_job_exclusion_rules') return { select: exclusionRulesSelect }
    throw new Error(`Unexpected table: ${table} -- buildMemberOpportunityProfile must only read its canonical evidence tables`)
  })

  return { client: { from: fromMock } as unknown as SupabaseClient, tablesTouched, capsEq1, capsEq2 }
}

describe('buildMemberOpportunityProfile (async fetch + compose)', () => {
  it('touches exactly the canonical evidence tables -- no duplicate identity/evidence store is ever created or queried', async () => {
    const { client, tablesTouched } = makeFakeClient({})
    const profile = makeProfile()
    await buildMemberOpportunityProfile(profile.user_id, profile, client)
    expect(new Set(tablesTouched)).toEqual(
      new Set([
        'career_skills', 'career_scope', 'career_win_capabilities', 'career_compass_results',
        'resume_versions', 'member_job_exclusion_rules',
      ])
    )
  })

  it('never refetches member_profiles -- the caller-supplied profile object comes back unchanged', async () => {
    const { client } = makeFakeClient({})
    const profile = makeProfile()
    const result = await buildMemberOpportunityProfile(profile.user_id, profile, client)
    expect(result.profile).toBe(profile)
  })

  it('only counts confirmed (status=confirmed) capabilities -- filters at the query level', async () => {
    const { client, capsEq2 } = makeFakeClient({ capabilityRows: [{ skill_name: 'python' }] })
    const profile = makeProfile()
    const result = await buildMemberOpportunityProfile(profile.user_id, profile, client)
    expect(capsEq2).toHaveBeenCalledWith('status', 'confirmed')
    expect(result.confirmedCapabilities).toEqual(['python'])
  })

  it('degrades to empty/null gracefully when a member has no capabilities or Career Compass result yet (missing data)', async () => {
    const { client } = makeFakeClient({ capabilityRows: [], compassRow: null })
    const profile = makeProfile()
    const result = await buildMemberOpportunityProfile(profile.user_id, profile, client)
    expect(result.confirmedCapabilities).toEqual([])
    expect(result.careerDirectionScore).toBeNull()
  })

  it('degrades to an empty list rather than throwing when the capabilities query itself errors (malformed/failed response)', async () => {
    const { client } = makeFakeClient({ capabilityRows: null, capabilityError: 'boom' })
    const profile = makeProfile()
    const result = await buildMemberOpportunityProfile(profile.user_id, profile, client)
    expect(result.confirmedCapabilities).toEqual([])
  })

  it('returns an empty exclusionRules array when the member has none on file (OE 2.0 Phase 9)', async () => {
    const { client } = makeFakeClient({})
    const profile = makeProfile()
    const result = await buildMemberOpportunityProfile(profile.user_id, profile, client)
    expect(result.exclusionRules).toEqual([])
  })

  it('returns the member\'s persisted exclusion rules, mapped to camelCase (OE 2.0 Phase 9)', async () => {
    const { client } = makeFakeClient({ exclusionRuleRows: [{ rule_type: 'company', value: 'Acme' }] })
    const profile = makeProfile()
    const result = await buildMemberOpportunityProfile(profile.user_id, profile, client)
    expect(result.exclusionRules).toEqual([{ ruleType: 'company', value: 'Acme' }])
  })

  it('returns an empty resumeSkills array when the member has no active Master Resume yet (OE 2.0 Phase 5)', async () => {
    const { client } = makeFakeClient({ masterResume: null })
    const profile = makeProfile()
    const result = await buildMemberOpportunityProfile(profile.user_id, profile, client)
    expect(result.resumeSkills).toEqual([])
  })

  it('returns the Master Resume\'s claimed skills when one exists (OE 2.0 Phase 5)', async () => {
    const { client } = makeFakeClient({
      masterResume: { id: 'version-1' },
      resumeSkillEntries: [{ skill_value: 'sql' }, { skill_value: 'leadership' }],
    })
    const profile = makeProfile()
    const result = await buildMemberOpportunityProfile(profile.user_id, profile, client)
    expect(result.resumeSkills).toEqual(['sql', 'leadership'])
  })
})
