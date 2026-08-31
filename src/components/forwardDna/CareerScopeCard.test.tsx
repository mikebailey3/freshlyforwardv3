import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CareerScopeCard } from './CareerScopeCard'

const entries = [{ id: 'e1', company: 'Acme', title: 'Ops Manager', start_date: '2020-01', end_date: null, current: true, description: '' }]

describe('CareerScopeCard', () => {
  it('renders one row per employment entry and pre-fills existing scope', () => {
    render(
      <CareerScopeCard
        entries={entries}
        scope={[{ id: 's1', user_id: 'u1', employment_entry_id: 'e1', revenue_managed_cents: 150050, team_size: 5, budget_managed_cents: null, direct_reports: 2, notes: null, created_at: '', updated_at: '' }]}
        onSave={vi.fn()}
      />
    )
    expect(screen.getByText('Ops Manager — Acme')).toBeInTheDocument()
    expect(screen.getByDisplayValue('5')).toBeInTheDocument()
    expect(screen.getByDisplayValue('1500.5')).toBeInTheDocument()
  })

  it('calls onSave with parsed values when Save is clicked', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<CareerScopeCard entries={entries} scope={[]} onSave={onSave} />)
    fireEvent.change(screen.getByLabelText('Team size'), { target: { value: '10' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledWith('e1', expect.objectContaining({ team_size: 10 }))
  })
})
