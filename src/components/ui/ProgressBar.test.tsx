import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProgressBar } from './ProgressBar'

describe('ProgressBar', () => {
  it('exposes an accessible progressbar role with correct bounds', () => {
    render(<ProgressBar value={43} label="Profile completeness" />)
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '43')
    expect(bar).toHaveAttribute('aria-valuemax', '100')
  })

  it('renders the label and rounded percentage', () => {
    render(<ProgressBar value={43} label="Profile completeness" />)
    expect(screen.getByText('Profile completeness')).toBeInTheDocument()
    expect(screen.getByText('43%')).toBeInTheDocument()
  })

  it('clamps values outside 0-max', () => {
    render(<ProgressBar value={150} max={100} />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '150')
  })
})
