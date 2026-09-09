import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createTailoredResumeVersion } from './createTailoredResumeVersion'

function makeFakeClient(
  opts: {
    source?: { id: string; template_key: string; section_order: unknown; summary_override: string | null } | null
    linkError?: { message: string } | null
  } = {},
) {
  const { source = { id: 'v-1', template_key: 'modern', section_order: null, summary_override: null }, linkError = null } = opts

  const sourceMaybeSingleMock = vi.fn().mockResolvedValue({ data: source, error: null })
  const sourceEqArchivedMock = vi.fn().mockReturnValue({ maybeSingle: sourceMaybeSingleMock })
  const sourceEqMemberMock = vi.fn().mockReturnValue({ eq: sourceEqArchivedMock })
  const sourceEqIdMock = vi.fn().mockReturnValue({ eq: sourceEqMemberMock })
  const sourceSelectMock = vi.fn().mockReturnValue({ eq: sourceEqIdMock })

  const entriesEqMock = vi.fn().mockResolvedValue({ data: [], error: null })
  const entriesSelectMock = vi.fn().mockReturnValue({ eq: entriesEqMock })
  const entriesInsertMock = vi.fn().mockResolvedValue({ error: null })

  const versionSingleMock = vi.fn().mockResolvedValue({ data: { id: 'v-tailored' }, error: null })
  const versionInsertSelectMock = vi.fn().mockReturnValue({ single: versionSingleMock })
  const versionInsertMock = vi.fn().mockReturnValue({ select: versionInsertSelectMock })

  const linkEqMock = vi.fn().mockResolvedValue({ error: linkError })
  const linkUpdateMock = vi.fn().mockReturnValue({ eq: linkEqMock })

  const fromMock = vi.fn((table: string) => {
    if (table === 'resume_versions') return { select: sourceSelectMock, insert: versionInsertMock, update: linkUpdateMock }
    if (table === 'resume_entries') return { select: entriesSelectMock, insert: entriesInsertMock }
    throw new Error(`unexpected table: ${table}`)
  })

  return { client: { from: fromMock } as unknown as SupabaseClient, linkUpdateMock }
}

describe('createTailoredResumeVersion', () => {
  it('creates a derived version and stamps target_opportunity_id, without ever touching the source version', async () => {
    const { client, linkUpdateMock } = makeFakeClient()
    const result = await createTailoredResumeVersion('user-1', 'v-1', 'opp-1', 'Tailored for Acme', client)
    expect(result.error).toBeNull()
    expect(result.newResumeVersionId).toBe('v-tailored')
    expect(linkUpdateMock).toHaveBeenCalledWith({ target_opportunity_id: 'opp-1' })
  })

  it('propagates a duplication error without attempting the opportunity link', async () => {
    const { client, linkUpdateMock } = makeFakeClient({ source: null })
    const result = await createTailoredResumeVersion('user-1', 'v-1', 'opp-1', 'Tailored', client)
    expect(result.error).toContain('not found')
    expect(linkUpdateMock).not.toHaveBeenCalled()
  })

  it('surfaces an error if linking the opportunity fails, while still reporting the created version id', async () => {
    const { client } = makeFakeClient({ linkError: { message: 'link failed' } })
    const result = await createTailoredResumeVersion('user-1', 'v-1', 'opp-1', 'Tailored', client)
    expect(result.newResumeVersionId).toBe('v-tailored')
    expect(result.error).toBe('link failed')
  })
})
