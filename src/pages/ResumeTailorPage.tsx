import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AlertCircle, Loader2 } from 'lucide-react'
import { MemberLayout } from '@/components/MemberLayout'
import { useAuth } from '@/context/AuthContext'
import { fetchTailoringContext } from '@/lib/resumeIntelligence/tailoring/fetchTailoringContext'
import type { TailoringContext } from '@/lib/resumeIntelligence/tailoring/fetchTailoringContext'
import { analyzeTailoringFit } from '@/lib/resumeIntelligence/tailoring/analyzeTailoringFit'
import type { TailoringFitResult } from '@/lib/resumeIntelligence/tailoring/analyzeTailoringFit'
import { createTailoredResumeVersion } from '@/lib/resumeIntelligence/tailoring/createTailoredResumeVersion'

/**
 * Phase 6 completion — the member-facing tailoring entry point that was
 * missing: `analyzeTailoringFit`/`createTailoredResumeVersion` existed
 * with no UI reachable from anywhere. Always tailors FROM the active
 * Master Resume (locked: Master is comprehensive canonical truth,
 * tailoring never starts from an already-narrowed version), and the fit
 * breakdown is purely informational -- creating the tailored version is
 * always the member's own explicit action.
 */
export function ResumeTailorPage() {
  const { opportunityId } = useParams<{ opportunityId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [context, setContext] = useState<TailoringContext | null>(null)
  const [fit, setFit] = useState<TailoringFitResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    if (!user || !opportunityId) return
    setLoading(true)
    setError(null)
    const { context: loaded, error: loadError } = await fetchTailoringContext(user.id, opportunityId)
    if (loadError || !loaded) {
      setError(loadError)
      setLoading(false)
      return
    }
    setContext(loaded)
    setFit(analyzeTailoringFit(loaded.jobText, loaded.canonicalSkills, loaded.includedResumeSkills))
    setLoading(false)
  }, [user, opportunityId])

  useEffect(() => {
    load()
  }, [load])

  const handleCreate = async () => {
    if (!user || !context) return
    setCreating(true)
    setError(null)
    const result = await createTailoredResumeVersion(user.id, context.sourceResumeVersionId, context.opportunityId, `${context.sourceResumeTitle} — Tailored for ${context.jobTitle}`)
    setCreating(false)
    if (result.error || !result.newResumeVersionId) {
      setError(result.error ?? 'Could not create the tailored resume version.')
      return
    }
    navigate(`/resume-intelligence/builder/${result.newResumeVersionId}`)
  }

  if (!user) {
    return (
      <MemberLayout>
        <p className="text-sm text-ink-muted">Sign in to tailor a resume for this opportunity.</p>
      </MemberLayout>
    )
  }

  if (loading) {
    return (
      <MemberLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      </MemberLayout>
    )
  }

  return (
    <MemberLayout>
      <div className="max-w-3xl space-y-8">
        <div>
          <h1 className="font-serif text-3xl font-semibold text-ink">Tailor your resume</h1>
          {context && <p className="mt-2 text-sm text-ink-muted">For {context.jobTitle} at {context.employer}, starting from "{context.sourceResumeTitle}".</p>}
        </div>

        {error && (
          <div className="flex items-start gap-2 border border-error-700 border-l-4 border-l-error-600 bg-error-950 px-4 py-3 text-sm text-error-300">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {fit && (
          <div className="space-y-4">
            <FitList title="Already on this resume" description="These skills from the job description are already included." skills={fit.matchedIncluded} />
            <FitList title="On your Career Profile, not yet included" description="These are true of you (from your canonical Profile) but not turned on for this resume version -- safe to include." skills={fit.matchedNotIncluded} />
            <FitList title="Honest gaps" description="These appear in the job description but are not on your Career Profile at all. We never fabricate these onto your resume." skills={fit.notOnFile} />
          </div>
        )}

        {context && (
          <button
            type="button"
            disabled={creating}
            onClick={handleCreate}
            className="rounded-full bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
          >
            {creating ? 'Creating…' : 'Create tailored resume'}
          </button>
        )}
      </div>
    </MemberLayout>
  )
}

function FitList({ title, description, skills }: { title: string; description: string; skills: string[] }) {
  if (skills.length === 0) return null
  return (
    <section className="border border-border bg-surface-card p-4">
      <h2 className="font-serif text-base font-semibold text-ink">{title}</h2>
      <p className="mt-1 text-xs text-ink-muted">{description}</p>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {skills.map((skill) => (
          <li key={skill} className="border border-border px-2 py-0.5 text-xs text-ink-muted">{skill}</li>
        ))}
      </ul>
    </section>
  )
}
