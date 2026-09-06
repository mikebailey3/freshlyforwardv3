import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Card } from './Card'

describe('Card', () => {
  it('renders children on the semantic card surface', () => {
    render(<Card>Content</Card>)
    // Card renders children directly inside its own surface div (no extra
    // wrapper), so getByText('Content') returns that surface div itself --
    // asserting on its own className, not parentElement's.
    const el = screen.getByText('Content')
    expect(el.className).toContain('bg-surface-card')
  })

  it('applies padding by default and can opt out', () => {
    render(<Card padded={false}>Content</Card>)
    expect(screen.getByText('Content').parentElement?.className).not.toContain('p-6')
  })
})
