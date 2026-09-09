import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { importResumeDocument } from './importResumeDocument'
import { resetProposalIdCounter } from '@/lib/resumeIntelligence/parsing/fieldExtractors/helpers'
import type { DocumentExtractor, ExtractedDocument } from '@/lib/resumeIntelligence/parsing/types'
import type { ResumeFieldMapper } from '@/types/resume'

const REALISTIC_RESUME = [
  'Jamie Rivera',
  'jamie@example.com',
  '555-123-4567',
  'Denver, CO',
  'Summary',
  'Product leader focused on measurable outcomes.',
  'Experience',
  'Senior Product Manager, Initech Corp, 2021 - Present',
  'Grew revenue by 30%.',
  'Education',
  'State University',
  'B.A. Economics, 2015',
].join('\n')

interface FakeClientOptions {
  memberDocument?: { id: string; user_id: string; file_path: string; mime_type: string; storage_bucket: string } | null
  documentSelectError?: { message: string } | null
  downloadBlob?: Blob | null
  downloadError?: { message: string } | null
  attemptId?: string
  insertProposalsError?: { message: string } | null
  priorPendingProposalIds?: string[]
}

function makeFakeClient(opts: FakeClientOptions = {}) {
  const {
    memberDocument = { id: 'doc-1', user_id: 'user-1', file_path: 'user-1/resume.txt', mime_type: 'text/plain', storage_bucket: 'member-documents' },
    documentSelectError = null,
    downloadBlob = new Blob([REALISTIC_RESUME], { type: 'text/plain' }),
    downloadError = null,
    attemptId = 'attempt-1',
    insertProposalsError = null,
  } = opts

  const insertProposalsMock = vi.fn().mockResolvedValue({ error: insertProposalsError })
  const supersedeEqStatusMock = vi.fn().mockResolvedValue({ error: null })
  const supersedeEqDocMock = vi.fn().mockReturnValue({ eq: supersedeEqStatusMock })
  const supersedeUpdateMock = vi.fn().mockReturnValue({ eq: supersedeEqDocMock })

  const attemptUpdateEqMock = vi.fn().mockResolvedValue({ error: null })
  const attemptUpdateMock = vi.fn().mockReturnValue({ eq: attemptUpdateEqMock })

  const attemptInsertSingleMock = vi.fn().mockResolvedValue({ data: { id: attemptId }, error: null })
  const attemptInsertSelectMock = vi.fn().mockReturnValue({ single: attemptInsertSingleMock })
  const attemptInsertMock = vi.fn().mockReturnValue({ select: attemptInsertSelectMock })

  const docMaybeSingleMock = vi.fn().mockResolvedValue({ data: memberDocument, error: documentSelectError })
  const docEqMock = vi.fn().mockReturnValue({ maybeSingle: docMaybeSingleMock })
  const docSelectMock = vi.fn().mockReturnValue({ eq: docEqMock })

  const fromMock = vi.fn((table: string) => {
    if (table === 'member_documents') return { select: docSelectMock }
    if (table === 'resume_import_attempts') return { insert: attemptInsertMock, update: attemptUpdateMock }
    if (table === 'resume_field_proposals') return { insert: insertProposalsMock, update: supersedeUpdateMock }
    throw new Error(`unexpected table in test: ${table}`)
  })

  const downloadMock = vi.fn().mockResolvedValue({ data: downloadBlob, error: downloadError })
  const storageFromMock = vi.fn().mockReturnValue({ download: downloadMock })

  const client = { from: fromMock, storage: { from: storageFromMock } } as unknown as SupabaseClient

  return {
    client,
    fromMock,
    docSelectMock,
    attemptInsertMock,
    attemptUpdateMock,
    insertProposalsMock,
    supersedeUpdateMock,
    downloadMock,
    storageFromMock,
  }
}

