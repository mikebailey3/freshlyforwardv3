// Homepage Redesign Phase 1 / North Star fidelity pass, updated round 9:
// miniature product preview for the Career Vault flagship card. Career
// Vault is confirmed live for the homepage launch (owner sign-off, round
// 9) -- the earlier dimmed/blurred/locked "Coming Soon" overlay treatment
// is gone. Follows the same pattern as FlagshipOpportunityPreview.tsx: a
// small "Sample" caption plus real-UI-shaped rows, using generic asset
// labels rather than inventing specific fake dates or counts.
import { FileText, Award, Link2 } from 'lucide-react'

const VAULT_ROWS = [
  { icon: FileText, label: 'Resume -- Product Manager' },
  { icon: FileText, label: 'Cover Letter -- Draft' },
  { icon: Award, label: 'Career Win -- Q3 Launch' },
  { icon: Link2, label: 'LinkedIn Profile' },
]

export function FlagshipVaultPreview() {
  return (
    <div className="mt-4 space-y-2">
      <p className="font-mono text-[10px] uppercase tracking-wide text-[#7ee4b6]/70">Sample assets</p>
      {VAULT_ROWS.map(({ icon: Icon, label }) => (
        <div key={label} className="flex items-center gap-2 rounded-lg bg-white/5 px-2.5 py-2">
          <Icon size={14} className="flex-shrink-0 text-[#7ee4b6]" aria-hidden="true" />
          <p className="truncate text-xs text-[#bac8d6]">{label}</p>
        </div>
      ))}
    </div>
  )
}
