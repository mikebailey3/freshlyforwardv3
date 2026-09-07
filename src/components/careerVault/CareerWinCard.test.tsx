import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CareerWinCard } from './CareerWinCard'
import type { CareerWinWithCapabilities } from '@/lib/careerVault/careerWins'

const win: CareerWinWithCapabilities = {
  id: 'win-1',
  user_id: 'u1',
  employment_entry_id: null,
  original_statement: 'Reduced inventory loss by $31,000.',
  evidence_type: 'accomplishment',
  category: 'Financial / Operational Impact',
  metric_type: 'currency',
  metric_value: 31000,
  metric_raw: '$31,000',
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
  capabilities: [
    {
      id: 'cap-1',
      career_win_id: 'win-1',
      user_id: 'u1',
      skill_name: 'Inventory Management',
      suggested_state: 'demonstrated',
      source: 'system',
      inference_reason: 'Statement mentions inventory or stock.',
      status: 'confirmed',
      decided_at: '2026-09-01T00:00:00Z',
      created_at: '2026-09-01T00:00:00Z',
    },
  ],
}

describe('CareerWinCard', () => {
  it('renders the original statement, metric, category, and confirmed capabilities', () => {
    render(<CareerWinCard careerWin={win} />)
    expect(screen.getByText('Reduced inventory loss by $31,000.')).toBeInTheDocument()
    expect(screen.getByText(/Metric:\s*\$31,000/)).toBeInTheDocument()
    expect(screen.getByText(/Financial \/ Operational Impact/)).toBeInTheDocument()
    expect(screen.getByText('Inventory Management')).toBeInTheDocument()
  })

  it('renders no delete affordance when onDelete is not provided (read-only, strategist-safe default)', () => {
    render(<CareerWinCard careerWin={win} />)
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument()
  })

  it('renders a delete button and calls onDelete when provided (member-only usage)', () => {
    const onDelete = vi.fn()
    render(<CareerWinCard careerWin={win} onDelete={onDelete} />)
    const deleteButton = screen.getByRole('button', { name: /delete/i })
    deleteButton.click()
    expect(onDelete).toHaveBeenCalled()
  })

  it("includes the win's statement in the delete button's label so multiple cards in a list are distinguishable to screen-reader users (carried forward from Task 8 review, fixed at Task 9 integration)", () => {
    render(<CareerWinCard careerWin={win} onDelete={() => {}} />)
    expect(screen.getByRole('button', { name: /Delete Career Win: Reduced inventory loss by \$31,000\./ })).toBeInTheDocument()
  })

  it('truncates a very long statement in the delete button label rather than producing an unwieldy accessible name', () => {
    const longWin = { ...win, original_statement: 'A'.repeat(200) }
    render(<CareerWinCard careerWin={longWin} onDelete={() => {}} />)
    const button = screen.getByRole('button', { name: /Delete Career Win:/ })
    expect(button.getAttribute('aria-label')?.length).toBeLessThan(100)
  })

  it('exposes a capability\'s inference reason via a focusable, screen-reader-reachable element, not just a hover-only title attribute (fix round 1: WCAG 2.2 AA)', () => {
    render(<CareerWinCard careerWin={win} />)
    const capabilityButton = screen.getByRole('button', { name: /Inventory Management/i })
    expect(capabilityButton).toHaveAccessibleDescription(/Statement mentions inventory or stock/)
  })

  it('renders gracefully with no metric, no category, and no capabilities', () => {
    const minimalWin: CareerWinWithCapabilities = {
      ...win,
      metric_type: null,
      metric_value: null,
      metric_raw: null,
      category: null,
      capabilities: [],
    }
    render(<CareerWinCard careerWin={minimalWin} />)
    expect(screen.getByText('Reduced inventory loss by $31,000.')).toBeInTheDocument()
    expect(screen.queryByText(/Metric:/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Category:/)).not.toBeInTheDocument()
  })
})
