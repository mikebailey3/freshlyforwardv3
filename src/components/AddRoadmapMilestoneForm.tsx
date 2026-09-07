import { useEffect, useRef, useState } from 'react'
import { Plus, Loader2, AlertCircle } from 'lucide-react'
import { addRoadmapMilestone } from '@/lib/roadmap'
import type { CareerTimelineEvent } from '@/types'

interface AddRoadmapMilestoneFormProps {
  memberId: string
  onMilestoneAdded: (milestone: CareerTimelineEvent) => void
}

/**
 * Lets a strategist (or, if ever wired up for self-service, a member) log
 * a career_roadmap milestone via the add_roadmap_milestone RPC
 * (see src/lib/roadmap.ts). Kept as a small, standalone component so it
 * has its own focused test coverage rather than growing the already-large
 * StrategistMemberWorkspacePage.tsx further.
 */
export function AddRoadmapMilestoneForm({ memberId, onMilestoneAdded }: AddRoadmapMilestoneFormProps) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Kept stable across retries of the SAME draft (e.g. a network blip that
  // lost the response but not the write) so the server-side idempotency
  // check can recognize a retry and return the existing row instead of
  // creating a duplicate. Only cleared -- so the next milestone gets a
  // fresh key -- after a successful save or a Cancel.
  const idempotencyKeyRef = useRef<string | null>(null)

  // Defensive: if this component instance is ever reused across different
  // members without remounting (e.g. a parent that swaps memberId without
  // a per-member `key`), a half-finished draft's key must never bleed from
  // one member to another.
  useEffect(() => {
    idempotencyKeyRef.current = null
  }, [memberId])

  const reset = () => {
    setTitle('')
    setDescription('')
    setError(null)
    setOpen(false)
    idempotencyKeyRef.current = null
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)

    const trimmedTitle = title.trim()
    const trimmedDescription = description.trim()

    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = crypto.randomUUID()
    }

    try {
      const { milestone, error: saveError } = await addRoadmapMilestone({
        memberId,
        title: trimmedTitle,
        description: trimmedDescription || undefined,
        idempotencyKey: idempotencyKeyRef.current,
      })

      if (saveError || !milestone) {
        setError(saveError || 'Something went wrong saving this milestone.')
        return
      }

      onMilestoneAdded(milestone)
      reset()
    } catch (err) {
      // addRoadmapMilestone is designed to resolve with { error } rather
      // than throw, but a thrown/rejected call (network failure, an
      // unexpected exception) must still surface here instead of leaving
      // the spinner stuck with no visible error -- the exact silent
      // failure mode this whole repair exists to close.
      console.error('Unexpected error adding roadmap milestone:', err)
      setError('Something went wrong saving this milestone.')
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="mb-4 flex items-center gap-1.5 rounded-full border border-primary-600 px-4 py-2 text-sm font-semibold text-primary-600 hover:bg-primary-950"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        Add Roadmap Milestone
      </button>
    )
  }

  return (
    <div className="mb-4 border border-border bg-surface-card p-4">
      <label htmlFor="roadmap-milestone-title" className="block text-xs font-medium text-ink-muted">
        Title
      </label>
      <input
        id="roadmap-milestone-title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="mt-1 w-full border border-border px-3 py-2 text-sm"
        placeholder="e.g. Promotion review"
      />

      <label htmlFor="roadmap-milestone-description" className="mt-3 block text-xs font-medium text-ink-muted">
        Description (optional)
      </label>
      <textarea
        id="roadmap-milestone-description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="mt-1 w-full border border-border px-3 py-2 text-sm"
        rows={2}
      />

      {error && (
        <div role="alert" className="mt-3 flex items-center gap-2 border border-border bg-surface-hover p-2 text-sm text-error-400">
          <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || title.trim().length === 0}
          className="flex items-center gap-1.5 rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Save
        </button>
        <button type="button" onClick={reset} disabled={saving} className="text-sm text-ink-muted hover:underline disabled:opacity-50">
          Cancel
        </button>
      </div>
    </div>
  )
}
