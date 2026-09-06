import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SectionHeader } from './SectionHeader'

describe('SectionHeader', () => {
  it('renders title, eyebrow, and description', () => {
    render(<SectionHeader eyebrow="Focus" title="Your Next Move" description="Here is what matters this week." />)
    expect(screen.getByText('Focus')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Your Next Move' })).toBeInTheDocument()
    expect(screen.getByText('Here is what matters this week.')).toBeInTheDocument()
  })

  it('renders without eyebrow or description', () => {
    render(<SectionHeader title="Applications" />)
    expect(screen.getByRole('heading', { name: 'Applications' })).toBeInTheDocument()
  })

  it('centers content when align is center', () => {
    render(<SectionHeader title="Applications" align="center" />)
    expect(screen.getByRole('heading').closest('div')?.className).toContain('text-center')
  })
})
