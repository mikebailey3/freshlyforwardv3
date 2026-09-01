import { Link } from 'react-router-dom'
import type { ForwardScorePillarResult } from '@/types/forwardScore'

/**
 * A single Forward Score pillar's detail card. Follows the same visual
 * conventions as the Dashboard "Stat cards" row (see DashboardPage.tsx)
 * so it reads as part of the same design system, not a new one-off.
 */
export function PillarCard({ pillar }: { pillar: ForwardScorePillarResult }) {
  return (
    <div className="rounded-xl border border-neutral-200 p-5 shadow-sm">
      <p className="text-sm font-semibold text-neutral-700">{pillar.label}</p>
      <p className="mt-2 font-mono text-3xl font-bold text-neutral-900">{pillar.score}</p>
      <p className="mt-1 text-xs text-neutral-500">{pillar.explanation}</p>
      {pillar.improvementLink && (
        <Link
          to={pillar.improvementLink.to}
          className="mt-3 inline-block font-mono text-xs font-medium text-primary-600 hover:text-primary-700"
        >
          {pillar.improvementLink.label}
        </Link>
      )}
    </div>
  )
}
