import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { MemberProfile } from '@/types'

interface CareerGoalsCardProps {
  profile: MemberProfile
  onSaveTargets: (targetRole: string, targetTimeframe: string) => Promise<void>
}

export function CareerGoalsCard({ profile, onSaveTargets }: CareerGoalsCardProps) {
  const [targetRole, setTargetRole] = useState(profile.target_role ?? '')
  const [targetTimeframe, setTargetTimeframe] = useState(profile.target_timeframe ?? '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSaveTargets(targetRole, targetTimeframe)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border border-border bg-surface-card p-6">
      <h3 className="font-serif text-base font-semibold text-ink">Career Goals</h3>
      <p className="mt-1 text-xs text-ink-muted">
        {profile.career_goals || 'No career goals recorded yet.'}{' '}
        <Link to="/profile?edit=1&focus=goals" className="text-primary-600 hover:underline">
          Edit in Career Profile
        </Link>
      </p>
      <div className="mt-4 space-y-3">
        <label className="block">
          <span className="text-xs font-semibold text-ink-muted">Target role</span>
          <input type="text" value={targetRole} onChange={(e) => setTargetRole(e.target.value)} className="mt-1 w-full border border-border bg-surface-elevated px-3 py-2 text-sm text-ink placeholder:text-ink-muted" />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-ink-muted">Target timeframe</span>
          <input type="text" value={targetTimeframe} onChange={(e) => setTargetTimeframe(e.target.value)} placeholder="e.g. within 12 months" className="mt-1 w-full border border-border bg-surface-elevated px-3 py-2 text-sm text-ink placeholder:text-ink-muted" />
        </label>
        <button onClick={handleSave} disabled={saving} className="rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}
