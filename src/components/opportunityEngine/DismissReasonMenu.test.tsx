import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DismissReasonMenu } from './DismissReasonMenu'
import { DISMISSAL_REASON_LABELS } from '@/lib/opportunityEngine/dismissalReasons'

describe('DismissReasonMenu', () => {
  it('renders every canonical reason as a menu item', () => {
    render(<DismissReasonMenu onSelectReason={vi.fn()} onSkip={vi.fn()} onClose={vi.fn()} />)
    for (const label of Object.values(DISMISSAL_REASON_LABELS)) {
      expect(screen.getByRole('menuitem', { name: label })).toBeInTheDocument()
    }
  })

  it('calls onSelectReason with the machine-readable reason key, not the label', async () => {
    const onSelectReason = vi.fn()
    render(<DismissReasonMenu onSelectReason={onSelectReason} onSkip={vi.fn()} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('menuitem', { name: 'Wrong salary' }))
    expect(onSelectReason).toHaveBeenCalledWith('wrong_salary')
  })

  it('always offers a first-class skip-without-a-reason path', async () => {
    const onSkip = vi.fn()
    render(<DismissReasonMenu onSelectReason={vi.fn()} onSkip={onSkip} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Skip, just dismiss' }))
    expect(onSkip).toHaveBeenCalledTimes(1)
  })

  it('calls onClose without dismissing anything when the close (X) button is used', async () => {
    const onClose = vi.fn()
    const onSelectReason = vi.fn()
    const onSkip = vi.fn()
    render(<DismissReasonMenu onSelectReason={onSelectReason} onSkip={onSkip} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onSelectReason).not.toHaveBeenCalled()
    expect(onSkip).not.toHaveBeenCalled()
  })
})
