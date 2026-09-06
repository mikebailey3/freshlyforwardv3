import { useState } from 'react'
import type { EmploymentEntry } from '@/types'
import type { CareerScope } from '@/types/forwardDna'
import { dollarsToCents, centsToDollars } from '@/lib/forwardDna/scope'
import type { CareerScopeUpdate } from '@/lib/forwardDna/scope'

interface CareerScopeCardProps {
  entries: EmploymentEntry[]
  scope: CareerScope[]
  onSave: (employmentEntryId: string, updates: CareerScopeUpdate) => Promise<void>
}

export function CareerScopeCard({ entries, scope, onSave }: CareerScopeCardProps) {
  return (
    <div className="border border-border bg-surface-card p-6">
      <h3 className="font-serif text-base font-semibold text-ink">Professional Scope</h3>
      <p className="mt-1 text-xs text-ink-muted">The scale of what you've managed in each role.</p>
      <div className="mt-4 space-y-4">
        {entries.map((entry) => (
          <ScopeRow key={entry.id} entry={entry} existing={scope.find((s) => s.employment_entry_id === entry.id)} onSave={onSave} />
        ))}
      </div>
    </div>
  )
}

function ScopeRow({
  entry,
  existing,
  onSave,
}: {
  entry: EmploymentEntry
  existing: CareerScope | undefined
  onSave: CareerScopeCardProps['onSave']
}) {
  const [revenue, setRevenue] = useState(centsToDollars(existing?.revenue_managed_cents ?? null))
  const [budget, setBudget] = useState(centsToDollars(existing?.budget_managed_cents ?? null))
  const [teamSize, setTeamSize] = useState(existing?.team_size?.toString() ?? '')
  const [directReports, setDirectReports] = useState(existing?.direct_reports?.toString() ?? '')
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!entry.id) return
    setSaving(true)
    try {
      await onSave(entry.id, {
        revenue_managed_cents: dollarsToCents(revenue),
        budget_managed_cents: dollarsToCents(budget),
        team_size: teamSize ? Number(teamSize) : null,
        direct_reports: directReports ? Number(directReports) : null,
        notes: notes || null,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border-l-2 border-primary-700 pl-4">
      <p className="text-sm font-semibold text-ink">{entry.title} — {entry.company}</p>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-semibold text-ink-muted">Revenue managed ($)</span>
          <input type="text" value={revenue} onChange={(e) => setRevenue(e.target.value)} className="mt-1 w-full border border-border bg-surface-elevated px-3 py-2 text-sm text-ink placeholder:text-ink-muted" />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-ink-muted">Budget managed ($)</span>
          <input type="text" value={budget} onChange={(e) => setBudget(e.target.value)} className="mt-1 w-full border border-border bg-surface-elevated px-3 py-2 text-sm text-ink placeholder:text-ink-muted" />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-ink-muted">Team size</span>
          <input type="number" min="0" value={teamSize} onChange={(e) => setTeamSize(e.target.value)} className="mt-1 w-full border border-border bg-surface-elevated px-3 py-2 text-sm text-ink placeholder:text-ink-muted" />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-ink-muted">Direct reports</span>
          <input type="number" min="0" value={directReports} onChange={(e) => setDirectReports(e.target.value)} className="mt-1 w-full border border-border bg-surface-elevated px-3 py-2 text-sm text-ink placeholder:text-ink-muted" />
        </label>
      </div>
      <label className="mt-2 block">
        <span className="text-xs font-semibold text-ink-muted">Notes</span>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 w-full border border-border bg-surface-elevated px-3 py-2 text-sm text-ink placeholder:text-ink-muted" rows={2} />
      </label>
      <button onClick={handleSave} disabled={saving} className="mt-2 rounded-full bg-primary-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
        {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  )
}
