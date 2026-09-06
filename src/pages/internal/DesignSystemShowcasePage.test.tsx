import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DesignSystemShowcasePage } from './DesignSystemShowcasePage'

describe('DesignSystemShowcasePage', () => {
  it('renders every foundation section with realistic FreshlyForward content', () => {
    render(<DesignSystemShowcasePage />)
    expect(screen.getByRole('heading', { name: 'Design System Foundation' })).toBeInTheDocument()
    expect(screen.getByText('Surfaces')).toBeInTheDocument()
    expect(screen.getByText('Typography')).toBeInTheDocument()
    expect(screen.getByText('Buttons')).toBeInTheDocument()
    expect(screen.getByText('Cards')).toBeInTheDocument()
    expect(screen.getByText('Progress')).toBeInTheDocument()
    expect(screen.getByText('Tabs')).toBeInTheDocument()
    expect(screen.getByText('Filter chips')).toBeInTheDocument()
    expect(screen.getByText('Data rows')).toBeInTheDocument()
    expect(screen.getByText('Empty, loading, and error states')).toBeInTheDocument()
    expect(screen.getByText('Navigation states')).toBeInTheDocument()
  })

  it('uses realistic content, not lorem ipsum', () => {
    render(<DesignSystemShowcasePage />)
    expect(screen.queryByText(/lorem ipsum/i)).not.toBeInTheDocument()
    // "FreshFit" is deliberately repeated across several sections (that's
    // the realistic-content goal), so assert on the full set rather than a
    // single match.
    expect(screen.getAllByText(/FreshFit/).length).toBeGreaterThan(0)
  })
})
