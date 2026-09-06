import { useState, type ChangeEvent, type FormEvent } from 'react'
import { submitMemberJob } from '@/lib/opportunityEngine'
import { validateJobSubmission, type JobSubmissionInput } from '@/lib/jobSubmission'
import { Loader2, X } from 'lucide-react'
import type { MemberProfile, JobMatchWithJob } from '@/types'

interface SubmitJobModalProps {
  profile: MemberProfile
  onClose: () => void
  onSubmitted: (match: JobMatchWithJob) => void
}

const EMPTY_INPUT: JobSubmissionInput = { title: '', company: '', location: '', salaryText: '', postingUrl: '', description: '' }

const FIELD_CLASS =
  'mt-1.5 w-full border border-border bg-surface-elevated px-4 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500'

export function SubmitJobModal({ profile, onClose, onSubmitted }: SubmitJobModalProps) {
  const [input, setInput] = useState<JobSubmissionInput>(EMPTY_INPUT)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const validation = validateJobSubmission(input)

  const update = (field: keyof JobSubmissionInput) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setInput((prev) => ({ ...prev, [field]: e.target.value }))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!validation.valid) return
    setSaving(true)
    setError(null)
    const { match, error: submitError } = await submitMemberJob(profile, input)
    setSaving(false)
    if (!match) {
      setError(submitError ?? 'Could not save that job. Please try again.')
      return
    }
    onSubmitted(match)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg border border-border bg-surface-card p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-lg font-semibold text-ink">Submit a Job</h2>
          <button onClick={onClose} aria-label="Close" className="p-1.5 text-ink-muted hover:bg-surface-hover hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-4 text-sm text-ink-muted">
          Found something on your own? Paste it in and we'll score it against your Career Profile the same way
          the Opportunity Engine does.
        </p>

        {error && <div className="mb-4 border border-error-600 bg-error-950 px-4 py-2.5 text-sm text-error-300">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="sj-title" className="block text-sm font-medium text-ink-muted">Job Title</label>
              <input id="sj-title" type="text" value={input.title} onChange={update('title')} required className={FIELD_CLASS} />
              {validation.errors.title && <p className="mt-1 text-xs text-error-400">{validation.errors.title}</p>}
            </div>
            <div>
              <label htmlFor="sj-company" className="block text-sm font-medium text-ink-muted">Company</label>
              <input id="sj-company" type="text" value={input.company} onChange={update('company')} required className={FIELD_CLASS} />
              {validation.errors.company && <p className="mt-1 text-xs text-error-400">{validation.errors.company}</p>}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="sj-location" className="block text-sm font-medium text-ink-muted">
                Location <span className="text-ink-muted">(optional)</span>
              </label>
              <input id="sj-location" type="text" value={input.location} onChange={update('location')} className={FIELD_CLASS} />
            </div>
            <div>
              <label htmlFor="sj-salary" className="block text-sm font-medium text-ink-muted">
                Salary <span className="text-ink-muted">(optional)</span>
              </label>
              <input id="sj-salary" type="text" value={input.salaryText} onChange={update('salaryText')} className={FIELD_CLASS} />
            </div>
          </div>

          <div>
            <label htmlFor="sj-url" className="block text-sm font-medium text-ink-muted">
              Posting URL <span className="text-ink-muted">(optional)</span>
            </label>
            <input id="sj-url" type="url" value={input.postingUrl} onChange={update('postingUrl')} placeholder="https://..." className={FIELD_CLASS} />
            {validation.errors.postingUrl && <p className="mt-1 text-xs text-error-400">{validation.errors.postingUrl}</p>}
          </div>

          <div>
            <label htmlFor="sj-desc" className="block text-sm font-medium text-ink-muted">Job Description</label>
            <textarea
              id="sj-desc" value={input.description} onChange={update('description')} required rows={5}
              placeholder="Paste the job description here so we can score it against your Career Profile."
              className={FIELD_CLASS}
            />
            {validation.errors.description && <p className="mt-1 text-xs text-error-400">{validation.errors.description}</p>}
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit" disabled={saving || !validation.valid}
              className="flex items-center gap-2 rounded-full bg-primary-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? 'Scoring…' : 'Submit & Score'}
            </button>
            <button
              type="button" onClick={onClose} disabled={saving}
              className="border border-border px-5 py-2.5 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-hover"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
