import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CareerGoalsCard } from './CareerGoalsCard'
import type { MemberProfile } from '@/types'

const baseProfile = { career_goals: 'Become a VP', target_role: null, target_timeframe: null } as MemberProfile

describe('CareerGoalsCard', () => {
  it('shows the existing free-text career goal and calls onSaveTargets with new field values', () => {
    const onSaveTargets = vi.fn().mockResolvedValue(undefined)
    render(
      <MemoryRouter>
        <CareerGoalsCard profile={baseProfile} onSaveTargets={onSaveTargets} />
      </MemoryRouter>
    )
    expect(screen.getByText(/Become a VP/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Target role'), { target: { value: 'VP of Operations' } })
    fireEvent.change(screen.getByLabelText('Target timeframe'), { target: { value: 'within 12 months' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSaveTargets).toHaveBeenCalledWith('VP of Operations', 'within 12 months')
  })
})
