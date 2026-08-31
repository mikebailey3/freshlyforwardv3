// src/pages/ForwardDnaPage.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ForwardDnaPage } from './ForwardDnaPage'
import { ensureEmploymentEntryIdsForUser } from '@/lib/forwardDna/employmentEntryIds'
import { upsertScope } from '@/lib/forwardDna/scope'

// Kept as stable, hoisted references (not a fresh object literal per call):
// ForwardDnaPage's load effect depends on `[user]`, and MemberLayout's own
// effect depends on `[user, profile?.plan_id]`. A mock that returns a new
// `user`/`profile` object on every call would make those deps look changed
// on every re-render, re-firing the effects (and re-consuming any
// `mockResolvedValueOnce` queued for a CRUD call) even though nothing about
// auth actually changed -- exactly what a real AuthContext would never do.
const { mockAuthUser, mockAuthProfile, mockRefreshProfile } = vi.hoisted(() => ({
  mockAuthUser: { id: 'u1' },
  mockAuthProfile: { employment_history: [], education: [], certifications: [], skills: [], target_role: null, target_timeframe: null, career_goals: null },
  mockRefreshProfile: vi.fn(),
}))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: mockAuthUser,
    profile: mockAuthProfile,
    refreshProfile: mockRefreshProfile,
  }),
}))

vi.mock('@/lib/profile', () => ({
  ensureProfile: vi.fn().mockResolvedValue({ employment_history: [], education: [], certifications: [], skills: [], target_role: null, target_timeframe: null, career_goals: null }),
}))

vi.mock('@/lib/forwardDna/employmentEntryIds', () => ({
  ensureEmploymentEntryIdsForUser: vi.fn().mockResolvedValue({ entries: [], error: null }),
}))

vi.mock('@/lib/forwardDna/scope', () => ({
  getAllScopeForUser: vi.fn().mockResolvedValue({ scope: [], error: null }),
  upsertScope: vi.fn().mockResolvedValue({ error: null }),
  dollarsToCents: (v: string) => (v ? Number(v) * 100 : null),
  centsToDollars: (c: number | null) => (c == null ? '' : String(c / 100)),
}))

vi.mock('@/lib/forwardDna/responsibilities', () => ({
  getAllResponsibilitiesForUser: vi.fn().mockResolvedValue({ responsibilities: [], error: null }),
  addResponsibility: vi.fn().mockResolvedValue({ error: null }),
  removeResponsibility: vi.fn().mockResolvedValue({ error: null }),
}))

vi.mock('@/lib/forwardDna/skills', () => ({
  getSkillStates: vi.fn().mockResolvedValue({ skills: [], error: null }),
  upsertSkillState: vi.fn().mockResolvedValue({ error: null }),
  syncSkillsFromProfile: vi.fn().mockResolvedValue({ error: null }),
}))

// MemberLayout (which ForwardDnaPage wraps its content in) independently
// fires its own Supabase queries via useEntitlements/useBadges plus inline
// unread-count lookups, each with a different chain shape (.order(), bare
// .then(), .maybeSingle()). A narrow single-shape mock isn't enough here --
// this reuses the proven chainable+thenable query-builder double from
// DashboardPage.test.tsx so every caller's chain resolves regardless of
// shape.
const { maybeSingleMock } = vi.hoisted(() => ({
  maybeSingleMock: vi.fn().mockResolvedValue({ data: null, error: null }),
}))

function makeBuilder() {
  const result = { data: null, error: null }
  const builder: Record<string, unknown> = {}
  const chain = () => builder
  builder.select = chain
  builder.eq = chain
  builder.order = chain
  builder.gte = chain
  builder.limit = chain
  builder.update = chain
  builder.maybeSingle = maybeSingleMock
  builder.then = (resolve: (value: typeof result) => void) => resolve(result)
  return builder
}

vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn().mockImplementation(() => makeBuilder()) },
}))

describe('ForwardDnaPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders the page title and every section once data loads', async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: null })
    render(
      <MemoryRouter>
        <ForwardDnaPage />
      </MemoryRouter>
    )
    await waitFor(() => expect(screen.getByText('Forward DNA')).toBeInTheDocument())
    expect(screen.getByText('Professional Scope')).toBeInTheDocument()
    expect(screen.getByText('Responsibilities')).toBeInTheDocument()
    expect(screen.getByText('Skills')).toBeInTheDocument()
    expect(screen.getByText('Career Goals')).toBeInTheDocument()
    expect(screen.getByText('Forward DNA Completeness')).toBeInTheDocument()
  })

  it('updates the local profile state (and the completeness display) after a successful Career Goals save -- Finding 1', async () => {
    render(
      <MemoryRouter>
        <ForwardDnaPage />
      </MemoryRouter>
    )
    await waitFor(() => expect(screen.getByText('Forward DNA')).toBeInTheDocument())

    // Before saving, the page's own local `profile` state has no target
    // role/timeframe, so completeness lists it as missing.
    expect(screen.getByText('Career goal target role and timeframe')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Target role'), { target: { value: 'VP of Operations' } })
    fireEvent.change(screen.getByLabelText('Target timeframe'), { target: { value: 'within 12 months' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    // Regression check for Finding 1: previously the page only called
    // refreshProfile() (which updates AuthContext, not this page's own
    // `profile` state), so this item would still show as missing after a
    // successful save. It must now update the local state directly and
    // clear from the missing list without a page reload.
    await waitFor(() =>
      expect(screen.queryByText('Career goal target role and timeframe')).not.toBeInTheDocument()
    )
  })

  it('shows an inline error banner and does not update local state when a CRUD save call fails -- Finding 2', async () => {
    vi.mocked(ensureEmploymentEntryIdsForUser).mockResolvedValueOnce({
      entries: [
        { id: 'e1', company: 'Acme', title: 'Ops Manager', start_date: '2020-01', end_date: null, current: true, description: '' },
      ],
      error: null,
    })
    vi.mocked(upsertScope).mockResolvedValueOnce({ error: 'boom' })

    render(
      <MemoryRouter>
        <ForwardDnaPage />
      </MemoryRouter>
    )
    // Both CareerScopeCard and ResponsibilitiesCard render an identical
    // "{title} — {company}" row header for the same entry, so this text
    // legitimately appears twice once entries load.
    await waitFor(() => expect(screen.getAllByText('Ops Manager — Acme').length).toBeGreaterThan(0))

    // The first "Save" button belongs to CareerScopeCard's row for the one
    // employment entry above (CareerScopeCard renders before CareerGoalsCard).
    fireEvent.click(screen.getAllByRole('button', { name: 'Save' })[0])

    await waitFor(() =>
      expect(screen.getByText('Could not save your professional scope. Please try again.')).toBeInTheDocument()
    )
  })
})
