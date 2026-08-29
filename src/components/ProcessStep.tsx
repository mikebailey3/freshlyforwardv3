import type { ReactNode } from 'react'
import { useScrollReveal } from '@/hooks/useScrollReveal'

export interface ProcessStepProps {
  index: number
  title: string
  copy: string
  visual: ReactNode
  reversed?: boolean
}

// One authored reveal per step, the first time it's seen -- not a generic
// scroll-fade slapped on everything. Same one-shot IntersectionObserver
// pattern as LandingPage's verdict section, via the shared hook.
export function ProcessStep({ index, title, copy, visual, reversed = false }: ProcessStepProps) {
  const [ref, visible] = useScrollReveal<HTMLDivElement>(0.25)

  return (
    <div
      ref={ref}
      className={`grid items-center gap-10 py-14 transition-all duration-700 ease-out lg:grid-cols-2 lg:gap-16 lg:py-16 ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
      }`}
    >
      <div className={reversed ? 'lg:order-2' : ''}>
        <span className="font-mono text-xs font-bold uppercase tracking-wide text-primary-600">
          Step {index}
        </span>
        <h3 className="mt-3 font-display text-3xl font-semibold leading-tight text-[var(--navy)]">{title}</h3>
        <p className="mt-4 max-w-md text-base leading-relaxed text-neutral-600">{copy}</p>
      </div>
      <div className={reversed ? 'lg:order-1' : ''}>{visual}</div>
    </div>
  )
}
