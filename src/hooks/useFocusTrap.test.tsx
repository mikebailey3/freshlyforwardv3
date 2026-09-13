import { useRef, useState } from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useFocusTrap } from './useFocusTrap'

// N3 item 6: hand-rolled focus trap shared by AddCareerWinModal and
// UpgradeModal. Tested in isolation here rather than only through those two
// components, since the trap/restore behavior is the reusable unit.

function Harness({ active }: { active: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null)
  useFocusTrap(containerRef, active)
  return (
    <div ref={containerRef} data-testid="dialog">
      <button>First</button>
      <button>Second</button>
      <button>Last</button>
    </div>
  )
}

function ToggleHarness() {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  useFocusTrap(containerRef, open)
  return (
    <div>
      <button onClick={() => setOpen(true)}>Open trigger</button>
      {open && (
        <div ref={containerRef} data-testid="dialog">
          <button onClick={() => setOpen(false)}>Close</button>
        </div>
      )}
    </div>
  )
}

describe('useFocusTrap', () => {
  it('moves initial focus to the first focusable element on activation', () => {
    render(<Harness active />)
    expect(screen.getByText('First')).toHaveFocus()
  })

  it('wraps Tab from the last focusable element back to the first', () => {
    render(<Harness active />)
    screen.getByText('Last').focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(screen.getByText('First')).toHaveFocus()
  })

  it('wraps Shift+Tab from the first focusable element back to the last', () => {
    render(<Harness active />)
    screen.getByText('First').focus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(screen.getByText('Last')).toHaveFocus()
  })

  it('does nothing when inactive -- no initial focus is stolen', () => {
    render(<Harness active={false} />)
    expect(document.body).toHaveFocus()
  })

  it('restores focus to the triggering element once the dialog closes', () => {
    render(<ToggleHarness />)
    const trigger = screen.getByText('Open trigger')
    trigger.focus()
    fireEvent.click(trigger)

    expect(screen.getByText('Close')).toHaveFocus()

    fireEvent.click(screen.getByText('Close'))

    expect(trigger).toHaveFocus()
  })
})
