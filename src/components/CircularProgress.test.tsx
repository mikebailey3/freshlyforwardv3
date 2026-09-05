import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CircularProgress } from './CircularProgress'

describe('CircularProgress - default behavior (Dashboard call sites)', () => {
  it('renders the value with a trailing "%" by default, matching every existing call site', () => {
    render(<CircularProgress value={50} />)
    expect(screen.getByText('50%')).toBeInTheDocument()
  })

  it('uses the original 80/50 success/warning/error thresholds by default', () => {
    const { container: high } = render(<CircularProgress value={85} />)
    expect(high.querySelector('.text-success-600')).toBeInTheDocument()

    const { container: mid } = render(<CircularProgress value={60} />)
    expect(mid.querySelector('.text-warning-600')).toBeInTheDocument()

    const { container: low } = render(<CircularProgress value={20} />)
    expect(low.querySelector('.text-error-600')).toBeInTheDocument()
  })
})

describe('CircularProgress - optional props (Opportunity Engine FreshFit usage)', () => {
  it('renders no "%" suffix when suffix is set to an empty string', () => {
    render(<CircularProgress value={92} suffix="" />)
    expect(screen.getByText('92')).toBeInTheDocument()
    expect(screen.queryByText('92%')).not.toBeInTheDocument()
  })

  it('accepts custom tier thresholds instead of the hardcoded 80/50 default', () => {
    const { container } = render(<CircularProgress value={80} suffix="" tierThresholds={{ success: 75, warning: 50 }} />)
    expect(container.querySelector('.text-success-600')).toBeInTheDocument()
  })
})
