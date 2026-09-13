import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { lazy, Suspense } from 'react'
import { ErrorBoundary } from './ErrorBoundary'

function Bomb(): never {
  throw new Error('boom')
}

describe('ErrorBoundary', () => {
  it('renders children normally when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>All good</p>
      </ErrorBoundary>,
    )
    expect(screen.getByText('All good')).toBeInTheDocument()
  })

  it('renders a calm fallback with a Reload action when a child throws', () => {
    // React logs the caught error to the console by default during tests --
    // silence it here so the expected error doesn't look like a test failure.
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    )

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument()
    expect(screen.queryByText('All good')).not.toBeInTheDocument()

    consoleSpy.mockRestore()
  })

  it('calls window.location.reload when Reload is clicked', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const reloadSpy = vi.fn()
    Object.defineProperty(window, 'location', {
      value: { ...window.location, reload: reloadSpy },
      writable: true,
    })

    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Reload' }))
    expect(reloadSpy).toHaveBeenCalledTimes(1)

    consoleSpy.mockRestore()
  })

  // N9 (bundle code-splitting): every page in src/App.tsx is now a
  // React.lazy() import. That introduces a new failure mode that never
  // existed with static imports -- a hashed chunk 404ing after a redeploy
  // (or any other reason `import()` rejects) makes the lazy factory reject,
  // and React re-throws that rejection during render. This asserts the root
  // ErrorBoundary (mounted around <Suspense> in main.tsx) actually catches
  // that class of failure and shows the calm reload fallback, instead of
  // leaving the member stuck on the Suspense fallback forever.
  it('catches a rejected React.lazy() import (e.g. a stale/404 chunk after redeploy)', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const BrokenLazyPage = lazy(() => Promise.reject(new Error('Failed to fetch dynamically imported module')))

    render(
      <ErrorBoundary>
        <Suspense fallback={<p>Loading...</p>}>
          <BrokenLazyPage />
        </Suspense>
      </ErrorBoundary>,
    )

    await waitFor(() => expect(screen.getByText('Something went wrong')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument()

    consoleSpy.mockRestore()
  })
})
