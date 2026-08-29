import { Check } from 'lucide-react'

export interface ChecklistPreviewCardProps {
  label: string
  items: string[]
}

// Same card chrome as the rest of the preview-card family. Used wherever a
// step's visual is best shown as a short list of concrete outcomes rather
// than a conversation or a job listing.
export function ChecklistPreviewCard({ label, items }: ChecklistPreviewCardProps) {
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
        <ul className="mt-5 space-y-3">
          {items.map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-sm text-neutral-700">
              <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary-600" aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
