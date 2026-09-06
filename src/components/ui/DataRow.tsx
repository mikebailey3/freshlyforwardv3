import type { ReactNode } from 'react'

type DataRowProps = {
  label: string
  value: ReactNode
  className?: string
}

export function DataRow({ label, value, className = '' }: DataRowProps) {
  return (
    <div className={`flex items-center justify-between gap-4 border-b border-border py-3 last:border-b-0 ${className}`}>
      <span className="text-sm text-ink-muted">{label}</span>
      <span className="text-sm font-semibold text-ink">{value}</span>
    </div>
  )
}
