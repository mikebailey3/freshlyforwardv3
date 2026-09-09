import { Star } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { ResumeVersionSummary } from '@/lib/resumeIntelligence/masterResume/listResumeVersions'

interface ResumeVersionsPanelProps {
  versions: ResumeVersionSummary[]
  busy: boolean
  onPromote: (resumeVersionId: string) => Promise<string | null> | void
}

/**
 * Phase 4 punch-list item #3: exposes `promoteResumeVersionToMaster`.
 * Phase 5-8 completion: also links each version into the live builder
 * (`/resume-intelligence/builder/:id`) -- this list now realistically
 * grows past just the Master once tailoring (Phase 6) creates derived
 * versions, which is exactly the general shape this was already written
 * against.
 */
export function ResumeVersionsPanel({ versions, busy, onPromote }: ResumeVersionsPanelProps) {
  if (versions.length === 0) return null

  return (
    <section>
      <h3 className="font-serif text-base font-semibold text-ink">Resume Versions</h3>
      <div className="mt-2 space-y-2">
        {versions.map((version) => (
          <div key={version.id} className="flex items-center justify-between border border-border bg-surface-card p-3">
            <div className="flex items-center gap-2">
              {version.isMaster && <Star className="h-4 w-4 fill-primary-600 text-primary-600" />}
              <span className="text-sm font-medium text-ink">{version.title}</span>
            </div>
            <div className="flex items-center gap-2">
              <Link to={`/resume-intelligence/builder/${version.id}`} className="border border-border px-3 py-1.5 text-xs font-medium text-ink-muted hover:bg-surface-hover">
                Open Builder
              </Link>
              {!version.isMaster && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onPromote(version.id)}
                  className="border border-border px-3 py-1.5 text-xs font-medium text-ink-muted hover:bg-surface-hover"
                >
                  Set as Master
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
