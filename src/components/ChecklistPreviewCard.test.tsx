import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChecklistPreviewCard } from './ChecklistPreviewCard'

describe('ChecklistPreviewCard', () => {
  it('renders the label, a Sample badge, and every item', () => {
    render(
      <ChecklistPreviewCard
        label="Resume Optimization"
        items={['Quantified impact added', 'Headline rewritten']}
      />
    )
    expect(screen.getByText('Resume Optimization')).toBeInTheDocument()
    expect(screen.getByText('Sample')).toBeInTheDocument()
    expect(screen.getByText('Quantified impact added')).toBeInTheDocument()
    expect(screen.getByText('Headline rewritten')).toBeInTheDocument()
  })
})
