import { Link } from 'react-router-dom'
import { ArrowRight, Target } from 'lucide-react'

export interface CurrentFocusCardProps {
  title: string
  evidence: string
  progressLabel: string
  ctaLabel: string
  ctaTo: string
}

/** Sample "current focus" module for the homepage's Action (layer 3)
 * section -- illustrates the evidence -> progress -> next-action pattern
 * without claiming to reflect any specific real member. */
export function CurrentFocusCard({ title, evidence, progressLabel, ctaLabel, ctaTo }: CurrentFocusCardProps) {
  return (
    <div className="rounded-2xl border border-border bg-surface-card p-7">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wide text-primary-400">
          <Target className="h-3.5 w-3.5" aria-hidden="true" /> Current Focus
        </span>
        <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-ink-muted">
          Sample
        </span>
      </div>
      <h3 className="mt-4 font-display text-xl font-semibold text-ink">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">{evidence}</p>
      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-ink-muted">{progressLabel}</p>
      <Link
        to={ctaTo}
        className="mt-5 inline-flex items-center gap-2 font-mono text-sm font-semibold text-primary-400 hover:text-primary-300"
      >
        {ctaLabel} <ArrowRight size={16} />
      </Link>
    </div>
  )
}
