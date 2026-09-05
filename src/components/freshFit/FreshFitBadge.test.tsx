import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FreshFitBadge } from './FreshFitBadge'

describe('FreshFitBadge', () => {
  it('renders the score', () => {
    render(<FreshFitBadge score={82} />)
    expect(screen.getByText('FreshFit 82')).toBeInTheDocument()
  })

  it('applies the strong-tier style for a high score', () => {
    render(<FreshFitBadge score={90} />)
    expect(screen.getByText('FreshFit 90').className).toContain('success')
  })

  it('applies the weak-tier style for a low score', () => {
    render(<FreshFitBadge score={20} />)
    expect(screen.getByText('FreshFit 20').className).toContain('neutral')
  })
})
