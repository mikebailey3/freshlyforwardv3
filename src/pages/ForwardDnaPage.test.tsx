// src/pages/ForwardDnaPage.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ForwardDnaPage } from './ForwardDnaPage'

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1' },
    profile: { employment_history: [], education: [], certifications: [], skills: [], target_role: null, target_timeframe: null, career_goals: null },
    refreshProfile: vi.fn(),
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
})
