import { CircularProgress } from '@/components/CircularProgress'

export interface ForwardScoreCardProps {
  score: number
  delta: string
}

/** Sample Forward Score summary for the homepage's Progress (layer 5)
 * section. Reuses the existing CircularProgress ring so the visual
 * language matches the real Dashboard's score presentation. The ring's
 * own internal label is suppressed (empty string) because this card
 * already renders its own "Forward Score" caption -- passing the same
 * label to both produced two identical text nodes on the page. */
export function ForwardScoreCard({ score, delta }: ForwardScoreCardProps) {
  return (
    <div className="flex items-center gap-5 rounded-2xl border border-border bg-surface-card p-6">
      <CircularProgress value={score} size={72} strokeWidth={7} label="" />
      <div>
        <p className="font-mono text-xs font-semibold uppercase tracking-wide text-ink-muted">Forward Score</p>
        <p className="mt-1 font-mono text-3xl font-bold text-ink">{score}</p>
        <p className="mt-1 text-xs font-semibold text-primary-400">{delta}</p>
      </div>
    </div>
  )
}
