export interface KeyValueCardProps {
  label: string
  rows: { label: string; value: string }[]
}

// Extracted from HowItWorksPage's inline "Search Strategy" preview, which
// needed the identical shape again here for ServicesPage/WhyFreshlyForwardPage
// -- same card chrome as the rest of the FridayReportCard/OpportunityPreviewCard
// family (rounded-2xl/shadow-xl/colored top bar), generalized to any label +
// key/value rows instead of being hardcoded to search-strategy fields.
export function KeyValueCard({ label, rows }: KeyValueCardProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xl shadow-neutral-900/5">
      <div className="h-1.5 bg-primary-600" aria-hidden="true" />
      <div className="p-6 sm:p-7">
        <div className="flex items-center justify-between">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-primary-700">{label}</p>
          <span className="rounded-full border border-neutral-300 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-neutral-500">
            Sample
          </span>
        </div>
        <ul className="mt-5 space-y-4">
          {rows.map((row) => (
            <li key={row.label} className="border-t border-neutral-100 pt-4 first:border-t-0 first:pt-0">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-neutral-400">{row.label}</p>
              <p className="mt-1 text-sm text-neutral-800">{row.value}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
