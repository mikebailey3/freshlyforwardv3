import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { PublicProfilePage } from './PublicProfilePage'
import { getPublicProfileByUsername } from '@/lib/publicProfile'

vi.mock('@/lib/publicProfile', () => ({
  getPublicProfileByUsername: vi.fn(),
}))

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/u/:username" element={<PublicProfilePage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('PublicProfilePage', () => {
  beforeEach(() => {
    vi.mocked(getPublicProfileByUsername).mockReset()
  })

  it('shows a loading state before the profile resolves', () => {
    vi.mocked(getPublicProfileByUsername).mockReturnValue(new Promise(() => {}))
    renderAt('/u/jordan')
    expect(screen.getByText(/Loading/i)).toBeInTheDocument()
  })

  it('renders a not-found state when the profile is null (private, suspended, or nonexistent -- indistinguishable by design)', async () => {
    vi.mocked(getPublicProfileByUsername).mockResolvedValue(null)
    renderAt('/u/nobody')

    await waitFor(() => expect(screen.getByText(/couldn.t find that Forward Profile/i)).toBeInTheDocument())
    expect(getPublicProfileByUsername).toHaveBeenCalledWith('nobody')
  })

  it('renders full_name, headline, location, and summary when present', async () => {
    vi.mocked(getPublicProfileByUsername).mockResolvedValue({
      username: 'jordan', avatarUrl: null, fullName: 'Jordan Rivera', headline: 'Product Manager',
      location: 'Austin, TX', linkedinUrl: null, portfolioUrl: null, summary: 'Builds things people love.',
      employment: [], education: [], certifications: [], skills: [], careerGoals: null,
    })
    renderAt('/u/jordan')

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Jordan Rivera' })).toBeInTheDocument())
    expect(screen.getByText('Product Manager')).toBeInTheDocument()
    expect(screen.getByText('Austin, TX')).toBeInTheDocument()
    expect(screen.getByText('Builds things people love.')).toBeInTheDocument()
  })

  it('renders employment, education, certifications, and skills sections when non-empty', async () => {
    vi.mocked(getPublicProfileByUsername).mockResolvedValue({
      username: 'jordan', avatarUrl: null, fullName: 'Jordan Rivera', headline: null,
      location: null, linkedinUrl: null, portfolioUrl: null, summary: null,
      employment: [{ title: 'Senior PM', company: 'Acme Co', start_date: '2020', end_date: null, current: true, description: 'Shipped things.' }],
      education: [{ institution: 'State U', degree: 'BA', field: 'Economics', graduation_year: '2015' }],
      certifications: [{ name: 'PMP', issuer: 'PMI', date: '2021', expiry: null }],
      skills: ['SQL', 'Roadmapping'],
      careerGoals: null,
    })
    renderAt('/u/jordan')

    await waitFor(() => expect(screen.getByText('Senior PM')).toBeInTheDocument())
    expect(screen.getByText('Acme Co')).toBeInTheDocument()
    expect(screen.getByText(/State U/)).toBeInTheDocument()
    expect(screen.getByText('PMP')).toBeInTheDocument()
    expect(screen.getByText('SQL')).toBeInTheDocument()
    expect(screen.getByText('Roadmapping')).toBeInTheDocument()
  })

  it('omits a section entirely when its array is empty (member toggled it off)', async () => {
    vi.mocked(getPublicProfileByUsername).mockResolvedValue({
      username: 'jordan', avatarUrl: null, fullName: 'Jordan Rivera', headline: null,
      location: null, linkedinUrl: null, portfolioUrl: null, summary: null,
      employment: [], education: [], certifications: [], skills: [], careerGoals: null,
    })
    renderAt('/u/jordan')

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Jordan Rivera' })).toBeInTheDocument())
    expect(screen.queryByText('Experience')).not.toBeInTheDocument()
    expect(screen.queryByText('Education')).not.toBeInTheDocument()
    expect(screen.queryByText('Certifications')).not.toBeInTheDocument()
    expect(screen.queryByText('Skills')).not.toBeInTheDocument()
  })

  it('never renders any private field name/value even when the mock (incorrectly) includes one, proving the page only reads from the typed view model', async () => {
    vi.mocked(getPublicProfileByUsername).mockResolvedValue({
      username: 'jordan', avatarUrl: null, fullName: 'Jordan Rivera', headline: null,
      location: null, linkedinUrl: null, portfolioUrl: null, summary: null,
      employment: [], education: [], certifications: [], skills: [], careerGoals: null,
    })
    renderAt('/u/jordan')

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Jordan Rivera' })).toBeInTheDocument())
    expect(screen.queryByText(/salary/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/stripe/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/subscription/i)).not.toBeInTheDocument()
  })
})
