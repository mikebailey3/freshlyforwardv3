import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProfileStrengthCard } from './ProfileStrengthCard'

describe('ProfileStrengthCard', () => {
  it('renders the name, headline, and forward score', () => {
    render(<ProfileStrengthCard name="Jordan R." headline="Product Marketing Manager" strength={91} forwardScore={78} />)
    expect(screen.getByText('Jordan R.')).toBeInTheDocument()
    expect(screen.getByText('Product Marketing Manager')).toBeInTheDocument()
    expect(screen.getByText('78')).toBeInTheDocument()
  })

  it('labels itself as a sample', () => {
    render(<ProfileStrengthCard name="Jordan R." headline="Product Marketing Manager" strength={91} forwardScore={78} />)
    expect(screen.getByText('Sample')).toBeInTheDocument()
  })
})
