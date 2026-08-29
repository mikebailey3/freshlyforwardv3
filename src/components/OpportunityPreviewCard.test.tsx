import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OpportunityPreviewCard } from './OpportunityPreviewCard'

const baseProps = {
  role: 'Senior Product Manager, Platform',
  company: 'Example Robotics Co.',
  location: 'Remote (US)',
  fitNote: 'Strong fit: growth-stage, cross-functional ownership.',
}

describe('OpportunityPreviewCard', () => {
  it('renders the role, company, location, and fit note', () => {
    render(<OpportunityPreviewCard {...baseProps} status="reviewed" />)
    expect(screen.getByText('Senior Product Manager, Platform')).toBeInTheDocument()
    expect(screen.getByText(/Example Robotics Co\./)).toBeInTheDocument()
    expect(screen.getByText(/Remote \(US\)/)).toBeInTheDocument()
    expect(screen.getByText('Strong fit: growth-stage, cross-functional ownership.')).toBeInTheDocument()
  })

  it('maps status to the correct badge label', () => {
    const { rerender } = render(<OpportunityPreviewCard {...baseProps} status="reviewed" />)
    expect(screen.getByText('Reviewed')).toBeInTheDocument()

    rerender(<OpportunityPreviewCard {...baseProps} status="submitted" />)
    expect(screen.getByText('Submitted')).toBeInTheDocument()
    expect(screen.queryByText('Reviewed')).not.toBeInTheDocument()
  })
})
