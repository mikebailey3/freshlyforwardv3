import { Link } from 'react-router-dom'
import type { ForwardScorePillarResult } from '@/types/forwardScore'

/**
 * A single Forward Score pillar's detail card. Follows the same visual
 * conventions as the Dashboard "Stat cards" row (see DashboardPage.tsx)
 * so it reads as part of the same design system, not a new one-off.
 */
export function PillarCard({ pillar }: { pillar: ForwardScorePillarResult }) {
  return (
    <div className="rounded-xl border border-border p-5 shadow-sm">
      <p className="text-sm font-semibold text-ink-muted">{pillar.label}</p>
      <p className="mt-2 font-mono text-3xl font-bold text-ink">{pillar.score}</p>
      <p className="mt-1 text-xs text-ink-muted">{pillar.explanation}</p>
      {pillar.improvementLink && (
        <Link
          to={pillar.improvementLink.to}
          className="mt-3 inline-block font-mono text-xs font-medium text-primary-600 hover:text-primary-400"
        >
          {pillar.improvementLink.label}
        </Link>
      )}
    </div>
  )
}
