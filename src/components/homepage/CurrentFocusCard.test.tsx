import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { CurrentFocusCard } from './CurrentFocusCard'

describe('CurrentFocusCard', () => {
  it('renders the focus title, evidence, progress, and CTA link', () => {
    render(
      <MemoryRouter>
        <CurrentFocusCard
          title="Strengthen your leadership accomplishments"
          evidence="Your target roles emphasize team performance and measurable results, but only 6 of your 13 accomplishments currently include metrics."
          progressLabel="2 of 3 complete"
          ctaLabel="Continue This Focus"
          ctaTo="/signup"
        />
      </MemoryRouter>
    )
    expect(screen.getByText('Strengthen your leadership accomplishments')).toBeInTheDocument()
    expect(screen.getByText(/only 6 of your 13 accomplishments/)).toBeInTheDocument()
    expect(screen.getByText('2 of 3 complete')).toBeInTheDocument()
    const cta = screen.getByRole('link', { name: /Continue This Focus/ })
    expect(cta).toHaveAttribute('href', '/signup')
  })
})
