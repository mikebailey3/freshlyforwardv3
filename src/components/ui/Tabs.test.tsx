import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Tabs } from './Tabs'

const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'applications', label: 'Applications' },
]

describe('Tabs', () => {
  it('marks the active tab as selected', () => {
    render(<Tabs tabs={tabs} activeId="overview" onChange={() => {}} />)
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Applications' })).toHaveAttribute('aria-selected', 'false')
  })

  it('calls onChange with the clicked tab id', () => {
    const onChange = vi.fn()
    render(<Tabs tabs={tabs} activeId="overview" onChange={onChange} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Applications' }))
    expect(onChange).toHaveBeenCalledWith('applications')
  })
})
