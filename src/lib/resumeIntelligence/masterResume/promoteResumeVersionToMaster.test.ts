import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { promoteResumeVersionToMaster } from './promoteResumeVersionToMaster'

function makeFakeClient(rpcError: { message: string } | null = null) {
  const rpcMock = vi.fn().mockResolvedValue({ error: rpcError })
  return { client: { rpc: rpcMock } as unknown as SupabaseClient, rpcMock }
}

describe('promoteResumeVersionToMaster', () => {
  it('calls the atomic set_master_resume_version RPC with the target version id', async () => {
    const { client, rpcMock } = makeFakeClient()
    const result = await promoteResumeVersionToMaster('version-2', client)
    expect(rpcMock).toHaveBeenCalledWith('set_master_resume_version', { p_new_master_id: 'version-2' })
    expect(result.error).toBeNull()
  })

  it('surfaces an RPC failure (e.g. not authorized, or the version is archived) as a reported error', async () => {
    const { client } = makeFakeClient({ message: 'not authorized to modify this resume version' })
    const result = await promoteResumeVersionToMaster('version-2', client)
    expect(result.error).toBe('not authorized to modify this resume version')
  })
})
