import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ForwardScoreWidget } from './ForwardScoreWidget'
import type { ForwardScoreResult } from '@/types/forwardScore'

const result: ForwardScoreResult = {
  total: 72,
  pillars: [
    {
      key: 'evidenceQuality',
      label: 'Evidence Quality',
      score: 60,
      weight: 0.3,
      explanation: '3 of 5 skills are backed by demonstrated or supported evidence; the rest are only claimed.',
      improvementLink: { label: 'Strengthen your skill evidence', to: '/forward-dna' },
    },
    {
      key: 'forwardDnaDepth',
      label: 'Forward DNA Depth',
      score: 80,
      weight: 0.25,
      explanation: 'Your Forward DNA profile is 80% complete across scope, responsibilities, skill evidence, education, and career goals.',
      improvementLink: { label: 'Complete your Forward DNA', to: '/forward-dna' },
    },
    {
      key: 'careerMomentum',
      label: 'Career Momentum',
      score: 75,
      weight: 0.2,
      explanation: 'You have 3 of 4 momentum signals. Still missing: responded to recent messages.',
      improvementLink: { label: 'Keep your search active', to: '/applications' },
    },
    {
      key: 'goalAlignment',
      label: 'Goal Alignment',
      score: 70,
      weight: 0.25,
      explanation: 'Your target role and timeframe align with your stated career direction at 70%.',
      improvementLink: null,
    },
  ],
}

const BANNED_PHRASES = [
  'hiring probability',
  'salary potential',
  'guaranteed salary',
  'employer',
  'human worth',
  'objective prediction',
]

function renderWidget(r: ForwardScoreResult = result) {
  render(
    <MemoryRouter>
      <ForwardScoreWidget result={r} />
    </MemoryRouter>
  )
}

describe('ForwardScoreWidget', () => {
  it('renders the total score', () => {
    renderWidget()
    expect(screen.getByText('72')).toBeInTheDocument()
  })

  it('renders all 4 pillar labels', () => {
    renderWidget()
    expect(screen.getByText('Evidence Quality')).toBeInTheDocument()
    expect(screen.getByText('Forward DNA Depth')).toBeInTheDocument()
    expect(screen.getByText('Career Momentum')).toBeInTheDocument()
    expect(screen.getByText('Goal Alignment')).toBeInTheDocument()
  })

  it('renders a disclaimer sentence framing the score as directional, not a verdict', () => {
    renderWidget()
    const text = document.body.textContent ?? ''
    expect(/snapshot|directional/i.test(text)).toBe(true)
  })

  it('never renders any of the banned judgment-of-the-member phrases', () => {
    renderWidget()
    const text = (document.body.textContent ?? '').toLowerCase()
    for (const phrase of BANNED_PHRASES) {
      expect(text).not.toContain(phrase)
    }
  })
})
