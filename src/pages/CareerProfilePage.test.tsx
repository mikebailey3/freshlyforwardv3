import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CareerProfilePage } from './CareerProfilePage'

const { baseProfile, mockRefreshProfile } = vi.hoisted(() => {
  const baseProfile = {
    user_id: 'user-1', full_name: 'Jordan Rivera', headline: 'Product Manager',
    location: 'Austin, TX', phone: null, linkedin_url: null, portfolio_url: null as string | null, summary: null,
    employment_history: [{ title: 'Senior PM', company: 'Acme Co', start_date: '2020', end_date: null, current: true, description: '' }],
    education: [], certifications: [], skills: ['SQL', 'Roadmapping'],
    preferred_jobs: [], jobs_to_avoid: [], preferred_industries: [],
    salary_min: null, salary_max: null, preferred_benefits: [],
    schedule_preference: null, max_commute_minutes: null, remote_preference: null,
    willing_to_relocate: false, travel_willingness: null, work_style: null,
    career_goals: null, strengths: null, weaknesses: null, motivators: null, biggest_challenge: null,
    application_authorized: false, electronic_consent: false,
    search_readiness_score: 40,
  }
  return { baseProfile, mockRefreshProfile: vi.fn() }
})

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' }, profile: baseProfile, refreshProfile: mockRefreshProfile }),
}))

vi.mock('@/lib/profile', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/profile')>()
  return { ...actual, ensureProfile: vi.fn().mockResolvedValue(baseProfile) }
})

vi.mock('@/lib/supabase', () => {
  // Generic chainable, thenable query-builder double: every method
  // (select/eq/order/etc.) just returns itself, and it resolves to an
  // empty result when awaited. Needed because this page also renders
  // the real MemberLayout + useEntitlements, each of which builds its
  // own differently-shaped Supabase query chain -- a rigid single-shape
  // mock breaks the moment any of those chains don't match it exactly.
  const builder: Record<string, unknown> = {}
  const chain = () => builder
  builder.select = chain
  builder.eq = chain
  builder.order = chain
  builder.limit = chain
  builder.maybeSingle = () => Promise.resolve({ data: null, error: null })
  builder.then = (resolve: (value: { data: unknown; count: number; error: null }) => void) =>
    resolve({ data: [], count: 0, error: null })
  return { supabase: { from: () => builder } }
})

// ProfileEditForm and the sidebar widgets are separately-owned components
// with their own concerns (data-entry validation, avatar upload, readiness
// scoring) -- stubbed here so this file stays focused on CareerProfilePage's
// own job: loading/display wiring and the view<->edit-mode toggle.
vi.mock('@/components/ProfileEditForm', () => ({
  ProfileEditForm: ({ onCancel }: { onCancel: () => void }) => (
    <div>
      <p>Stub Edit Form</p>
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}))
vi.mock('@/components/ProfileCard', () => ({ ProfileCard: () => <div>Stub Sidebar Profile Card</div> }))
vi.mock('@/components/ForwardProfileVisibilitySettings', () => ({ ForwardProfileVisibilitySettings: () => <div>Stub Forward Profile Visibility</div> }))
vi.mock('@/components/SearchReadinessWidget', () => ({ SearchReadinessWidget: () => <div>Stub Search Readiness</div> }))

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/profile']}>
      <CareerProfilePage />
    </MemoryRouter>,
  )
}

describe('CareerProfilePage', () => {
  it('renders the read-only view with populated Career Snapshot and Employment History data', async () => {
    renderPage()

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Career Profile' })).toBeInTheDocument())
    expect(screen.getAllByText('Jordan Rivera').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Product Manager')).toBeInTheDocument()
    expect(screen.getByText('Senior PM')).toBeInTheDocument()
    expect(screen.getByText('Acme Co')).toBeInTheDocument()
    expect(screen.getByText('SQL')).toBeInTheDocument()
  })

  it('shows "Not provided yet" for empty fields rather than blank', async () => {
    renderPage()

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Career Profile' })).toBeInTheDocument())
    expect(screen.getAllByText('Not provided yet').length).toBeGreaterThan(0)
  })

  it('switches into edit mode when Edit Profile is clicked, and back when cancelled', async () => {
    renderPage()

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Career Profile' })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /Edit Profile/i }))

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Edit Career Profile' })).toBeInTheDocument())
    expect(screen.getByText('Stub Edit Form')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Career Profile' })).toBeInTheDocument())
  })

  describe('ProfileField link safety (security regression)', () => {
    afterEach(() => {
      baseProfile.portfolio_url = null
    })

    it('never renders an unsafe javascript: URL as a clickable href, but still shows the raw text', async () => {
      baseProfile.portfolio_url = 'javascript:alert(1)'
      renderPage()

      await waitFor(() => expect(screen.getByRole('heading', { name: 'Career Profile' })).toBeInTheDocument())
      expect(screen.getByText('javascript:alert(1)')).toBeInTheDocument()
      const maliciousLink = screen.queryAllByRole('link').find((a) => a.getAttribute('href')?.startsWith('javascript:'))
      expect(maliciousLink).toBeUndefined()
    })

    it('renders a normal https portfolio URL as a real clickable link', async () => {
      baseProfile.portfolio_url = 'https://jordan.example.com'
      renderPage()

      await waitFor(() => expect(screen.getByRole('heading', { name: 'Career Profile' })).toBeInTheDocument())
      const link = screen.getByRole('link', { name: 'https://jordan.example.com' })
      expect(link).toHaveAttribute('href', 'https://jordan.example.com')
    })
  })
})
