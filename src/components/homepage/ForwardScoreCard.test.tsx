import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ForwardScoreCard } from './ForwardScoreCard'

describe('ForwardScoreCard', () => {
  it('renders the score and delta', () => {
    render(<ForwardScoreCard score={78} delta="+6 this month" />)
    expect(screen.getByText('78')).toBeInTheDocument()
    expect(screen.getByText('+6 this month')).toBeInTheDocument()
    expect(screen.getByText('Forward Score')).toBeInTheDocument()
  })
})
