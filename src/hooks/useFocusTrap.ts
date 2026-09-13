import { useEffect, type RefObject } from 'react'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Traps Tab/Shift+Tab focus within a dialog container while `active` is true,
 * moves initial focus into the container on activation, and restores focus to
 * whatever element triggered the dialog once it closes/unmounts.
 *
 * Deliberately does NOT handle Escape -- callers that need Escape-to-close
 * already own that behavior (e.g. gating it on a `saving` flag), and a
 * hook-level listener here would create a second, competing close path.
 *
 * Focusable elements are queried fresh on every Tab keypress rather than
 * once on mount, since dialog content commonly changes shape (conditional
 * error banners, disabled fields, multi-step forms) while open.
 */
export function useFocusTrap(containerRef: RefObject<HTMLElement | null>, active: boolean): void {
  useEffect(() => {
    if (!active) return
    const container = containerRef.current
    if (!container) return

    const previouslyFocused = document.activeElement as HTMLElement | null

    const getFocusable = (): HTMLElement[] =>
      Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))

    const initial = getFocusable()[0]
    initial?.focus()

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const focusable = getFocusable()
      if (focusable.length === 0) {
        e.preventDefault()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const current = document.activeElement

      if (e.shiftKey) {
        if (current === first || !container.contains(current)) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (current === last || !container.contains(current)) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      // Idempotent/null-safe: previouslyFocused may have unmounted (e.g.
      // React StrictMode's double-invoke in dev, or the trigger itself
      // being removed while the dialog was open).
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus()
      }
    }
  }, [active, containerRef])
}
