import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ForwardProfileVisibilitySettings } from './ForwardProfileVisibilitySettings'
import { updatePublicProfileVisibility } from '@/lib/publicProfile'
import type { MemberProfile } from '@/types'

vi.mock('@/lib/publicProfile', () => ({
  updatePublicProfileVisibility: vi.fn(),
  isReservedUsername: vi.fn().mockReturnValue(false),
}))

function profile(overrides: Partial<MemberProfile> = {}): MemberProfile {
  return {
    user_id: 'user-1',
    username: 'jordan',
    public_profile_enabled: false,
    public_profile_sections: { summary: true, employment: true, education: true, certifications: true, skills: true, career_goals: false },
    ...overrides,
  } as MemberProfile
}

function renderComponent(p: MemberProfile, onUpdated: () => void) {
  return render(
    <MemoryRouter>
      <ForwardProfileVisibilitySettings profile={p} onUpdated={onUpdated} />
    </MemoryRouter>,
  )
}

describe('ForwardProfileVisibilitySettings', () => {
  const onUpdated = vi.fn()

  beforeEach(() => {
    vi.mocked(updatePublicProfileVisibility).mockReset()
    onUpdated.mockReset()
  })

  it('shows a prompt to set a username first when none exists, and disables the public toggle', () => {
    renderComponent(profile({ username: null }), onUpdated)

    expect(screen.getByText(/set a username/i)).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /make my forward profile public/i })).toBeDisabled()
  })

  it('shows the public URL and section toggles once a username exists', () => {
    renderComponent(profile(), onUpdated)

    expect(screen.getByText('/u/jordan')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /make my forward profile public/i })).not.toBeDisabled()
  })

  it('calls updatePublicProfileVisibility with the toggled enabled flag when the main switch is clicked', async () => {
    vi.mocked(updatePublicProfileVisibility).mockResolvedValue({ error: null })
    renderComponent(profile({ public_profile_enabled: false }), onUpdated)

    fireEvent.click(screen.getByRole('checkbox', { name: /make my forward profile public/i }))

    await waitFor(() => expect(updatePublicProfileVisibility).toHaveBeenCalledWith('user-1', {
      publicProfileEnabled: true,
      sections: { summary: true, employment: true, education: true, certifications: true, skills: true, career_goals: false },
    }))
    expect(onUpdated).toHaveBeenCalled()
  })

  it('toggles a single section without affecting the others', async () => {
    vi.mocked(updatePublicProfileVisibility).mockResolvedValue({ error: null })
    renderComponent(profile({ public_profile_enabled: true }), onUpdated)

    fireEvent.click(screen.getByRole('checkbox', { name: /skills/i }))

    await waitFor(() => expect(updatePublicProfileVisibility).toHaveBeenCalledWith('user-1', {
      publicProfileEnabled: true,
      sections: { summary: true, employment: true, education: true, certifications: true, skills: false, career_goals: false },
    }))
  })

  it('shows an error and does not call onUpdated when the save fails', async () => {
    vi.mocked(updatePublicProfileVisibility).mockResolvedValue({ error: 'db unavailable' })
    renderComponent(profile(), onUpdated)

    fireEvent.click(screen.getByRole('checkbox', { name: /make my forward profile public/i }))

    await waitFor(() => expect(screen.getByText(/could not save/i)).toBeInTheDocument())
    expect(onUpdated).not.toHaveBeenCalled()
  })

  it('renders a "Preview as public visitor" link pointing at the real /u/:username route when public', () => {
    renderComponent(profile({ public_profile_enabled: true }), onUpdated)

    const link = screen.getByRole('link', { name: /preview/i })
    expect(link).toHaveAttribute('href', '/u/jordan')
  })
})
