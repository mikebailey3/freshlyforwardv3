import { Link } from 'react-router-dom'
import type { NextBestMove } from '@/types/forwardScore'

/**
 * Surfaces the single deterministic "Next Best Move" recommendation
 * (see src/lib/forwardScore/nextBestMove.ts) as a real, keyboard-reachable
 * call-to-action link -- never a bare <button> with no destination.
 */
export function NextBestMoveCard({ move }: { move: NextBestMove }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
      <p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
        Next Best Move
      </p>
      <h3 className="mt-1 font-serif text-base font-semibold text-neutral-900">{move.headline}</h3>
      <p className="mt-1 text-sm text-neutral-600">{move.detail}</p>
      <Link
        to={move.cta.to}
        className="mt-3 inline-block font-mono text-xs font-medium text-primary-600 hover:text-primary-700"
      >
        {move.cta.label}
      </Link>
    </div>
  )
}
