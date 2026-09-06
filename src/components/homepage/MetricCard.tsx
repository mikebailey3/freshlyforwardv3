import type { LucideIcon } from 'lucide-react'

export interface MetricCardProps {
  icon: LucideIcon
  label: string
  value: string
  delta?: string
}

/** A small stat card for the homepage's Progress (layer 5) section and the
 * hero's floating product-visual cards. Sample/illustrative data only --
 * never wired to a real member's data on this public page. */
export function MetricCard({ icon: Icon, label, value, delta }: MetricCardProps) {
  return (
    <div className="rounded-2xl border border-border bg-surface-card p-5">
      <Icon className="h-5 w-5 text-primary-400" aria-hidden="true" />
      <p className="mt-3 font-mono text-2xl font-bold text-ink">{value}</p>
      <p className="mt-1 text-sm text-ink-muted">{label}</p>
      {delta && <p className="mt-2 text-xs font-semibold text-primary-400">{delta}</p>}
    </div>
  )
}
