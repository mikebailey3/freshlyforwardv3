import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MatchFilterBar } from './MatchFilterBar'
import { DEFAULT_FILTER_STATE } from '@/lib/opportunityEngineFilters'

describe('MatchFilterBar', () => {
  it('calls onChange with an updated locationText as the user types', () => {
    const onChange = vi.fn()
    render(<MatchFilterBar filters={DEFAULT_FILTER_STATE} onChange={onChange} />)

    fireEvent.change(screen.getByLabelText(/location/i), { target: { value: 'Austin' } })
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_FILTER_STATE, locationText: 'Austin' })
  })

  it('toggles remoteOnly when the Remote toggle is clicked', () => {
    const onChange = vi.fn()
    render(<MatchFilterBar filters={DEFAULT_FILTER_STATE} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: /remote/i }))
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_FILTER_STATE, remoteOnly: true })
  })

  it('toggles salaryListedOnly when the Salary listed toggle is clicked', () => {
    const onChange = vi.fn()
    render(<MatchFilterBar filters={DEFAULT_FILTER_STATE} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: /salary listed/i }))
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_FILTER_STATE, salaryListedOnly: true })
  })

  it('toggles newThisWeekOnly when the New this week toggle is clicked', () => {
    const onChange = vi.fn()
    render(<MatchFilterBar filters={DEFAULT_FILTER_STATE} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: /new this week/i }))
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_FILTER_STATE, newThisWeekOnly: true })
  })

  it('changes sortBy via the sort select', () => {
    const onChange = vi.fn()
    render(<MatchFilterBar filters={DEFAULT_FILTER_STATE} onChange={onChange} />)

    fireEvent.change(screen.getByLabelText(/sort/i), { target: { value: 'newest' } })
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_FILTER_STATE, sortBy: 'newest' })
  })

  it('changes minTier via the tier select', () => {
    const onChange = vi.fn()
    render(<MatchFilterBar filters={DEFAULT_FILTER_STATE} onChange={onChange} />)

    fireEvent.change(screen.getByLabelText(/show/i), { target: { value: 'highest' } })
    expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_FILTER_STATE, minTier: 'highest' })
  })
})
