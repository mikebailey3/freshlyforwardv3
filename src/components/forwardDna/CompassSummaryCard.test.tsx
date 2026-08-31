import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CompassSummaryCard } from './CompassSummaryCard'

describe('CompassSummaryCard', () => {
  it('shows the primary archetype and barrier when a result exists', () => {
    render(
      <MemoryRouter>
        <CompassSummaryCard result={{ primary_archetype: 'driver', primary_barrier: 'resume_positioning' }} />
      </MemoryRouter>
    )
    expect(screen.getByText('Driver')).toBeInTheDocument()
    expect(screen.getByText(/resume_positioning/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View full results' })).toHaveAttribute('href', '/career-compass/results')
  })

  it('shows a call-to-action when no result exists yet', () => {
    render(
      <MemoryRouter>
        <CompassSummaryCard result={null} />
      </MemoryRouter>
    )
    expect(screen.getByRole('link', { name: 'Take the free assessment' })).toHaveAttribute('href', '/career-compass')
  })
})
