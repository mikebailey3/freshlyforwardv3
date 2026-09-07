import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CareerVaultPage } from './CareerVaultPage'
import { getCareerWinsWithCapabilities, deleteCareerWin, createCareerWin } from '@/lib/careerVault/careerWins'
import { confirmCapabilities } from '@/lib/careerVault/capabilities'

const { mockAuthUser } = vi.hoisted(() => ({ mockAuthUser: { id: 'u1' } }))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: mockAuthUser, profile: null, refreshProfile: vi.fn() }),
}))

vi.mock('@/lib/profile', () => ({
  ensureProfile: vi.fn().mockResolvedValue({ employment_history: [] }),
}))

vi.mock('@/lib/forwardDna/employmentEntryIds', () => ({
  ensureEmploymentEntryIdsForUser: vi.fn().mockResolvedValue({ entries: [], error: null }),
}))

vi.mock('@/lib/careerVault/careerWins', () => ({
  getCareerWinsWithCapabilities: vi.fn(),
  deleteCareerWin: vi.fn(),
  // AddCareerWinModal (rendered for real, not mocked, in the "reset both
  // errors on next successful load" regression test below) calls this
  // directly -- needs a resolved value or that test's Save click throws.
  createCareerWin: vi.fn(),
}))

// Same reason as createCareerWin above -- AddCareerWinModal calls this on Save.
vi.mock('@/lib/careerVault/capabilities', () => ({
  confirmCapabilities: vi.fn(),
}))

// MemberLayout independently fires its own Supabase queries (entitlements,
// badges, unread counts) with mixed chain shapes -- reuse the proven
// chainable+thenable double from ForwardDnaPage.test.tsx / DashboardPage.test.tsx.
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

