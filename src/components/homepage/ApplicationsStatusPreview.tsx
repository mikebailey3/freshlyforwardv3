// Homepage Redesign Phase 1 / North Star fidelity pass: illustrative status
// pill row for the "Applications" supporting-capability card, matching the
// North Star reference's status/count visualization.
//
// Grouped from the real APPLICATION_STATUSES values (src/types/index.ts) --
// never invented category names -- but counts are hand-authored sample
// numbers, clearly labeled "Sample", same convention as every other
// illustrative card on this page (HeroFreshFitCenterpiece, ChatPreviewCard).
const STATUS_GROUPS = [
  { label: 'In Progress', count: 3 },
  { label: 'In Review', count: 2 },
  { label: 'Interview', count: 1 },
  { label: 'Offer', count: 1 },
]

export function ApplicationsStatusPreview() {
  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-1.5">
        {STATUS_GROUPS.map(({ label, count }) => (
          <span
            key={label}
            className="flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-[#bac8d6]"
          >
            {label}
            <span className="rounded-full bg-white/15 px-1.5 text-[10px] font-semibold text-white">{count}</span>
          </span>
        ))}
      </div>
      <p className="mt-2 font-mono text-[10px] uppercase tracking-wide text-[#7ee4b6]/70">Sample</p>
    </div>
  )
}
