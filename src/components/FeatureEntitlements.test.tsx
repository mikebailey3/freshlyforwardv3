import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { UpgradeModal } from './FeatureEntitlements'

// N3 item 6: focus-trap behavior itself is covered exhaustively by
// useFocusTrap.test.tsx -- this just confirms UpgradeModal is actually wired
// up to it (a ref on the dialog container) and that Sarah's requested
// aria-describedby links the visible body copy for screen readers.

function renderModal(isOpen: boolean) {
  return render(
    <MemoryRouter>
      <UpgradeModal
        feature={null}
        featureKey="mock_interviews"
        isOpen={isOpen}
        onClose={() => {}}
      />
    </MemoryRouter>,
  )
}

describe('UpgradeModal - dialog accessibility wiring (N3 item 6)', () => {
  it('renders nothing when closed', () => {
    renderModal(false)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('links the dialog to its body copy via aria-describedby', () => {
    renderModal(true)
    const dialog = screen.getByRole('dialog')
    const describedById = dialog.getAttribute('aria-describedby')
    expect(describedById).toBe('upgrade-modal-body')
    expect(document.getElementById(describedById!)).not.toBeNull()
  })

  it('moves initial focus into the dialog on open (focus trap is active)', () => {
    renderModal(true)
    // First focusable element inside the dialog is the close (X) button.
    expect(screen.getByLabelText('Close')).toHaveFocus()
  })
})