describe('CareerVaultPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows an empty state when there are no Career Wins yet', async () => {
    vi.mocked(getCareerWinsWithCapabilities).mockResolvedValue({ careerWins: [], error: null })
    render(<MemoryRouter><CareerVaultPage /></MemoryRouter>)
    await waitFor(() => expect(screen.getByText('Career Vault')).toBeInTheDocument())
    expect(screen.getByText(/No Career Wins yet/)).toBeInTheDocument()
  })

  it('renders a CareerWinCard for each returned Career Win', async () => {
    vi.mocked(getCareerWinsWithCapabilities).mockResolvedValue({
      careerWins: [{ id: 'win-1', original_statement: 'Reduced inventory loss by $31,000.', capabilities: [], metric_raw: null, category: null } as never],
      error: null,
    })
    render(<MemoryRouter><CareerVaultPage /></MemoryRouter>)
    await waitFor(() => expect(screen.getByText('Reduced inventory loss by $31,000.')).toBeInTheDocument())
  })

  it('opens AddCareerWinModal when "Add Career Win" is clicked', async () => {
    vi.mocked(getCareerWinsWithCapabilities).mockResolvedValue({ careerWins: [], error: null })
    render(<MemoryRouter><CareerVaultPage /></MemoryRouter>)
    await waitFor(() => expect(screen.getByText('Career Vault')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /add career win/i }))
    expect(screen.getByText('Add a Career Win')).toBeInTheDocument()
  })

  it("calls deleteCareerWin and reloads when a card's delete button is clicked and the confirmation is accepted", async () => {
    vi.mocked(getCareerWinsWithCapabilities).mockResolvedValue({
      careerWins: [{ id: 'win-1', original_statement: 'Reduced inventory loss by $31,000.', capabilities: [], metric_raw: null, category: null } as never],
      error: null,
    })
    vi.mocked(deleteCareerWin).mockResolvedValue({ error: null })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<MemoryRouter><CareerVaultPage /></MemoryRouter>)
    await waitFor(() => expect(screen.getByText('Reduced inventory loss by $31,000.')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /delete career win/i }))
    await waitFor(() => expect(deleteCareerWin).toHaveBeenCalledWith('win-1'))
  })

  it('does not call deleteCareerWin when the confirmation is declined (fix round 1: irreversible-delete guard, matching the BlogManagementPage convention)', async () => {
    vi.mocked(getCareerWinsWithCapabilities).mockResolvedValue({
      careerWins: [{ id: 'win-1', original_statement: 'Reduced inventory loss by $31,000.', capabilities: [], metric_raw: null, category: null } as never],
      error: null,
    })
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<MemoryRouter><CareerVaultPage /></MemoryRouter>)
    await waitFor(() => expect(screen.getByText('Reduced inventory loss by $31,000.')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /delete career win/i }))
    expect(deleteCareerWin).not.toHaveBeenCalled()
  })

  it('clears a stale actionError once a subsequent delete retry succeeds (this held even under round 1 -- see the NEXT test for the scenario round 2 actually needed to fix)', async () => {
    vi.mocked(getCareerWinsWithCapabilities).mockResolvedValue({
      careerWins: [{ id: 'win-1', original_statement: 'Reduced inventory loss by $31,000.', capabilities: [], metric_raw: null, category: null } as never],
      error: null,
    })
    vi.mocked(deleteCareerWin)
      .mockResolvedValueOnce({ error: 'db unavailable' })
      .mockResolvedValueOnce({ error: null })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<MemoryRouter><CareerVaultPage /></MemoryRouter>)
    await waitFor(() => expect(screen.getByText('Reduced inventory loss by $31,000.')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /delete career win/i }))
    await waitFor(() => expect(screen.getByText(/Couldn't delete that Career Win/)).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /delete career win/i }))
    await waitFor(() => expect(deleteCareerWin).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.queryByText(/Couldn't delete that Career Win/)).not.toBeInTheDocument())
  })

  it('clears a stale actionError when a DIFFERENT successful action reloads the page -- not just a delete retry (fix round 2: round 1 only reset actionError inside handleDelete itself, so this specific path -- an old failed-delete banner surviving a completely unrelated successful reload -- was still broken until the reset moved into load())', async () => {
    vi.mocked(getCareerWinsWithCapabilities).mockResolvedValue({
      careerWins: [{ id: 'win-1', original_statement: 'Reduced inventory loss by $31,000.', capabilities: [], metric_raw: null, category: null } as never],
      error: null,
    })
    vi.mocked(deleteCareerWin).mockResolvedValue({ error: 'db unavailable' })
    vi.mocked(createCareerWin).mockResolvedValue({
      careerWin: { id: 'win-2', original_statement: 'Cut onboarding time in half.' } as never,
      error: null,
    })
    vi.mocked(confirmCapabilities).mockResolvedValue({ capabilities: [], error: null })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<MemoryRouter><CareerVaultPage /></MemoryRouter>)
    await waitFor(() => expect(screen.getByText('Reduced inventory loss by $31,000.')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /delete career win/i }))
    await waitFor(() => expect(screen.getByText(/Couldn't delete that Career Win/)).toBeInTheDocument())

    // A completely different successful action -- adding a new win, not
    // retrying the failed delete -- should still clear the stale banner.
    fireEvent.click(screen.getByRole('button', { name: /add career win/i }))
    fireEvent.change(screen.getByLabelText(/what happened/i), { target: { value: 'Cut onboarding time in half.' } })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    fireEvent.click(await screen.findByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(screen.getByText('Cut onboarding time in half.')).toBeInTheDocument())
    expect(screen.queryByText(/Couldn't delete that Career Win/)).not.toBeInTheDocument()
  })

  it("ignores a second delete click while the first is still in flight (fix round 3: two overlapping deletes resolving out of order was a concrete sequence that could make loadError and actionError coexist despite round 2's fix)", async () => {
    vi.mocked(getCareerWinsWithCapabilities).mockResolvedValue({
      careerWins: [
        { id: 'win-1', original_statement: 'Reduced inventory loss by $31,000.', capabilities: [], metric_raw: null, category: null } as never,
        { id: 'win-2', original_statement: 'Cut onboarding time in half.', capabilities: [], metric_raw: null, category: null } as never,
      ],
      error: null,
    })
    let resolveFirstDelete: (value: { error: string | null }) => void = () => {}
    vi.mocked(deleteCareerWin).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFirstDelete = resolve
      })
    )
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<MemoryRouter><CareerVaultPage /></MemoryRouter>)
    await waitFor(() => expect(screen.getByText('Cut onboarding time in half.')).toBeInTheDocument())

    const deleteButtons = screen.getAllByRole('button', { name: /delete career win/i })
    fireEvent.click(deleteButtons[0])
    fireEvent.click(deleteButtons[1])

    // Still only the first call -- the second was ignored by the busy guard
    // rather than firing a second, overlapping request.
    expect(deleteCareerWin).toHaveBeenCalledTimes(1)

    resolveFirstDelete({ error: null })
    await waitFor(() => expect(getCareerWinsWithCapabilities).toHaveBeenCalledTimes(2))
    expect(deleteCareerWin).toHaveBeenCalledTimes(1)
  })

  it("removes every card's delete affordance while AddCareerWinModal is open (fix round 4: the busy lock only ever covered delete-vs-delete overlap -- clicking delete while the modal's OWN save was in flight was a separate, genuinely concurrent mutation the busy flag never saw, and was reachable by keyboard/AT past the modal's backdrop since it has no focus trap)", async () => {
    vi.mocked(getCareerWinsWithCapabilities).mockResolvedValue({
      careerWins: [{ id: 'win-1', original_statement: 'Reduced inventory loss by $31,000.', capabilities: [], metric_raw: null, category: null } as never],
      error: null,
    })
    render(<MemoryRouter><CareerVaultPage /></MemoryRouter>)
    await waitFor(() => expect(screen.getByText('Reduced inventory loss by $31,000.')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /delete career win/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /add career win/i }))
    expect(screen.queryByRole('button', { name: /delete career win/i })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
    expect(screen.getByRole('button', { name: /delete career win/i })).toBeInTheDocument()
  })

  it('shows an error and does not silently render an empty state when getCareerWinsWithCapabilities fails (fix round 1: previously indistinguishable from "no wins yet")', async () => {
    vi.mocked(getCareerWinsWithCapabilities).mockResolvedValue({ careerWins: [], error: 'network error' })
    render(<MemoryRouter><CareerVaultPage /></MemoryRouter>)
    await waitFor(() => expect(screen.getByText(/Couldn't load your Career Vault/)).toBeInTheDocument())
    expect(screen.queryByText(/No Career Wins yet/)).not.toBeInTheDocument()
  })

  it('clears a stale loadError once a subsequent load succeeds, rather than permanently hiding an otherwise-fine list (fix round 2: round 1 never reset loadError on the success branch, so one transient failure stuck forever)', async () => {
    vi.mocked(getCareerWinsWithCapabilities)
      .mockResolvedValueOnce({ careerWins: [], error: 'transient blip' })
      .mockResolvedValueOnce({
        careerWins: [{ id: 'win-2', original_statement: 'Cut onboarding time in half.', capabilities: [], metric_raw: null, category: null } as never],
        error: null,
      })
    vi.mocked(createCareerWin).mockResolvedValue({
      careerWin: { id: 'win-2', original_statement: 'Cut onboarding time in half.' } as never,
      error: null,
    })
    vi.mocked(confirmCapabilities).mockResolvedValue({ capabilities: [], error: null })

    render(<MemoryRouter><CareerVaultPage /></MemoryRouter>)
    await waitFor(() => expect(screen.getByText(/Couldn't load your Career Vault/)).toBeInTheDocument())

    // "Add Career Win" is rendered regardless of loadError -- it's the only
    // path back to a successful load() call without a full page refresh.
    fireEvent.click(screen.getByRole('button', { name: /add career win/i }))
    fireEvent.change(screen.getByLabelText(/what happened/i), { target: { value: 'Cut onboarding time in half.' } })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    fireEvent.click(await screen.findByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(screen.getByText('Cut onboarding time in half.')).toBeInTheDocument())
    expect(screen.queryByText(/Couldn't load your Career Vault/)).not.toBeInTheDocument()
  })
})
