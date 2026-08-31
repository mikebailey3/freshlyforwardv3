import type { ReactNode } from 'react'
import { useScrollReveal } from '@/hooks/useScrollReveal'

export interface AlternatingRowProps {
  eyebrow: string
  title: string
  copy: string
  visual: ReactNode
  reversed?: boolean
}

// Was ProcessStep, hardcoded to "Step N" -- generalized so ServicesPage and
// WhyFreshlyForwardPage can reuse the identical zigzag layout + one-shot
// scroll-reveal for non-sequential content (services, differentiators)
// where numbered steps wouldn't make sense. Callers now supply whatever
// eyebrow text fits ("Step 1", "Included in every plan", etc).
export function AlternatingRow({ eyebrow, title, copy, visual, reversed = false }: AlternatingRowProps) {
  const [ref, visible] = useScrollReveal<HTMLDivElement>(0.25)

  return (
    <div
      ref={ref}
      className={`grid items-center gap-10 py-14 transition-all duration-700 ease-out lg:grid-cols-2 lg:gap-16 lg:py-16 ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
      }`}
    >
      <div className={reversed ? 'lg:order-2' : ''}>
        <span className="font-mono text-xs font-bold uppercase tracking-wide text-primary-600">{eyebrow}</span>
        <h3 className="mt-3 font-display text-3xl font-semibold leading-tight text-[var(--navy)]">{title}</h3>
        <p className="mt-4 max-w-md text-base leading-relaxed text-neutral-600">{copy}</p>
      </div>
      <div className={reversed ? 'lg:order-1' : ''}>{visual}</div>
    </div>
  )
}
