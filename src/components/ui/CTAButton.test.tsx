import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CTAButton } from './CTAButton'

describe('CTAButton', () => {
  it('renders children and fires onClick', () => {
    const onClick = vi.fn()
    render(<CTAButton onClick={onClick}>Take Career Compass</CTAButton>)
    fireEvent.click(screen.getByRole('button', { name: 'Take Career Compass' }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('uses the primary accent fill', () => {
    render(<CTAButton>Go</CTAButton>)
    expect(screen.getByRole('button').className).toContain('bg-primary-600')
  })

  it('respects disabled', () => {
    render(<CTAButton disabled>Go</CTAButton>)
    expect(screen.getByRole('button')).toBeDisabled()
  })
})
