import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

// Pre-existing marketing-site components, relocated here unchanged from the
// old src/components/ui.tsx (which collided with this ui/ directory's own
// module-resolution path -- `@/components/ui` can only resolve to one of
// them). Re-exported from ui/index.ts so none of the 11 existing consumers
// (LandingPage, PricingPage, AboutPage, etc.) needed to change their imports.
// Still uses the legacy marketing CSS-class system / literal Tailwind
// neutrals -- migrating that is out of scope for Sub-project 1 Task 12 and
// belongs to the later component-migration batches (Tasks 15-22).

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
