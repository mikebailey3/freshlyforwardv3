export function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-subtle">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-surface-elevated border-t-primary-600" />
        <p className="text-sm text-ink-muted">Loading FreshlyForward…</p>
      </div>
    </div>
  )
}
