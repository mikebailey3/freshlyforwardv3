import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchResumeWorkflowSnapshot } from './fetchResumeWorkflowSnapshot'

interface FakeOpts {
  documents?: { id: string }[]
  master?: { id: string } | null
  importAttempts?: { id: string }[]
  proposals?: Record<string, unknown>[]
}

function makeFakeClient(opts: FakeOpts = {}) {
  const { documents = [], master = null, importAttempts = [], proposals = [] } = opts

  const docsFinalMock = vi.fn().mockResolvedValue({ data: documents, error: null })
  const docsEqTypeMock = vi.fn().mockReturnValue({ order: vi.fn().mockReturnValue({ limit: docsFinalMock }) })
  const docsEqUserMock = vi.fn().mockReturnValue({ eq: docsEqTypeMock })
  const docsSelectMock = vi.fn().mockReturnValue({ eq: docsEqUserMock })

  const masterMaybeSingleMock = vi.fn().mockResolvedValue({ data: master, error: null })
  const masterEqArchivedMock = vi.fn().mockReturnValue({ maybeSingle: masterMaybeSingleMock })
  const masterEqMasterMock = vi.fn().mockReturnValue({ eq: masterEqArchivedMock })
  const masterEqMemberMock = vi.fn().mockReturnValue({ eq: masterEqMasterMock })
  const masterSelectMock = vi.fn().mockReturnValue({ eq: masterEqMemberMock })

  const attemptsLimitMock = vi.fn().mockResolvedValue({ data: importAttempts, error: null })
  const attemptsEqMock = vi.fn().mockReturnValue({ limit: attemptsLimitMock })
  const attemptsSelectMock = vi.fn().mockReturnValue({ eq: attemptsEqMock })

  const proposalsOrderMock = vi.fn().mockResolvedValue({ data: proposals, error: null })
  const proposalsIsMock = vi.fn().mockReturnValue({ order: proposalsOrderMock })
  const proposalsEqDocMock = vi.fn().mockReturnValue({ is: proposalsIsMock })
  const proposalsEqUserMock = vi.fn().mockReturnValue({ eq: proposalsEqDocMock })
  const proposalsSelectMock = vi.fn().mockReturnValue({ eq: proposalsEqUserMock })

  const fromMock = vi.fn((table: string) => {
    if (table === 'member_documents') return { select: docsSelectMock }
    if (table === 'resume_versions') return { select: masterSelectMock }
    if (table === 'resume_import_attempts') return { select: attemptsSelectMock }
    if (table === 'resume_field_proposals') return { select: proposalsSelectMock }
    throw new Error(`unexpected table in test: ${table}`)
  })

  return { client: { from: fromMock } as unknown as SupabaseClient, fromMock }
}

describe('fetchResumeWorkflowSnapshot', () => {
  it('reports no document and no master when the member has neither', async () => {
    const { client } = makeFakeClient()
    const snapshot = await fetchResumeWorkflowSnapshot('user-1', client)
    expect(snapshot).toMatchObject({
      hasResumeDocument: false,
      hasImportAttempt: false,
      pendingProposalCount: 0,
      hasMaster: false,
      masterResumeVersionId: null,
      latestResumeDocumentId: null,
    })
  })

  it('reports the latest resume document, import attempt, and pending proposal count', async () => {
    const { client } = makeFakeClient({
      documents: [{ id: 'doc-1' }],
      importAttempts: [{ id: 'attempt-1' }],
      proposals: [
        { id: 'p1', status: 'pending' },
        { id: 'p2', status: 'reviewed' },
        { id: 'p3', status: 'pending' },
      ],
    })
    const snapshot = await fetchResumeWorkflowSnapshot('user-1', client)
    expect(snapshot.hasResumeDocument).toBe(true)
    expect(snapshot.latestResumeDocumentId).toBe('doc-1')
    expect(snapshot.hasImportAttempt).toBe(true)
    expect(snapshot.pendingProposalCount).toBe(2)
  })

  it('reports an active Master when one exists', async () => {
    const { client } = makeFakeClient({ master: { id: 'version-1' } })
    const snapshot = await fetchResumeWorkflowSnapshot('user-1', client)
    expect(snapshot.hasMaster).toBe(true)
    expect(snapshot.masterResumeVersionId).toBe('version-1')
  })

  it('never queries import attempts/proposals when there is no resume document yet', async () => {
    const { client, fromMock } = makeFakeClient()
    await fetchResumeWorkflowSnapshot('user-1', client)
    expect(fromMock).not.toHaveBeenCalledWith('resume_import_attempts')
    expect(fromMock).not.toHaveBeenCalledWith('resume_field_proposals')
  })
})
