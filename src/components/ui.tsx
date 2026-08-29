import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

type LinkButtonProps = {
  to: string
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'light'
}

export function LinkButton({ to, children, variant = 'primary' }: LinkButtonProps) {
  return <Link to={to} className={`button button-${variant}`}>{children}</Link>
}

type SectionHeadingProps = {
  eyebrow?: string
  title: string
  copy?: string
  id?: string
  centered?: boolean
}

export function SectionHeading({ eyebrow, title, copy, id, centered = false }: SectionHeadingProps) {
  return (
    <div className={`section-heading${centered ? ' section-heading-centered' : ''}`}>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h2 id={id}>{title}</h2>
      {copy && <p>{copy}</p>}
    </div>
  )
}

type PillLinkButtonProps = {
  to: string
  children: ReactNode
  variant?: 'primary' | 'secondary'
}

export function PillLinkButton({ to, children, variant = 'primary' }: PillLinkButtonProps) {
  const styles =
    variant === 'primary'
      ? 'bg-primary-600 text-white hover:bg-primary-700'
      : 'border-2 border-neutral-900 text-neutral-900 hover:bg-neutral-900 hover:text-white'
  return (
    <Link
      to={to}
      className={`inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-colors ${styles}`}
    >
      {children}
    </Link>
  )
}
