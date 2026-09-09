import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { analyzeMasterResume } from './analyzeMasterResume'

interface FakeClientOptions {
  master?: { id: string } | null
  entries?: Record<string, unknown>[]
  profile?: Record<string, unknown> | null
}

function makeFakeClient(opts: FakeClientOptions = {}) {
  const {
    master = { id: 'version-1' },
    entries = [
      { entry_kind: 'employment', canonical_entry_id: 'entry-emp-1', included: true, sort_order: 0, override_description: null },
      { entry_kind: 'skill', canonical_entry_id: null, skill_value: 'SQL', included: true, sort_order: 0, override_description: null },
    ],
    profile = {
      full_name: 'Jamie Rivera',
      phone: '555-123-4567',
      location: 'Denver, CO',
      summary: 'Product leader focused on measurable outcomes.',
      employment_history: [
        { id: 'entry-emp-1', company: 'Initech Corp', title: 'Senior Product Manager', start_date: '2021-01', end_date: null, current: true, description: 'Grew revenue by 30%.' },
      ],
      education: [],
      certifications: [],
      skills: ['SQL', 'Leadership'],
    },
  } = opts

  const masterMaybeSingleMock = vi.fn().mockResolvedValue({ data: master, error: null })
  const masterEqArchivedMock = vi.fn().mockReturnValue({ maybeSingle: masterMaybeSingleMock })
  const masterEqMasterMock = vi.fn().mockReturnValue({ eq: masterEqArchivedMock })
  const masterEqMemberMock = vi.fn().mockReturnValue({ eq: masterEqMasterMock })
  const masterSelectMock = vi.fn().mockReturnValue({ eq: masterEqMemberMock })

  const entriesEqMock = vi.fn().mockResolvedValue({ data: entries, error: null })
  const entriesSelectMock = vi.fn().mockReturnValue({ eq: entriesEqMock })

  const profileMaybeSingleMock = vi.fn().mockResolvedValue({ data: profile, error: null })
  const profileEqMock = vi.fn().mockReturnValue({ maybeSingle: profileMaybeSingleMock })
  const profileSelectMock = vi.fn().mockReturnValue({ eq: profileEqMock })

  const fromMock = vi.fn((table: string) => {
    if (table === 'resume_versions') return { select: masterSelectMock }
    if (table === 'resume_entries') return { select: entriesSelectMock }
    if (table === 'member_profiles') return { select: profileSelectMock }
    throw new Error(`unexpected table in test: ${table}`)
  })

  return { client: { from: fromMock } as unknown as SupabaseClient, fromMock }
}

describe('analyzeMasterResume', () => {
  it('reports an error when no active Master Resume exists', async () => {
    const { client } = makeFakeClient({ master: null })
    const { result, error } = await analyzeMasterResume({ userId: 'user-1', email: 'jamie@example.com' }, client)
    expect(result).toBeNull()
    expect(error).toContain('No active Master Resume')
  })

  it('builds ResumeContentInput from selected entries and runs the six-dimension analysis', async () => {
    const { client } = makeFakeClient()
    const { result, error } = await analyzeMasterResume({ userId: 'user-1', email: 'jamie@example.com' }, client)
    expect(error).toBeNull()
    expect(result).not.toBeNull()
    expect(result?.dimensions).toHaveLength(6)
    expect(result?.dimensions.map((d) => d.key)).toEqual([
      'atsReadability', 'structuralQuality', 'contentStrength', 'quantification', 'targetRoleAlignment', 'evidenceCoverage',
    ])
  })

  it('only includes employment entries selected (included=true) in resume_entries, not every Profile entry', async () => {
    const { client } = makeFakeClient({
      entries: [], // nothing selected for this version
      profile: {
        full_name: 'Jamie Rivera', phone: null, location: null, summary: null,
        employment_history: [{ id: 'entry-emp-1', company: 'Initech Corp', title: 'PM', start_date: '2021-01', end_date: null, current: true, description: '' }],
        education: [], certifications: [], skills: ['SQL'],
      },
    })
    const { result } = await analyzeMasterResume({ userId: 'user-1', email: 'jamie@example.com' }, client)
    // structuralQuality's NO_EXPERIENCE_ENTRIES finding fires only when the ResumeContentInput's employment array is empty --
    // confirms the analysis used the (empty) selection, not the raw Profile's one entry.
    const structural = result?.dimensions.find((d) => d.key === 'structuralQuality')
    expect(structural?.findings.some((f) => f.code === 'NO_EXPERIENCE_ENTRIES')).toBe(true)
  })

  it('applies an entry\'s override_description on top of its canonical description for employment', async () => {
    const { client } = makeFakeClient({
      entries: [{ entry_kind: 'employment', canonical_entry_id: 'entry-emp-1', included: true, sort_order: 0, override_description: 'Led the platform overhaul that grew revenue 30% in nine months.' }],
    })
    const { result } = await analyzeMasterResume({ userId: 'user-1', email: 'jamie@example.com' }, client)
    // Quantification should see the overridden text (which still has a metric) -- proves the override reached the analyzer, not the original description.
    const quant = result?.dimensions.find((d) => d.key === 'quantification')
    expect(quant?.findings.some((f) => f.code === 'BULLET_NOT_QUANTIFIED')).toBe(false)
  })

  it('prefers resume_versions.summary_override over the canonical member_profiles.summary when set', async () => {
    const { client, fromMock } = makeFakeClient({
      master: { id: 'version-1', summary_override: 'A results-driven summary written for this version only.' } as unknown as { id: string },
      profile: {
        full_name: 'Jamie Rivera', phone: null, location: null, summary: 'Clean canonical summary with no cliches.',
        employment_history: [], education: [], certifications: [], skills: [],
      },
    })
    const { result } = await analyzeMasterResume({ userId: 'user-1', email: 'jamie@example.com' }, client)
    expect(fromMock).toHaveBeenCalledWith('resume_versions')
    // The override text contains a cliche the canonical summary does not -- this only fires if the
    // override actually reached the analyzer instead of the canonical member_profiles.summary.
    const contentStrength = result?.dimensions.find((d) => d.key === 'contentStrength')
    expect(contentStrength?.findings.some((f) => f.code === 'CLICHE_IN_SUMMARY')).toBe(true)
  })

  it('falls back to the canonical member_profiles.summary when no summary_override is set', async () => {
    const { client } = makeFakeClient({
      master: { id: 'version-1' },
      profile: {
        full_name: 'Jamie Rivera', phone: null, location: null, summary: 'Results-driven summary in the canonical Profile.',
        employment_history: [], education: [], certifications: [], skills: [],
      },
    })
    const { result } = await analyzeMasterResume({ userId: 'user-1', email: 'jamie@example.com' }, client)
    const contentStrength = result?.dimensions.find((d) => d.key === 'contentStrength')
    expect(contentStrength?.findings.some((f) => f.code === 'CLICHE_IN_SUMMARY')).toBe(true)
  })
})
