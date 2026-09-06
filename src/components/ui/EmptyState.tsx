import type { ReactNode } from 'react'

type EmptyStateProps = {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({ icon, title, description, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-surface-subtle px-6 py-12 text-center ${className}`}>
      {icon && <div className="text-ink-muted">{icon}</div>}
      <p className="text-base font-semibold text-ink">{title}</p>
      {description && <p className="max-w-sm text-sm text-ink-muted">{description}</p>}
      {action}
    </div>
  )
}
