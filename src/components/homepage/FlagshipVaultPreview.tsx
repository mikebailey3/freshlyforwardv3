// Homepage Redesign Phase 1 / North Star fidelity pass: miniature product
// preview for the Career Vault flagship card. Unlike the Opportunity Engine
// and FreshFit previews, this must NOT look like a populated, currently-
// working feature -- Career Vault has no real table/route yet (see the
// locked spec decision #1). So the row shell is real UI language (matches
// what a vault list would look like) but every row is dimmed/greyed with no
// specific fake dates or counts, and a clear "Coming Soon" overlay sits on
// top -- reproducing the reference's visual density without claiming the
// feature is live today.
import { FileText, Award, Link2, Lock } from 'lucide-react'

const VAULT_ROW_ICONS = [FileText, FileText, Link2, Award]

export function FlagshipVaultPreview() {
  return (
    <div className="relative mt-4 overflow-hidden rounded-lg bg-white/5 p-3">
      <div className="space-y-2 opacity-35 blur-[1px]" aria-hidden="true">
        {VAULT_ROW_ICONS.map((Icon, index) => (
          <div key={index} className="flex items-center gap-2 rounded bg-white/5 px-2 py-1.5">
            <Icon size={14} className="text-[#bac8d6]" />
            <div className="h-2 flex-1 rounded-full bg-white/15" />
          </div>
        ))}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-[var(--navy-soft)]/70">
        <Lock size={18} className="text-[#7ee4b6]" aria-hidden="true" />
        <p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-[#7ee4b6]">Coming Soon</p>
      </div>
    </div>
  )
}
