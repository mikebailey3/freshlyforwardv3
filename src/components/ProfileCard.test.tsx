import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ProfileCard } from './ProfileCard'
import type { MemberProfile } from '@/types'

const { mockEq, mockUpdate } = vi.hoisted(() => ({
  mockEq: vi.fn(),
  mockUpdate: vi.fn(),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({ update: mockUpdate }),
    storage: { from: () => ({ upload: vi.fn(), getPublicUrl: vi.fn() }) },
  },
}))

function profile(overrides: Partial<MemberProfile> = {}): MemberProfile {
  return {
    user_id: 'user-1',
    full_name: 'Jordan Rivera',
    username: null,
    avatar_url: null,
    subscription_status: 'active',
    ...overrides,
  } as MemberProfile
}

describe('ProfileCard username editing', () => {
  const onUpdated = vi.fn()

  beforeEach(() => {
    mockUpdate.mockReset()
    mockEq.mockReset()
    mockEq.mockResolvedValue({ error: null })
    mockUpdate.mockReturnValue({ eq: mockEq })
    onUpdated.mockReset()
  })

  it('rejects a reserved username without calling supabase (new: reserved-username guard for Forward Profiles)', async () => {
    render(<ProfileCard userId="user-1" profile={profile()} onUpdated={onUpdated} />)
    fireEvent.click(screen.getByText('Set a username'))

    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'admin' } })
    fireEvent.click(screen.getByLabelText('Save username'))

    await waitFor(() => expect(screen.getByText(/reserved/i)).toBeInTheDocument())
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('saves a valid, non-reserved username', async () => {
    render(<ProfileCard userId="user-1" profile={profile()} onUpdated={onUpdated} />)
    fireEvent.click(screen.getByText('Set a username'))

    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'jordan_rivera' } })
    fireEvent.click(screen.getByLabelText('Save username'))

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith({ username: 'jordan_rivera' }))
    expect(onUpdated).toHaveBeenCalled()
  })

  it('still rejects an invalid-pattern username before ever checking the reserved list', async () => {
    render(<ProfileCard userId="user-1" profile={profile()} onUpdated={onUpdated} />)
    fireEvent.click(screen.getByText('Set a username'))

    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'ab' } })
    fireEvent.click(screen.getByLabelText('Save username'))

    await waitFor(() => expect(screen.getByText(/3-20 characters/i)).toBeInTheDocument())
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})
