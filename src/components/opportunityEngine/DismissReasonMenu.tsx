import { X } from 'lucide-react'
import { DISMISSAL_REASONS, DISMISSAL_REASON_LABELS, type DismissalReason } from '@/lib/opportunityEngine/dismissalReasons'

/**
 * OE 2.0 Phase 9 -- compact member-feedback picker shown when a member
 * dismisses a match. Deliberately a small inline panel, not a modal/
 * dialog: dismissing a match is a low-stakes, frequent action, and a
 * full modal would add real friction to what should stay a one- or
 * two-click action. "Skip, just dismiss" is always offered and always
 * first-class, never buried -- feedback is a bonus signal, never a
 * requirement to complete the action the member is already trying to do.
 */
export function DismissReasonMenu({
  onSelectReason,
  onSkip,
  onClose,
}: {
  onSelectReason: (reason: DismissalReason) => void
  onSkip: () => void
  onClose: () => void
}) {
  return (
    <div
      role="menu"
      aria-label="Why are you dismissing this match?"
      className="absolute right-4 top-14 z-10 w-64 rounded-xl border border-border bg-surface-card p-3 shadow-lg"
    >
      <div className="flex items-center justify-between">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Why dismiss this?</p>
        <button onClick={onClose} aria-label="Close" className="text-ink-muted transition-colors hover:text-ink">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="mt-2 flex flex-col gap-0.5">
        {DISMISSAL_REASONS.map((reason) => (
          <button
            key={reason}
            role="menuitem"
            onClick={() => onSelectReason(reason)}
            className="rounded-lg px-2 py-1.5 text-left text-xs text-ink transition-colors hover:bg-surface-hover"
          >
            {DISMISSAL_REASON_LABELS[reason]}
          </button>
        ))}
      </div>
      <button
        onClick={onSkip}
        className="mt-2 w-full rounded-lg px-2 py-1.5 text-center text-xs font-medium text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink"
      >
        Skip, just dismiss
      </button>
    </div>
  )
}
