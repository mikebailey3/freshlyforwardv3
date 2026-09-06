import type { ReactNode } from 'react'

type CardProps = {
  children: ReactNode
  className?: string
  padded?: boolean
}

export function Card({ children, className = '', padded = true }: CardProps) {
  return (
    <div className={`rounded-2xl border border-border bg-surface-card ${padded ? 'p-6' : ''} ${className}`}>
      {children}
    </div>
  )
}
