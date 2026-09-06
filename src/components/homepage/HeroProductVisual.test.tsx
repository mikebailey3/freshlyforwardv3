import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { HeroProductVisual } from './HeroProductVisual'

describe('HeroProductVisual', () => {
  it('renders the FreshFit score centerpiece', () => {
    render(<HeroProductVisual />)
    expect(screen.getByText('82%')).toBeInTheDocument()
  })

  it('renders a sample-preview caption for screen readers and sighted users alike', () => {
    render(<HeroProductVisual />)
    expect(screen.getByText('Sample dashboard preview')).toBeInTheDocument()
  })

  it('renders the floating supporting cards', () => {
    render(<HeroProductVisual />)
    expect(screen.getByText('Top Opportunity')).toBeInTheDocument()
    expect(screen.getByText('Profile Strength')).toBeInTheDocument()
    expect(screen.getByText('Goal Progress')).toBeInTheDocument()
    expect(screen.getByText('Achievement Vault')).toBeInTheDocument()
  })
})
