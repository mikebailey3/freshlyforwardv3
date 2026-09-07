import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AddCareerWinModal } from './AddCareerWinModal'

vi.mock('@/lib/careerVault/careerWins', () => ({ createCareerWin: vi.fn() }))
vi.mock('@/lib/careerVault/capabilities', () => ({ confirmCapabilities: vi.fn() }))

import { createCareerWin } from '@/lib/careerVault/careerWins'
import { confirmCapabilities } from '@/lib/careerVault/capabilities'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('AddCareerWinModal', () => {
  it('disables Continue until a statement is entered', () => {
    render(<AddCareerWinModal userId="u1" employmentEntries={[]} onClose={() => {}} onSaved={() => {}} />)
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled()
    fireEvent.change(screen.getByLabelText(/what happened/i), { target: { value: 'Reduced inventory loss by $31,000.' } })
    expect(screen.getByRole('button', { name: /continue/i })).not.toBeDisabled()
  })

  it('shows the detected metric and pre-checked capability suggestions after Continue', async () => {
    render(<AddCareerWinModal userId="u1" employmentEntries={[]} onClose={() => {}} onSaved={() => {}} />)
    fireEvent.change(screen.getByLabelText(/what happened/i), { target: { value: 'Reduced inventory loss by $31,000.' } })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))

    expect(await screen.findByText('$31,000')).toBeInTheDocument()
    const inventoryCheckbox = screen.getByLabelText('Inventory Management') as HTMLInputElement
    expect(inventoryCheckbox.checked).toBe(true)
  })

  it('excludes an unchecked suggestion from confirmCapabilities on Save', async () => {
    vi.mocked(createCareerWin).mockResolvedValue({ careerWin: { id: 'win-1' } as never, error: null })
    vi.mocked(confirmCapabilities).mockResolvedValue({ capabilities: [], error: null })
    const onSaved = vi.fn()

    render(<AddCareerWinModal userId="u1" employmentEntries={[]} onClose={() => {}} onSaved={onSaved} />)
    fireEvent.change(screen.getByLabelText(/what happened/i), { target: { value: 'Reduced inventory loss by $31,000.' } })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    await screen.findByText('$31,000')

    fireEvent.click(screen.getByLabelText('Inventory Management'))
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    const confirmedNames = vi.mocked(confirmCapabilities).mock.calls[0][1].map((c) => c.skillName)
    expect(confirmedNames).not.toContain('Inventory Management')
    expect(confirmedNames).toContain('Financial Performance')
  })

  it('calls onClose when Cancel is clicked on the input screen', () => {
    const onClose = vi.fn()
    render(<AddCareerWinModal userId="u1" employmentEntries={[]} onClose={onClose} onSaved={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when Escape is pressed (fix round 1: WCAG dialog keyboard support)', () => {
    const onClose = vi.fn()
    render(<AddCareerWinModal userId="u1" employmentEntries={[]} onClose={onClose} onSaved={() => {}} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('shows an error and does not call onSaved when createCareerWin fails (fix round 1: previously untested branch)', async () => {
    vi.mocked(createCareerWin).mockResolvedValue({ careerWin: null, error: 'network error' })
    const onSaved = vi.fn()

    render(<AddCareerWinModal userId="u1" employmentEntries={[]} onClose={() => {}} onSaved={onSaved} />)
    fireEvent.change(screen.getByLabelText(/what happened/i), { target: { value: 'Reduced inventory loss by $31,000.' } })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    await screen.findByText('$31,000')
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    expect(await screen.findByText('network error')).toBeInTheDocument()
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('surfaces a partial-failure message and does not call onSaved when confirmCapabilities errors (fix round 1: previously silently discarded)', async () => {
    vi.mocked(createCareerWin).mockResolvedValue({ careerWin: { id: 'win-1' } as never, error: null })
    vi.mocked(confirmCapabilities).mockResolvedValue({ capabilities: [], error: 'connection reset' })
    const onSaved = vi.fn()

    render(<AddCareerWinModal userId="u1" employmentEntries={[]} onClose={() => {}} onSaved={onSaved} />)
    fireEvent.change(screen.getByLabelText(/what happened/i), { target: { value: 'Reduced inventory loss by $31,000.' } })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    await screen.findByText('$31,000')
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(screen.getByText(/could not be confirmed/i)).toBeInTheDocument())
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('retries only confirmCapabilities (not createCareerWin) on a second Save click after a confirmCapabilities failure (fix round 2: previously created a duplicate career_wins row)', async () => {
    vi.mocked(createCareerWin).mockResolvedValue({ careerWin: { id: 'win-1' } as never, error: null })
    vi.mocked(confirmCapabilities)
      .mockResolvedValueOnce({ capabilities: [], error: 'connection reset' })
      .mockResolvedValueOnce({ capabilities: [{ id: 'cap-1' } as never], error: null })
    const onSaved = vi.fn()

    render(<AddCareerWinModal userId="u1" employmentEntries={[]} onClose={() => {}} onSaved={onSaved} />)
    fireEvent.change(screen.getByLabelText(/what happened/i), { target: { value: 'Reduced inventory loss by $31,000.' } })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    await screen.findByText('$31,000')

    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() => expect(screen.getByText(/could not be confirmed/i)).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith({ id: 'win-1' }))

    expect(createCareerWin).toHaveBeenCalledTimes(1)
    expect(confirmCapabilities).toHaveBeenCalledTimes(2)
  })

  it('does not close on Escape while a save is in flight (fix round 2: matches the Cancel button\'s disabled-while-saving guard)', async () => {
    vi.mocked(createCareerWin).mockImplementation(() => new Promise(() => {})) // never resolves
    const onClose = vi.fn()

    render(<AddCareerWinModal userId="u1" employmentEntries={[]} onClose={onClose} onSaved={() => {}} />)
    fireEvent.change(screen.getByLabelText(/what happened/i), { target: { value: 'Reduced inventory loss by $31,000.' } })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    await screen.findByText('$31,000')
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('disables the header Close (X) button while a save is in flight, matching Cancel and Escape (fix round 5: the X button was the only close affordance NOT guarded by saving -- closing it early orphaned the pending createCareerWin/confirmCapabilities chain, which could still land and mutate state well after the member had moved on to a completely different action)', async () => {
    vi.mocked(createCareerWin).mockImplementation(() => new Promise(() => {})) // never resolves
    const onClose = vi.fn()

    render(<AddCareerWinModal userId="u1" employmentEntries={[]} onClose={onClose} onSaved={() => {}} />)
    fireEvent.change(screen.getByLabelText(/what happened/i), { target: { value: 'Reduced inventory loss by $31,000.' } })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    await screen.findByText('$31,000')
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    const closeButton = screen.getByRole('button', { name: /^close$/i })
    expect(closeButton).toBeDisabled()
    fireEvent.click(closeButton)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('locks the metric checkbox and role select once the win is saved, so a retry cannot silently discard an edit the win-scoped fields no longer apply to (fix round 3)', async () => {
    vi.mocked(createCareerWin).mockResolvedValue({ careerWin: { id: 'win-1' } as never, error: null })
    vi.mocked(confirmCapabilities).mockResolvedValue({ capabilities: [], error: 'connection reset' })

    render(
      <AddCareerWinModal
        userId="u1"
        employmentEntries={[{ id: 'e1', title: 'Manager', company: 'Acme', start_date: '2020-01-01', end_date: null, current: true, description: '' }]}
        onClose={() => {}}
        onSaved={() => {}}
      />
    )
    fireEvent.change(screen.getByLabelText(/what happened/i), { target: { value: 'Reduced inventory loss by $31,000.' } })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    await screen.findByText('$31,000')
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(screen.getByText(/could not be confirmed/i)).toBeInTheDocument())

    expect(screen.getByLabelText(/include this metric/i)).toBeDisabled()
    expect(screen.getByLabelText(/role/i)).toBeDisabled()
  })

  it('locks suggestion checkboxes (but not the add-new-capability input) once the win is saved (fix round 4: same silent-discard shape as round 3, applied to the suggestion checklist)', async () => {
    vi.mocked(createCareerWin).mockResolvedValue({ careerWin: { id: 'win-1' } as never, error: null })
    vi.mocked(confirmCapabilities)
      .mockResolvedValueOnce({ capabilities: [], error: 'upgrade loop failed' })
      .mockResolvedValueOnce({ capabilities: [{ id: 'cap-1' } as never], error: null })

    render(<AddCareerWinModal userId="u1" employmentEntries={[]} onClose={() => {}} onSaved={() => {}} />)
    fireEvent.change(screen.getByLabelText(/what happened/i), { target: { value: 'Reduced inventory loss by $31,000.' } })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    await screen.findByText('$31,000')
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(screen.getByText(/could not be confirmed/i)).toBeInTheDocument())

    expect(screen.getByLabelText('Inventory Management')).toBeDisabled()

    // Adding a brand-new capability after the failure is still fine (an
    // upsert-only addition can never conflict with what's already there),
    // and the retry should still confirm both the original and the new one.
    fireEvent.change(screen.getByLabelText(/add another capability/i), { target: { value: 'New Skill' } })
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(confirmCapabilities).toHaveBeenCalledTimes(2))
    const secondCallPayload = vi.mocked(confirmCapabilities).mock.calls[1][1]
    expect(secondCallPayload.map((c) => c.skillName)).toContain('New Skill')
  })
})
