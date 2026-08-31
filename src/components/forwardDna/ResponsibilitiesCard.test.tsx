import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ResponsibilitiesCard } from './ResponsibilitiesCard'

const entries = [{ id: 'e1', company: 'Acme', title: 'Ops Manager', start_date: '2020-01', end_date: null, current: true, description: '' }]

describe('ResponsibilitiesCard', () => {
  it('renders existing tags and calls onAdd for a new one', () => {
    const onAdd = vi.fn().mockResolvedValue(undefined)
    render(
      <ResponsibilitiesCard
        entries={entries}
        responsibilities={[{ id: 'r1', user_id: 'u1', employment_entry_id: 'e1', tag: 'Managed budget', category: null, created_at: '' }]}
        onAdd={onAdd}
        onRemove={vi.fn()}
      />
    )
    expect(screen.getByText('Managed budget')).toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText('Add a responsibility'), { target: { value: 'Hired staff' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(onAdd).toHaveBeenCalledWith('e1', 'Hired staff')
  })

  it('calls onRemove when a tag is removed', () => {
    const onRemove = vi.fn()
    render(
      <ResponsibilitiesCard
        entries={entries}
        responsibilities={[{ id: 'r1', user_id: 'u1', employment_entry_id: 'e1', tag: 'Managed budget', category: null, created_at: '' }]}
        onAdd={vi.fn()}
        onRemove={onRemove}
      />
    )
    fireEvent.click(screen.getByLabelText('Remove Managed budget'))
    expect(onRemove).toHaveBeenCalledWith('r1')
  })
})
