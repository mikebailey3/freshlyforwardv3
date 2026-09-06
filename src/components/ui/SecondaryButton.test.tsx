import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SecondaryButton } from './SecondaryButton'

describe('SecondaryButton', () => {
  it('renders children and fires onClick', () => {
    const onClick = vi.fn()
    render(<SecondaryButton onClick={onClick}>See How It Works</SecondaryButton>)
    fireEvent.click(screen.getByRole('button', { name: 'See How It Works' }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('uses a bordered transparent style, not a solid fill', () => {
    render(<SecondaryButton>Go</SecondaryButton>)
    const cls = screen.getByRole('button').className
    expect(cls).toContain('border-border')
    expect(cls).not.toContain('bg-primary-600')
  })
})
