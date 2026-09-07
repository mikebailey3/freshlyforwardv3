import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const { mockAddRoadmapMilestone } = vi.hoisted(() => ({ mockAddRoadmapMilestone: vi.fn() }))

vi.mock('@/lib/roadmap', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/roadmap')>()
  // Only the RPC-calling function is mocked -- dateInputValueToRoadmapEventDate
  // stays real so these tests prove the form wires the actual conversion
  // helper correctly, not a test-only stand-in for it.
  return { ...actual, addRoadmapMilestone: mockAddRoadmapMilestone }
})

import { AddRoadmapMilestoneForm } from './AddRoadmapMilestoneForm'

describe('AddRoadmapMilestoneForm', () => {
  beforeEach(() => {
    mockAddRoadmapMilestone.mockReset()
  })

  it('submits the title/description and calls onMilestoneAdded on success', async () => {
    const fakeMilestone = { id: 'm1', user_id: 'member-1', event_type: 'career_roadmap', event_title: 'Promotion review', event_description: 'Q1 check-in', event_date: '2026-01-01', metadata: {}, created_at: '2026-01-01' }
    mockAddRoadmapMilestone.mockResolvedValue({ milestone: fakeMilestone, error: null })
    const onMilestoneAdded = vi.fn()

    render(<AddRoadmapMilestoneForm memberId="member-1" onMilestoneAdded={onMilestoneAdded} />)

    fireEvent.click(screen.getByRole('button', { name: /add roadmap milestone/i }))
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Promotion review' } })
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'Q1 check-in' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(onMilestoneAdded).toHaveBeenCalledWith(fakeMilestone))
    expect(mockAddRoadmapMilestone).toHaveBeenCalledWith(
      expect.objectContaining({ memberId: 'member-1', title: 'Promotion review', description: 'Q1 check-in' }),
    )
    // A fresh idempotency key must be generated per submit attempt.
    const call = mockAddRoadmapMilestone.mock.calls[0][0]
    expect(typeof call.idempotencyKey).toBe('string')
    expect(call.idempotencyKey.length).toBeGreaterThan(0)
  })

  it('shows an inline error and does not call onMilestoneAdded when the write fails', async () => {
    mockAddRoadmapMilestone.mockResolvedValue({ milestone: null, error: 'Not authorized to add a roadmap milestone for this member' })
    const onMilestoneAdded = vi.fn()

    render(<AddRoadmapMilestoneForm memberId="member-1" onMilestoneAdded={onMilestoneAdded} />)

    fireEvent.click(screen.getByRole('button', { name: /add roadmap milestone/i }))
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Should fail' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(screen.getByText('Not authorized to add a roadmap milestone for this member')).toBeInTheDocument())
    expect(onMilestoneAdded).not.toHaveBeenCalled()
  })

  it('disables the save button until a title is entered', () => {
    render(<AddRoadmapMilestoneForm memberId="member-1" onMilestoneAdded={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /add roadmap milestone/i }))

    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled()
  })

  it('reuses the SAME idempotency key when retrying a failed submit of the same draft (network-blip retry safety)', async () => {
    mockAddRoadmapMilestone.mockResolvedValueOnce({ milestone: null, error: 'Something went wrong saving this milestone.' })
    const fakeMilestone = { id: 'm2', user_id: 'member-1', event_type: 'career_roadmap', event_title: 'Promotion review', event_description: null, event_date: '2026-01-01', metadata: {}, created_at: '2026-01-01' }
    mockAddRoadmapMilestone.mockResolvedValueOnce({ milestone: fakeMilestone, error: null })
    const onMilestoneAdded = vi.fn()

    render(<AddRoadmapMilestoneForm memberId="member-1" onMilestoneAdded={onMilestoneAdded} />)

    fireEvent.click(screen.getByRole('button', { name: /add roadmap milestone/i }))
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Promotion review' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() => expect(mockAddRoadmapMilestone).toHaveBeenCalledTimes(1))

    // Same draft, retried after the first attempt's failure -- must reuse
    // the same key so the server can recognize this as a retry, not a new
    // milestone, if the first attempt actually landed despite the client
    // seeing an error.
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() => expect(onMilestoneAdded).toHaveBeenCalledWith(fakeMilestone))

    const firstKey = mockAddRoadmapMilestone.mock.calls[0][0].idempotencyKey
    const secondKey = mockAddRoadmapMilestone.mock.calls[1][0].idempotencyKey
    expect(firstKey).toBe(secondKey)
  })

  it('mints a fresh idempotency key for the next milestone after a successful save', async () => {
    const firstMilestone = { id: 'm1', user_id: 'member-1', event_type: 'career_roadmap', event_title: 'First milestone', event_description: null, event_date: '2026-01-01', metadata: {}, created_at: '2026-01-01' }
    const secondMilestone = { id: 'm2', user_id: 'member-1', event_type: 'career_roadmap', event_title: 'Second milestone', event_description: null, event_date: '2026-01-02', metadata: {}, created_at: '2026-01-02' }
    mockAddRoadmapMilestone.mockResolvedValueOnce({ milestone: firstMilestone, error: null })
    mockAddRoadmapMilestone.mockResolvedValueOnce({ milestone: secondMilestone, error: null })
    const onMilestoneAdded = vi.fn()

    render(<AddRoadmapMilestoneForm memberId="member-1" onMilestoneAdded={onMilestoneAdded} />)

    fireEvent.click(screen.getByRole('button', { name: /add roadmap milestone/i }))
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'First milestone' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() => expect(onMilestoneAdded).toHaveBeenCalledWith(firstMilestone))

    // A genuinely separate, second milestone -- the form re-opens fresh.
    fireEvent.click(screen.getByRole('button', { name: /add roadmap milestone/i }))
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Second milestone' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() => expect(onMilestoneAdded).toHaveBeenCalledWith(secondMilestone))

    const firstKey = mockAddRoadmapMilestone.mock.calls[0][0].idempotencyKey
    const secondKey = mockAddRoadmapMilestone.mock.calls[1][0].idempotencyKey
    expect(firstKey).not.toBe(secondKey)
  })

  it('mints a fresh idempotency key after Cancel discards a draft, not reusing the abandoned one', async () => {
    const fakeMilestone = { id: 'm3', user_id: 'member-1', event_type: 'career_roadmap', event_title: 'Kept milestone', event_description: null, event_date: '2026-01-03', metadata: {}, created_at: '2026-01-03' }
    mockAddRoadmapMilestone.mockResolvedValueOnce({ milestone: null, error: 'Something went wrong saving this milestone.' })
    mockAddRoadmapMilestone.mockResolvedValueOnce({ milestone: fakeMilestone, error: null })
    const onMilestoneAdded = vi.fn()

    render(<AddRoadmapMilestoneForm memberId="member-1" onMilestoneAdded={onMilestoneAdded} />)

    // Abandoned draft: fails once, then the user gives up and cancels.
    fireEvent.click(screen.getByRole('button', { name: /add roadmap milestone/i }))
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Abandoned draft' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() => expect(mockAddRoadmapMilestone).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))

    // A brand-new draft after Cancel must not reuse the abandoned key.
    fireEvent.click(screen.getByRole('button', { name: /add roadmap milestone/i }))
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Kept milestone' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() => expect(onMilestoneAdded).toHaveBeenCalledWith(fakeMilestone))

    const abandonedKey = mockAddRoadmapMilestone.mock.calls[0][0].idempotencyKey
    const newDraftKey = mockAddRoadmapMilestone.mock.calls[1][0].idempotencyKey
    expect(abandonedKey).not.toBe(newDraftKey)
  })

  it('shows an inline error instead of hanging when the RPC call throws rather than resolving with { error }', async () => {
    mockAddRoadmapMilestone.mockRejectedValue(new Error('network blip'))
    const onMilestoneAdded = vi.fn()

    render(<AddRoadmapMilestoneForm memberId="member-1" onMilestoneAdded={onMilestoneAdded} />)

    fireEvent.click(screen.getByRole('button', { name: /add roadmap milestone/i }))
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Should also fail' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(onMilestoneAdded).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /^save$/i })).not.toBeDisabled()
  })

  it('renders an optional target-date field', () => {
    render(<AddRoadmapMilestoneForm memberId="member-1" onMilestoneAdded={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /add roadmap milestone/i }))

    const dateInput = screen.getByLabelText(/target date/i)
    expect(dateInput).toHaveAttribute('type', 'date')
  })

  it('omits eventDate entirely when no target date is chosen', async () => {
    const fakeMilestone = { id: 'm1', user_id: 'member-1', event_type: 'career_roadmap', event_title: 'No date', event_description: null, event_date: '2026-01-01', metadata: {}, created_at: '2026-01-01' }
    mockAddRoadmapMilestone.mockResolvedValue({ milestone: fakeMilestone, error: null })

    render(<AddRoadmapMilestoneForm memberId="member-1" onMilestoneAdded={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /add roadmap milestone/i }))
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'No date' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(mockAddRoadmapMilestone).toHaveBeenCalled())
    expect(mockAddRoadmapMilestone.mock.calls[0][0].eventDate).toBeUndefined()
  })

  it('converts a chosen calendar date to a UTC-midnight-anchored ISO string, never shifting the day', async () => {
    const fakeMilestone = { id: 'm1', user_id: 'member-1', event_type: 'career_roadmap', event_title: 'Dated', event_description: null, event_date: '2026-06-01T00:00:00.000Z', metadata: {}, created_at: '2026-01-01' }
    mockAddRoadmapMilestone.mockResolvedValue({ milestone: fakeMilestone, error: null })

    render(<AddRoadmapMilestoneForm memberId="member-1" onMilestoneAdded={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /add roadmap milestone/i }))
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Dated' } })
    fireEvent.change(screen.getByLabelText(/target date/i), { target: { value: '2026-06-01' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(mockAddRoadmapMilestone).toHaveBeenCalled())
    expect(mockAddRoadmapMilestone.mock.calls[0][0].eventDate).toBe('2026-06-01T00:00:00.000Z')
  })

  it('clears the target date after a successful save, so the next milestone starts blank', async () => {
    const fakeMilestone = { id: 'm1', user_id: 'member-1', event_type: 'career_roadmap', event_title: 'Dated', event_description: null, event_date: '2026-06-01T00:00:00.000Z', metadata: {}, created_at: '2026-01-01' }
    mockAddRoadmapMilestone.mockResolvedValue({ milestone: fakeMilestone, error: null })

    render(<AddRoadmapMilestoneForm memberId="member-1" onMilestoneAdded={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /add roadmap milestone/i }))
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Dated' } })
    fireEvent.change(screen.getByLabelText(/target date/i), { target: { value: '2026-06-01' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() => expect(mockAddRoadmapMilestone).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByRole('button', { name: /add roadmap milestone/i }))
    expect(screen.getByLabelText(/target date/i)).toHaveValue('')
  })

  it('clears the target date after Cancel, so a new draft starts blank', () => {
    render(<AddRoadmapMilestoneForm memberId="member-1" onMilestoneAdded={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /add roadmap milestone/i }))
    fireEvent.change(screen.getByLabelText(/target date/i), { target: { value: '2026-06-01' } })
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))

    fireEvent.click(screen.getByRole('button', { name: /add roadmap milestone/i }))
    expect(screen.getByLabelText(/target date/i)).toHaveValue('')
  })

  it('shows an inline error rather than hanging if a malformed date value somehow reaches the save call', async () => {
    mockAddRoadmapMilestone.mockResolvedValue({ milestone: null, error: 'invalid input syntax for type timestamp with time zone' })

    render(<AddRoadmapMilestoneForm memberId="member-1" onMilestoneAdded={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /add roadmap milestone/i }))
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Bad date' } })
    // Native <input type="date"> enforces the YYYY-MM-DD format in every
    // real browser, but this simulates a value slipping through anyway
    // (e.g. a non-native fallback) to prove the form fails loud, not silent.
    fireEvent.change(screen.getByLabelText(/target date/i), { target: { value: 'not-a-real-date' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
  })
})
