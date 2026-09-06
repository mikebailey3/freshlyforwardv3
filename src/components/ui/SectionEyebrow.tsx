import type { ReactNode } from 'react'

type SectionEyebrowProps = {
  children: ReactNode
  className?: string
}

export function SectionEyebrow({ children, className = '' }: SectionEyebrowProps) {
  return (
    <p className={`text-eyebrow font-semibold uppercase tracking-[0.13em] text-primary-400 ${className}`}>
      {children}
    </p>
  )
}