describe('importResumeDocument', () => {
  beforeEach(() => resetProposalIdCounter())

  it('reports missing_source_document when the member_documents row cannot be found', async () => {
    const { client } = makeFakeClient({ memberDocument: null })
    const result = await importResumeDocument('user-1', 'doc-missing', client)
    expect(result).toEqual({ attemptId: null, status: { kind: 'missing_source_document' } })
  })

  it('records an import attempt and reports unsupported_format for an unrecognized mime type', async () => {
    const { client, attemptUpdateMock } = makeFakeClient({
      memberDocument: { id: 'doc-1', user_id: 'user-1', file_path: 'x', mime_type: 'image/png', storage_bucket: 'member-documents' },
    })
    const result = await importResumeDocument('user-1', 'doc-1', client)
    expect(result.attemptId).toBe('attempt-1')
    expect(result.status).toEqual({ kind: 'unsupported_format', mimeType: 'image/png' })
    expect(attemptUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'unsupported_format' }),
    )
  })

  it('reports extraction_failed when the storage download fails', async () => {
    const { client } = makeFakeClient({ downloadBlob: null, downloadError: { message: 'object not found' } })
    const result = await importResumeDocument('user-1', 'doc-1', client)
    expect(result.status).toMatchObject({ kind: 'extraction_failed' })
  })

  it('reports extraction_failed for corrupt bytes the extractor cannot parse', async () => {
    const { client } = makeFakeClient({
      memberDocument: { id: 'doc-1', user_id: 'user-1', file_path: 'x', mime_type: 'application/pdf', storage_bucket: 'member-documents' },
      downloadBlob: new Blob(['not a real pdf'], { type: 'application/pdf' }),
    })
    const result = await importResumeDocument('user-1', 'doc-1', client)
    expect(result.status).toMatchObject({ kind: 'extraction_failed' })
  })

  it('reports no_content_found when extraction succeeds but yields zero proposals', async () => {
    const { client } = makeFakeClient({ downloadBlob: new Blob(['   \n  \n '], { type: 'text/plain' }) })
    const result = await importResumeDocument('user-1', 'doc-1', client)
    expect(result.status).toEqual({ kind: 'no_content_found' })
  })

  it('reports parsing_failed when section detection/field mapping throws unexpectedly', async () => {
    const { client } = makeFakeClient()
    const throwingMapper: ResumeFieldMapper = { map: () => { throw new Error('boom') } }
    const result = await importResumeDocument('user-1', 'doc-1', client, { fieldMapper: throwingMapper })
    expect(result.status).toMatchObject({ kind: 'parsing_failed' })
  })

  it('succeeds end to end through the real extractor/detector/mapper pipeline and persists proposals under the new attempt', async () => {
    const { client, insertProposalsMock, attemptUpdateMock } = makeFakeClient()
    const result = await importResumeDocument('user-1', 'doc-1', client)

    expect(result.attemptId).toBe('attempt-1')
    expect(result.status.kind).toBe('succeeded')
    if (result.status.kind !== 'succeeded') throw new Error('expected succeeded')
    expect(result.status.proposalCount).toBeGreaterThan(0)

    const [insertedRows] = insertProposalsMock.mock.calls[0] as [Record<string, unknown>[]]
    expect(insertedRows.length).toBe(result.status.proposalCount)
    expect(insertedRows.every((r) => r.import_attempt_id === 'attempt-1')).toBe(true)
    expect(insertedRows.every((r) => r.source_document_id === 'doc-1')).toBe(true)
    expect(insertedRows.every((r) => r.user_id === 'user-1')).toBe(true)
    expect(insertedRows.some((r) => r.destination_field === 'full_name')).toBe(true)

    expect(attemptUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'succeeded', proposal_count: result.status.proposalCount }),
    )
  })

  it('reports partial when the extractor produced warnings alongside proposals', async () => {
    const fakeExtractor: DocumentExtractor = {
      supportedMimeTypes: ['text/plain'],
      extract: async (): Promise<ExtractedDocument> => ({
        sourceMimeType: 'text/plain',
        fullText: 'Jamie Rivera\njamie@example.com',
        blocks: [
          { order: 0, kind: 'line', text: 'Jamie Rivera', page: 1, position: null, styleHint: null },
          { order: 1, kind: 'line', text: 'jamie@example.com', page: 1, position: null, styleHint: null },
        ],
        warnings: [{ code: 'LOW_CONFIDENCE_LAYOUT', message: 'could not confidently detect columns' }],
      }),
    }
    const { client } = makeFakeClient()
    const result = await importResumeDocument('user-1', 'doc-1', client, { extractors: [fakeExtractor] })
    expect(result.status).toMatchObject({ kind: 'partial' })
    if (result.status.kind !== 'partial') throw new Error('expected partial')
    expect(result.status.warnings).toHaveLength(1)
  })

  it('supersedes prior pending proposals for the same document on a retry, scoped by status', async () => {
    const { client, supersedeUpdateMock } = makeFakeClient()
    await importResumeDocument('user-1', 'doc-1', client)
    expect(supersedeUpdateMock).toHaveBeenCalledWith(expect.objectContaining({ superseded_at: expect.any(String) }))
  })

  it('never calls resume_field_proposals.insert or update when the source document cannot be found', async () => {
    const { client, insertProposalsMock, supersedeUpdateMock } = makeFakeClient({ memberDocument: null })
    await importResumeDocument('user-1', 'doc-missing', client)
    expect(insertProposalsMock).not.toHaveBeenCalled()
    expect(supersedeUpdateMock).not.toHaveBeenCalled()
  })
})
