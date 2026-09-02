import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { NextBestMoveCard } from './NextBestMoveCard'
import type { NextBestMove } from '@/types/forwardScore'

const move: NextBestMove = {
  key: 'add_career_win',
  headline: 'Add a Career Win to back up your skills',
  detail: 'Your skills need more demonstrated or supported evidence behind them -- a Career Win turns a claimed skill into proof.',
  cta: { label: 'Add a Career Win', to: '/forward-dna' },
}

describe('NextBestMoveCard', () => {
  it('renders the headline, detail, and a real Link with the correct to/label from cta', () => {
    render(
      <MemoryRouter>
        <NextBestMoveCard move={move} />
      </MemoryRouter>
    )

    expect(screen.getByText(move.headline)).toBeInTheDocument()
    expect(screen.getByText(move.detail)).toBeInTheDocument()

    const link = screen.getByRole('link', { name: move.cta.label })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', move.cta.to)
  })
})
