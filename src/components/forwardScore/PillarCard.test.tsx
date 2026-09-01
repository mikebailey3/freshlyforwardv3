import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { PillarCard } from './PillarCard'
import type { ForwardScorePillarResult } from '@/types/forwardScore'

const basePillar: ForwardScorePillarResult = {
  key: 'evidenceQuality',
  label: 'Evidence Quality',
  score: 60,
  weight: 0.3,
  explanation: '3 of 5 skills are backed by demonstrated or supported evidence; the rest are only claimed.',
  improvementLink: { label: 'Strengthen your skill evidence', to: '/forward-dna' },
}

function renderCard(pillar: ForwardScorePillarResult) {
  render(
    <MemoryRouter>
      <PillarCard pillar={pillar} />
    </MemoryRouter>
  )
}

describe('PillarCard', () => {
  it('renders a real Link with the correct to/label when improvementLink is non-null', () => {
    renderCard(basePillar)

    expect(screen.getByText('Evidence Quality')).toBeInTheDocument()
    expect(screen.getByText('60')).toBeInTheDocument()
    expect(screen.getByText(basePillar.explanation)).toBeInTheDocument()

    const link = screen.getByRole('link', { name: 'Strengthen your skill evidence' })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/forward-dna')
  })

  it('renders no link element at all when improvementLink is null', () => {
    renderCard({ ...basePillar, improvementLink: null })

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
