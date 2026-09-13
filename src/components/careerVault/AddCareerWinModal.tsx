import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { X, Loader2 } from 'lucide-react'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { DeterministicCareerWinInterpreter } from '@/lib/careerVault/deterministicInterpreter'
import { inferCapabilities } from '@/lib/careerVault/capabilityEngine'
import { createCareerWin } from '@/lib/careerVault/careerWins'
import { confirmCapabilities } from '@/lib/careerVault/capabilities'
import type { CareerWin, MetricType } from '@/types/careerVault'
import type { EmploymentEntry } from '@/types'

interface AddCareerWinModalProps {
  userId: string
  employmentEntries: EmploymentEntry[]
  onClose: () => void
  onSaved: (careerWin: CareerWin) => void
}

interface SuggestionRow {
  skillName: string
  reason: string | null
  source: 'system' | 'member'
  checked: boolean
}

const interpreter = new DeterministicCareerWinInterpreter()

const FIELD_CLASS =
  'mt-1.5 w-full border border-border bg-surface-elevated px-4 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500'

export function AddCareerWinModal({ userId, employmentEntries, onClose, onSaved }: AddCareerWinModalProps) {
  const [step, setStep] = useState<'input' | 'review'>('input')
  const [statement, setStatement] = useState('')
  const [employmentEntryId, setEmploymentEntryId] = useState('')
  const [metric, setMetric] = useState<{ type: MetricType; value: number; raw: string } | null>(null)
  const [keepMetric, setKeepMetric] = useState(true)
  const [category, setCategory] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<SuggestionRow[]>([])
  const [newCapability, setNewCapability] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Tracks a career win that was already persisted by a previous Save
  // attempt, so a retry after a confirmCapabilities failure re-attempts
  // ONLY the capability confirmation, not createCareerWin again (fix round
  // 2 -- without this, retrying created a second, permanently-orphaned
  // career_wins row for the same statement, since createCareerWin has no
  // idempotency key and the button re-enables after a partial failure).
  const [savedWin, setSavedWin] = useState<CareerWin | null>(null)

  const handleContinue = async (e: FormEvent) => {
    e.preventDefault()
    if (!statement.trim()) return
    const interpreted = await interpreter.interpret(statement)
    setMetric(
      interpreted.metricValue !== null && interpreted.metricType !== null && interpreted.metricRaw !== null
        ? { type: interpreted.metricType, value: interpreted.metricValue, raw: interpreted.metricRaw }
        : null
    )
    setCategory(interpreted.category)
    setSuggestions(
      inferCapabilities(statement).map((s) => ({ skillName: s.skillName, reason: s.reason, source: 'system', checked: true }))
    )
    setStep('review')
  }

  const toggleSuggestion = (skillName: string) =>
    setSuggestions((prev) => prev.map((s) => (s.skillName === skillName ? { ...s, checked: !s.checked } : s)))

  const addMemberCapability = () => {
    const name = newCapability.trim()
    if (!name || suggestions.some((s) => s.skillName.toLowerCase() === name.toLowerCase())) return
    setSuggestions((prev) => [...prev, { skillName: name, reason: null, source: 'member', checked: true }])
    setNewCapability('')
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)

    let careerWin = savedWin
    if (!careerWin) {
      const { careerWin: created, error: winError } = await createCareerWin(userId, {
        originalStatement: statement,
        employmentEntryId: employmentEntryId || null,
        evidenceType: 'accomplishment',
        category,
        metricType: keepMetric ? metric?.type ?? null : null,
        metricValue: keepMetric ? metric?.value ?? null : null,
        metricRaw: keepMetric ? metric?.raw ?? null : null,
      })
      if (!created) {
        setSaving(false)
        setError(winError ?? 'Could not save that Career Win. Please try again.')
        return
      }
      careerWin = created
      setSavedWin(created)
    }

    const checked = suggestions.filter((s) => s.checked)
    if (checked.length > 0) {
      const { error: confirmError } = await confirmCapabilities(
        userId,
        checked.map((s) => ({ careerWinId: careerWin.id, skillName: s.skillName, source: s.source, inferenceReason: s.reason }))
      )
      if (confirmError) {
        // The win is safely saved and tracked in `savedWin` -- clicking Save
        // again will retry ONLY this confirmCapabilities call (idempotent
        // per Task 6's docstring), not create a second win.
        setSaving(false)
        setError('Your Career Win was saved, but some capabilities could not be confirmed. Please try Save again.')
        return
      }
    }
    setSaving(false)
    onSaved(careerWin)
  }

  const dialogRef = useRef<HTMLDivElement>(null)
  useFocusTrap(dialogRef, true)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, saving])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cw-modal-title"
        className="w-full max-w-lg border border-border bg-surface-card p-6 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="cw-modal-title" className="font-serif text-lg font-semibold text-ink">Add a Career Win</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="p-1.5 text-ink-muted hover:bg-surface-hover hover:text-ink disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div role="alert" className="mb-4 border border-error-700 bg-error-950 px-4 py-2.5 text-sm text-error-300">
            {error}
          </div>
        )}

        {step === 'input' && (
          <form onSubmit={handleContinue} className="space-y-4">
            <div>
              <label htmlFor="cw-statement" className="block text-sm font-medium text-ink-muted">What happened?</label>
              <textarea
                id="cw-statement"
                autoFocus
                value={statement}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setStatement(e.target.value)}
                required
                rows={4}
                placeholder="e.g. Reduced inventory loss by $31,000 by redesigning the receiving process."
                className={FIELD_CLASS}
              />
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={!statement.trim()}
                className="rounded-full bg-primary-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-60"
              >
                Continue
              </button>
              <button
                type="button"
                onClick={onClose}
                className="border border-border px-5 py-2.5 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-hover"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {step === 'review' && (
          <div className="space-y-4">
            <div className="border border-border bg-surface-subtle p-3 text-sm text-ink-muted">{statement}</div>

            {metric && (
              <label className="flex items-center gap-2 text-sm text-ink-muted">
                <input
                  type="checkbox"
                  checked={keepMetric}
                  onChange={() => setKeepMetric((v) => !v)}
                  disabled={!!savedWin}
                  aria-label={`Include this metric: ${metric.raw}`}
                />
                Detected: <span className="font-medium text-ink">{metric.raw}</span>
                {savedWin && <span className="text-xs text-ink-muted"> (locked in -- already saved)</span>}
              </label>
            )}

            {category && <p className="text-xs text-ink-muted">Category: {category}</p>}

            <div>
              <p className="mb-2 text-sm font-medium text-ink-muted">This may demonstrate:</p>
              <div className="space-y-2">
                {suggestions.map((s) => (
                  <label key={s.skillName} className="flex items-start gap-2 text-sm text-ink-muted">
                    <input
                      type="checkbox"
                      checked={s.checked}
                      onChange={() => toggleSuggestion(s.skillName)}
                      disabled={!!savedWin}
                      className="mt-0.5"
                    />
                    <span>{s.skillName}</span>
                  </label>
                ))}
              </div>
              {savedWin && (
                <p className="mt-1 text-xs text-ink-muted">
                  Once saved, these can't be adjusted here -- adding a new one below is still fine.
                </p>
              )}
              <div className="mt-2 flex gap-2">
                <label htmlFor="cw-new-capability" className="sr-only">Add another capability</label>
                <input
                  id="cw-new-capability"
                  type="text"
                  value={newCapability}
                  onChange={(e) => setNewCapability(e.target.value)}
                  placeholder="Add another capability"
                  className={FIELD_CLASS}
                />
                <button
                  type="button"
                  onClick={addMemberCapability}
                  className="border border-border px-4 py-2.5 text-sm font-medium text-ink-muted hover:bg-surface-hover"
                >
                  Add
                </button>
              </div>
            </div>

            {employmentEntries.length > 0 && (
              <div>
                <label htmlFor="cw-entry" className="block text-sm font-medium text-ink-muted">
                  Role <span className="text-ink-muted">(optional)</span>
                </label>
                <select
                  id="cw-entry"
                  value={employmentEntryId}
                  onChange={(e) => setEmploymentEntryId(e.target.value)}
                  disabled={!!savedWin}
                  className={FIELD_CLASS}
                >
                  <option value="">Not tied to a specific role</option>
                  {employmentEntries.map((entry) => (
                    <option key={entry.id} value={entry.id}>{entry.title} at {entry.company}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 rounded-full bg-primary-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-60"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {saving ? 'Saving\u2026' : 'Save'}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="border border-border px-5 py-2.5 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-hover"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
