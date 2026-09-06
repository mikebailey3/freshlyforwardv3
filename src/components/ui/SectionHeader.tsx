import { SectionEyebrow } from './SectionEyebrow'

type SectionHeaderProps = {
  eyebrow?: string
  title: string
  description?: string
  align?: 'left' | 'center'
  className?: string
}

export function SectionHeader({ eyebrow, title, description, align = 'left', className = '' }: SectionHeaderProps) {
  const alignClass = align === 'center' ? 'mx-auto text-center' : 'text-left'
  return (
    <div className={`max-w-2xl ${alignClass} ${className}`}>
      {eyebrow && <SectionEyebrow className="mb-3">{eyebrow}</SectionEyebrow>}
      <h2 className="text-h2 font-display text-ink">{title}</h2>
      {description && <p className="mt-3 text-body text-ink-muted">{description}</p>}
    </div>
  )
}
