import type { ForwardScoreResult } from '@/types/forwardScore'

/**
 * The primary hero metric on ForwardOS Home: the weighted Forward Score
 * composite, plus a compact summary row of the 4 pillar labels/scores.
 * Full per-pillar explanation and improvement links live in `PillarCard`,
 * rendered separately below this widget in DashboardPage.tsx (Task 7) --
 * this widget intentionally only shows label + score per pillar so the
 * two components don't duplicate the same detail.
 *
 * Visual treatment deliberately reaches into the app's navy/green
 * "premium hero" language (see src/index.css: --navy, --green, --shadow,
 * --radius) rather than the plain white stat-card look used elsewhere --
 * this is the one hero metric on the page, everything else is a
 * supporting card.
 *
 * Hard requirement (spec Sec 5, enforced by ForwardScoreWidget.test.tsx):
 * this component must never render "hiring probability", "salary
 * potential"/"guaranteed salary", "employer", "human worth", or
 * "objective prediction" -- the Forward Score is a directional snapshot
 * of the member's own effort and evidence, never a judgment of the
 * member or a prediction about employers.
 */
export function ForwardScoreWidget({ result }: { result: ForwardScoreResult }) {
  return (
    <div
      className="rounded-[var(--radius)] bg-[var(--navy)] p-6 text-white shadow-[var(--shadow)] sm:p-8"
    >
      <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-[#7ee4b6]">
        Forward Score
      </p>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="font-mono text-5xl font-bold text-white sm:text-6xl">{result.total}</span>
        <span className="font-mono text-lg text-[#bac8d6]">/ 100</span>
      </div>

      <p className="mt-3 max-w-md text-sm text-[#bac8d6]">
        A directional snapshot of your job-search progress right now -- meant to help you see
        where to focus next, not a verdict on you.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 border-t border-white/10 pt-5 sm:grid-cols-4">
        {result.pillars.map((pillar) => (
          <div key={pillar.key}>
            <p className="text-xs font-semibold text-[#bac8d6]">{pillar.label}</p>
            <p className="mt-1 font-mono text-xl font-bold text-white">{pillar.score}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
