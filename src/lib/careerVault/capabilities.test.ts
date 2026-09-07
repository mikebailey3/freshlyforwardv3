import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { confirmCapabilities, getCapabilitiesForCareerWin } from './capabilities'

interface FakeSkillRow {
  user_id: string
  skill_name: string
  state: string
}

interface FakeCapabilityRow {
  career_win_id: string
  skill_name: string
  [key: string]: unknown
}

/**
 * Simulates just enough of career_skills and career_win_capabilities to
 * prove the atomic conditional-update, insert-on-conflict-do-nothing, and
 * cross-call-idempotent-upsert behaviors -- including that a WHERE-guarded
 * UPDATE genuinely cannot touch a protected row, and that resubmitting an
 * already-persisted (career_win_id, skill_name) pair is a silent no-op
 * rather than a UNIQUE-constraint failure.
 */
function makeFakeClient(opts: {
  existingCapabilities?: FakeCapabilityRow[]
  capUpsertError?: string
  selectRows?: unknown[]
  selectError?: string
  initialSkills?: FakeSkillRow[]
  updateError?: string
  insertError?: string
} = {}) {
  const skillsTable: FakeSkillRow[] = opts.initialSkills ? [...opts.initialSkills] : []
  const capabilitiesTable: FakeCapabilityRow[] = opts.existingCapabilities ? [...opts.existingCapabilities] : []

  // Mirrors Postgres RETURNING semantics for upsert+ON CONFLICT DO NOTHING:
  // only genuinely newly-inserted rows come back from .select() afterward.
  const capUpsertSelect = vi.fn()
  const capUpsertMock = vi.fn().mockImplementation((rows: FakeCapabilityRow[]) => {
    const inserted: FakeCapabilityRow[] = []
    if (!opts.capUpsertError) {
      for (const row of rows) {
        const exists = capabilitiesTable.some(
          (c) => c.career_win_id === row.career_win_id && c.skill_name === row.skill_name
        )
        if (!exists) {
          capabilitiesTable.push(row)
          inserted.push(row)
        }
      }
    }
    capUpsertSelect.mockResolvedValue({
      data: inserted,
      error: opts.capUpsertError ? { message: opts.capUpsertError } : null,
    })
    return { select: capUpsertSelect }
  })

  const capSelectEqStatus = vi.fn().mockResolvedValue({
    data: opts.selectRows ?? [],
    error: opts.selectError ? { message: opts.selectError } : null,
  })
  const capSelectEqWin = vi.fn().mockReturnValue({ eq: capSelectEqStatus })
  const capSelectMock = vi.fn().mockReturnValue({ eq: capSelectEqWin })

  // Chain: update({state}).eq('user_id', u).eq('skill_name', s).neq(...).neq(...)
  // The two trailing .neq() calls model the WHERE guard: only a row that is
  // currently neither 'demonstrated' nor 'supported' can ever be matched.
  const skillsUpdateMock = vi.fn().mockImplementation((patch: { state: string }) => {
    let userId = ''
    let skillName = ''
    const runGuardedUpdate = async () => {
      if (opts.updateError) return { error: { message: opts.updateError } }
      const row = skillsTable.find((s) => s.user_id === userId && s.skill_name === skillName)
      if (row && row.state !== 'demonstrated' && row.state !== 'supported') {
        row.state = patch.state
      }
      return { error: null }
    }
    return {
      eq: vi.fn().mockImplementation((_col1: string, uid: string) => {
        userId = uid
        return {
          eq: vi.fn().mockImplementation((_col2: string, sname: string) => {
            skillName = sname
            return { neq: vi.fn().mockReturnValue({ neq: vi.fn().mockImplementation(runGuardedUpdate) }) }
          }),
        }
      }),
    }
  })

  const skillsUpsertMock = vi.fn().mockImplementation(async (row: FakeSkillRow) => {
    if (opts.insertError) return { error: { message: opts.insertError } }
    const exists = skillsTable.some((s) => s.user_id === row.user_id && s.skill_name === row.skill_name)
    if (!exists) skillsTable.push({ ...row })
    return { error: null }
  })

  const fromMock = vi.fn().mockImplementation((table: string) => {
    if (table === 'career_win_capabilities') return { upsert: capUpsertMock, select: capSelectMock }
    if (table === 'career_skills') return { update: skillsUpdateMock, upsert: skillsUpsertMock }
    throw new Error(`unexpected table: ${table}`)
  })

  return {
    client: { from: fromMock } as unknown as SupabaseClient,
    capUpsertMock,
    capSelectMock,
    capSelectEqWin,
    capSelectEqStatus,
    skillsTable,
    capabilitiesTable,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('confirmCapabilities', () => {
  it('inserts one confirmed row per input, always at suggested_state demonstrated', async () => {
    const { client, capUpsertMock } = makeFakeClient()

    await confirmCapabilities(
      'u1',
      [{ careerWinId: 'win-1', skillName: 'Inventory Management', source: 'system', inferenceReason: 'Statement mentions inventory or stock.' }],
      client
    )

    expect(capUpsertMock).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          career_win_id: 'win-1',
          user_id: 'u1',
          skill_name: 'Inventory Management',
          suggested_state: 'demonstrated',
          source: 'system',
          inference_reason: 'Statement mentions inventory or stock.',
          status: 'confirmed',
        }),
      ],
      expect.objectContaining({ onConflict: 'career_win_id,skill_name', ignoreDuplicates: true })
    )
  })

  it('creates a brand-new career_skills row directly at demonstrated, skipping claimed', async () => {
    const { client, skillsTable } = makeFakeClient()

    await confirmCapabilities(
      'u1',
      [{ careerWinId: 'win-1', skillName: 'People Development', source: 'system', inferenceReason: 'reason' }],
      client
    )

    expect(skillsTable).toEqual([{ user_id: 'u1', skill_name: 'People Development', state: 'demonstrated', evidence_note: null }])
  })

  it('upgrades an existing claimed skill to demonstrated', async () => {
    const { client, skillsTable } = makeFakeClient({
      initialSkills: [{ user_id: 'u1', skill_name: 'Inventory Management', state: 'claimed' }],
    })

    await confirmCapabilities(
      'u1',
      [{ careerWinId: 'win-1', skillName: 'Inventory Management', source: 'system', inferenceReason: 'reason' }],
      client
    )

    expect(skillsTable[0].state).toBe('demonstrated')
  })

  it('never downgrades a skill already at supported (atomic WHERE-guarded update, not a stale read)', async () => {
    const { client, skillsTable } = makeFakeClient({
      initialSkills: [{ user_id: 'u1', skill_name: 'Leadership', state: 'supported' }],
    })

    await confirmCapabilities(
      'u1',
      [{ careerWinId: 'win-1', skillName: 'Leadership', source: 'system', inferenceReason: 'reason' }],
      client
    )

    expect(skillsTable[0].state).toBe('supported')
  })

  it('never downgrades a skill already at demonstrated (idempotent re-confirmation)', async () => {
    const { client, skillsTable } = makeFakeClient({
      initialSkills: [{ user_id: 'u1', skill_name: 'Leadership', state: 'demonstrated' }],
    })

    await confirmCapabilities(
      'u1',
      [{ careerWinId: 'win-1', skillName: 'Leadership', source: 'system', inferenceReason: 'reason' }],
      client
    )

    expect(skillsTable[0].state).toBe('demonstrated')
  })

  it('handles a multi-item batch, upgrading each distinct skill independently', async () => {
    const { client, skillsTable } = makeFakeClient({
      initialSkills: [{ user_id: 'u1', skill_name: 'Leadership', state: 'supported' }],
    })

    await confirmCapabilities(
      'u1',
      [
        { careerWinId: 'win-1', skillName: 'Leadership', source: 'system', inferenceReason: 'r1' },
        { careerWinId: 'win-1', skillName: 'Inventory Management', source: 'system', inferenceReason: 'r2' },
      ],
      client
    )

    const byName = Object.fromEntries(skillsTable.map((s) => [s.skill_name, s.state]))
    expect(byName['Leadership']).toBe('supported')
    expect(byName['Inventory Management']).toBe('demonstrated')
  })

  it('dedupes duplicate (careerWinId, skillName) pairs within one call before upserting', async () => {
    const { client, capUpsertMock } = makeFakeClient()

    await confirmCapabilities(
      'u1',
      [
        { careerWinId: 'win-1', skillName: 'Leadership', source: 'system', inferenceReason: 'r1' },
        { careerWinId: 'win-1', skillName: 'Leadership', source: 'system', inferenceReason: 'r1 duplicate' },
      ],
      client
    )

    expect(capUpsertMock).toHaveBeenCalledTimes(1)
    expect(capUpsertMock.mock.calls[0][0]).toHaveLength(1)
  })

  it('is idempotent across repeat calls (fix round 2): resubmitting an already-persisted pair does not error and still attempts the skill upgrade', async () => {
    const { client, capabilitiesTable, skillsTable } = makeFakeClient({
      existingCapabilities: [{ career_win_id: 'win-1', skill_name: 'Leadership', status: 'confirmed' }],
    })

    const { error } = await confirmCapabilities(
      'u1',
      [{ careerWinId: 'win-1', skillName: 'Leadership', source: 'system', inferenceReason: 'resubmit' }],
      client
    )

    expect(error).toBeNull()
    expect(capabilitiesTable).toHaveLength(1)
    expect(skillsTable[0].state).toBe('demonstrated')
  })

  it('upgrades a skill even when a concurrent writer created it at claimed between the insert and update steps (fix round 2: closes the reordering gap)', async () => {
    // Models: our own upsert's ON CONFLICT DO NOTHING no-ops because a
    // concurrent syncSkillsFromProfile-style writer already created the row
    // at 'claimed' first. The guarded UPDATE that runs right after must
    // still catch and fix it -- this is exactly what the insert-then-update
    // ordering guarantees regardless of which statement "wins" the race.
    const { client, skillsTable } = makeFakeClient({
      initialSkills: [{ user_id: 'u1', skill_name: 'Widget Ops', state: 'claimed' }],
    })

    await confirmCapabilities(
      'u1',
      [{ careerWinId: 'win-1', skillName: 'Widget Ops', source: 'system', inferenceReason: 'reason' }],
      client
    )

    expect(skillsTable[0].state).toBe('demonstrated')
  })

  it("attempts every input's skill upgrade even if an earlier one errors, and aggregates the errors", async () => {
    const { client } = makeFakeClient({ updateError: 'connection reset' })

    const { error } = await confirmCapabilities(
      'u1',
      [
        { careerWinId: 'win-1', skillName: 'Leadership', source: 'system', inferenceReason: 'r1' },
        { careerWinId: 'win-1', skillName: 'Inventory Management', source: 'system', inferenceReason: 'r2' },
      ],
      client
    )

    expect(error).toContain('Leadership')
    expect(error).toContain('Inventory Management')
  })

  it('does nothing and makes no calls when given an empty input list', async () => {
    const { client, capUpsertMock } = makeFakeClient()
    const { capabilities, error } = await confirmCapabilities('u1', [], client)
    expect(capabilities).toEqual([])
    expect(error).toBeNull()
    expect(capUpsertMock).not.toHaveBeenCalled()
  })
})

describe('getCapabilitiesForCareerWin', () => {
  it('returns only confirmed capabilities for the given win', async () => {
    const rows = [{ id: 'cap-1', status: 'confirmed' }]
    const { client, capSelectEqWin, capSelectEqStatus } = makeFakeClient({ selectRows: rows })
    const { capabilities, error } = await getCapabilitiesForCareerWin('win-1', client)
    expect(error).toBeNull()
    expect(capabilities).toEqual(rows)
    expect(capSelectEqWin).toHaveBeenCalledWith('career_win_id', 'win-1')
    expect(capSelectEqStatus).toHaveBeenCalledWith('status', 'confirmed')
  })
})
