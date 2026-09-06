import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FreshFitBadge } from './FreshFitBadge'

describe('FreshFitBadge', () => {
  it('shows the score and the Strong Match label for a high score', () => {
    render(<FreshFitBadge score={86} />)
    expect(screen.getByText(/86/)).toBeInTheDocument()
    expect(screen.getByText(/Strong Match/)).toBeInTheDocument()
  })

  it('shows the Fair Match label for a mid score', () => {
    render(<FreshFitBadge score={45} />)
    expect(screen.getByText(/Fair Match/)).toBeInTheDocument()
  })
})
