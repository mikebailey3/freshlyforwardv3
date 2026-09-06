import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FilterChip } from './FilterChip'

describe('FilterChip', () => {
  it('reflects active state via aria-pressed', () => {
    render(<FilterChip label="Remote" active />)
    expect(screen.getByRole('button', { name: 'Remote' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('calls onClick when clicked', () => {
    const onClick = vi.fn()
    render(<FilterChip label="Remote" onClick={onClick} />)
    fireEvent.click(screen.getByRole('button', { name: 'Remote' }))
    expect(onClick).toHaveBeenCalledOnce()
  })
})
