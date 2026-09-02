import type { MatchFilterState, MatchSortBy } from '@/lib/opportunityEngineFilters'
import type { PresentationTier } from '@/lib/opportunityEngineTiers'

/** Deliberately kept to 6 controls (sort, tier, location, remote,
 * salary-listed, new-this-week). Employment type filtering exists and is
 * fully tested in opportunityEngineFilters.ts, but is intentionally left
 * out of this bar for Phase 1 -- adding a 7th control here was judged too
 * likely to tip this into feeling busy, exactly the risk flagged during
 * design. Wiring it up later needs zero new logic, only a control here. */
function ToggleButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? 'border-primary-300 bg-primary-50 text-primary-700'
          : 'border-neutral-300 text-neutral-600 hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700'
      }`}
    >
      {children}
    </button>
  )
}

export function MatchFilterBar({
  filters,
  onChange,
}: {
  filters: MatchFilterState
  onChange: (next: MatchFilterState) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-1.5">
        <label htmlFor="oe-sort" className="text-xs font-medium text-neutral-600">Sort</label>
        <select
          id="oe-sort"
          value={filters.sortBy}
          onChange={(e) => onChange({ ...filters, sortBy: e.target.value as MatchSortBy })}
          className="rounded-lg border border-neutral-300 py-1.5 pl-2 pr-7 text-xs text-neutral-700"
        >
          <option value="score">FreshFit score</option>
          <option value="newest">Newest</option>
        </select>
      </div>

      <div className="flex items-center gap-1.5">
        <label htmlFor="oe-tier" className="text-xs font-medium text-neutral-600">Show</label>
        <select
          id="oe-tier"
          value={filters.minTier ?? ''}
          onChange={(e) => onChange({ ...filters, minTier: (e.target.value || undefined) as PresentationTier | undefined })}
          className="rounded-lg border border-neutral-300 py-1.5 pl-2 pr-7 text-xs text-neutral-700"
        >
          <option value="">All matches</option>
          <option value="stronger">Stronger fits &amp; up</option>
          <option value="highest">Highest fit only</option>
        </select>
      </div>

      <div className="flex items-center gap-1.5">
        <label htmlFor="oe-location" className="text-xs font-medium text-neutral-600">Location</label>
        <input
          id="oe-location"
          type="text"
          value={filters.locationText}
          onChange={(e) => onChange({ ...filters, locationText: e.target.value })}
          placeholder="e.g. Austin"
          className="w-32 rounded-lg border border-neutral-300 py-1.5 px-2 text-xs text-neutral-700"
        />
      </div>

      <ToggleButton active={filters.remoteOnly} onClick={() => onChange({ ...filters, remoteOnly: !filters.remoteOnly })}>
        Remote
      </ToggleButton>
      <ToggleButton active={filters.salaryListedOnly} onClick={() => onChange({ ...filters, salaryListedOnly: !filters.salaryListedOnly })}>
        Salary listed
      </ToggleButton>
      <ToggleButton active={filters.newThisWeekOnly} onClick={() => onChange({ ...filters, newThisWeekOnly: !filters.newThisWeekOnly })}>
        New this week
      </ToggleButton>
    </div>
  )
}
