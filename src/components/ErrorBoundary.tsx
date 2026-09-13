import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

/**
 * Root-level error boundary. Wraps the outermost tree (see main.tsx) rather
 * than just `<App />`, since `AuthProvider` itself does async session work
 * and is a plausible crash site that would otherwise stay uncaught.
 *
 * Known limits (React error boundaries, not specific to this one):
 * - Does NOT catch errors in event handlers, async code (promises,
 *   setTimeout, etc.), or anything outside the React render path.
 * - Does NOT reset on route change -- recovery is reload-only, which needs
 *   no router context, which is exactly why this sits outside the router.
 * - `console.error` only, on purpose -- no error-tracking vendor is wired
 *   up (choosing one is a separate, paid-vendor decision). That means we
 *   still have zero visibility into production crashes; this component
 *   improves the member's experience, not the team's awareness.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Uncaught render error:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface-subtle p-6 text-center">
          <h1 className="font-serif text-2xl font-semibold text-ink">Something went wrong</h1>
          <p className="max-w-sm text-sm text-ink-muted">
            We hit a snag on our end. Please reload and try again.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-full bg-primary-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700"
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
