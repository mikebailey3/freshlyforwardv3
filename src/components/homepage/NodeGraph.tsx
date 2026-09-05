// Homepage Redesign Phase 1 / Task 7: "Why FreshlyForward?" comparison
// section -- a genuine attempt at the North Star's node-graph illustration
// style (scattered/tangled nodes vs. a clean connected path), not a
// simplified checklist. Per the plan's Task 7 step 2, simplification is
// only justified if the faithful version demonstrably harms clarity,
// responsiveness, accessibility, or performance -- this version is plain
// SVG + a handful of absolutely-positioned nodes, so none of those risks
// apply; it degrades to a single stacked column on narrow screens via the
// parent's `md:grid-cols-2`, same as every other section on this page.
//
// Node positions are hand-placed percentages within a shared viewBox-free
// container (not a literal SVG <path> network) -- deliberately simple
// coordinates so this stays legible and maintainable, while still reading
// as "tangled" vs. "connected" at a glance.
import type { LucideIcon } from 'lucide-react'

interface GraphNode {
  icon: LucideIcon
  label: string
  x: number // percentage, 0-100
  y: number // percentage, 0-100
}

interface NodeGraphProps {
  nodes: GraphNode[]
  tangled: boolean
}

function NodeGraph({ nodes, tangled }: NodeGraphProps) {
  // Tangled: connect every node to every other node (crossing lines).
  // Connected: connect nodes in sequence only (one clean path).
  const lines = tangled
    ? nodes.flatMap((a, i) => nodes.slice(i + 1).map((b) => [a, b] as const))
    : nodes.slice(0, -1).map((a, i) => [a, nodes[i + 1]] as const)

  return (
    <div className="relative h-72 w-full">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {lines.map(([a, b], i) => (
          <line
            key={i}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke={tangled ? '#d97757' : '#078a58'}
            strokeOpacity={tangled ? 0.35 : 0.5}
            strokeWidth={tangled ? 0.4 : 0.6}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      {nodes.map(({ icon: Icon, label, x, y }) => (
        <div
          key={label}
          className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5 text-center"
          style={{ left: `${x}%`, top: `${y}%` }}
        >
          <span
            className={`flex h-10 w-10 items-center justify-center rounded-full shadow-[var(--shadow)] ${
              tangled ? 'bg-white text-[#d97757] ring-1 ring-[#d97757]/30' : 'bg-white text-[color:var(--color-primary-600)] ring-1 ring-[color:var(--color-primary-600)]/30'
            }`}
          >
            <Icon size={18} aria-hidden="true" />
          </span>
          <span className="max-w-[90px] text-[11px] font-medium leading-tight text-neutral-600">{label}</span>
        </div>
      ))}
    </div>
  )
}

export { NodeGraph }
export type { GraphNode }
