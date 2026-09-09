import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AlertCircle, Loader2, Star } from 'lucide-react'
import { MemberLayout } from '@/components/MemberLayout'
import { useResumeEditorState } from '@/hooks/useResumeEditorState'
import { useAIResumeSuggestions } from '@/hooks/useAIResumeSuggestions'
import { ResumeVersionSectionsEditor } from '@/components/resumeIntelligence/ResumeVersionSectionsEditor'
import { ResumePreview } from '@/components/resumeIntelligence/ResumePreview'
import { ResumeExportButtons } from '@/components/resumeIntelligence/ResumeExportButtons'
import { AISuggestionsSection } from '@/components/resumeIntelligence/AISuggestionsSection'
import { useAuth } from '@/context/AuthContext'

/**
 * Phase 5 completion — the cohesive live Master/derived Resume Builder
 * page that Phase 5 shipped every underlying piece for but never
 * assembled: section/entry ordering, inclusion toggles, template
 * selection, summary/description overrides, live preview, PDF/DOCX
 * export, duplicate/archive, and (Phase 8) the AI proposal review loop
 * -- all for exactly one `resume_versions` row, Master or derived,
 * addressed by `:resumeVersionId`.
 *
 * All state/network logic lives in `useResumeEditorState` and
 * `useAIResumeSuggestions`; this component only renders what those
 * hooks expose (same discipline as `ResumeIntelligencePage`).
 */
export function ResumeBuilderPage() {
  const { resumeVersionId } = useParams<{ resumeVersionId: string }>()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const editor = useResumeEditorState(resumeVersionId ?? '')
  const ai = useAIResumeSuggestions(resumeVersionId ?? '')
  const [duplicateTitle, setDuplicateTitle] = useState('')
  const [confirmingArchive, setConfirmingArchive] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [saveConfirmed, setSaveConfirmed] = useState(false)

  if (!resumeVersionId || !user || !profile) {
    return (
      <MemberLayout>
        <p className="text-sm text-ink-muted">Sign in to open the Resume Builder.</p>
      </MemberLayout>
    )
  }

  if (editor.loading) {
    return (
      <MemberLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      </MemberLayout>
    )
  }

  if (editor.notFound || !editor.versionMeta) {
    return (
      <MemberLayout>
        <p className="text-sm text-ink-muted">
          This resume version was not found, does not belong to your account, or has been archived.
        </p>
      </MemberLayout>
    )
  }

  const { versionMeta } = editor
  const requestableFields = [
    { targetField: 'summary', label: 'Summary' },
    ...editor.state.entries
      .filter((e) => e.entryKind === 'employment' && e.included)
      .map((e) => ({ targetField: `employment_description:${e.canonicalEntryId}`, label: 'Bullet rewrite' })),
  ]
  const currentTextByField: Record<string, string> = { summary: editor.state.summaryOverride ?? editor.viewModel?.summary ?? '' }
  for (const entry of editor.state.entries) {
    if (entry.entryKind === 'employment') currentTextByField[`employment_description:${entry.canonicalEntryId}`] = entry.overrideDescription ?? ''
  }

  const handleSave = async () => {
    setActionError(null)
    setSaveConfirmed(false)
    const error = await editor.save()
    if (error) setActionError(error)
    else setSaveConfirmed(true)
  }

  const handleDuplicate = async () => {
    if (!duplicateTitle.trim()) {
      setActionError('Give the duplicate a title first.')
      return
    }
    setActionError(null)
    const result = await editor.duplicate(duplicateTitle.trim())
    if (result.error) setActionError(result.error)
    else if (result.newResumeVersionId) navigate(`/resume-intelligence/builder/${result.newResumeVersionId}`)
  }

  const handleArchive = async () => {
    setActionError(null)
    const error = await editor.archive()
    if (error) setActionError(error)
    else navigate('/resume-intelligence')
  }

  const handlePromote = async () => {
    setActionError(null)
    const error = await editor.promoteToMaster()
    if (error) setActionError(error)
  }

  return (
    <MemberLayout>
      <div className="max-w-6xl space-y-8">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-serif text-3xl font-semibold text-ink">{versionMeta.title}</h1>
            {versionMeta.isMaster && (
              <span className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-primary-600">
                <Star className="h-3.5 w-3.5 fill-primary-600" /> Master Resume
              </span>
            )}
          </div>
          {versionMeta.targetOpportunity && (
            <p className="mt-1 text-sm text-ink-muted">
              Tailored for {versionMeta.targetOpportunity.jobTitle} at {versionMeta.targetOpportunity.employer}
            </p>
          )}
          <p className="mt-2 text-sm text-ink-muted">
            {versionMeta.isMaster
              ? 'This is your comprehensive Master Resume. Tailored versions are created separately and never change what is stored here.'
              : 'This is a presentation-layer version. Editing it never changes your Career Profile or your Master Resume.'}
          </p>
        </div>

        {(editor.error || actionError) && (
          <div className="flex items-start gap-2 border border-error-700 border-l-4 border-l-error-600 bg-error-950 px-4 py-3 text-sm text-error-300">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{editor.error ?? actionError}</span>
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-2">
          <section>
            <h2 className="font-serif text-lg font-semibold text-ink">Edit</h2>
            <div className="mt-3">
              <ResumeVersionSectionsEditor state={editor.state} profile={profile} dispatch={editor.dispatch} />
            </div>
          </section>

          <section>
            <h2 className="font-serif text-lg font-semibold text-ink">Live preview</h2>
            <div className="mt-3 border border-border">{editor.viewModel && <ResumePreview viewModel={editor.viewModel} />}</div>
            {editor.viewModel && (
              <div className="mt-3">
                <ResumeExportButtons viewModel={editor.viewModel} fileBaseName={versionMeta.title.replace(/\s+/g, '_')} />
              </div>
            )}
          </section>
        </div>

        <section className="flex flex-wrap items-center gap-3 border-t border-border pt-6">
          <button type="button" disabled={editor.busy} onClick={handleSave} className="rounded-full bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60">
            {editor.busy ? 'Saving…' : 'Save changes'}
          </button>
          {saveConfirmed && !editor.state.dirty && <span className="text-xs text-ink-muted">Saved.</span>}
          {!versionMeta.isMaster && (
            <button type="button" disabled={editor.busy} onClick={handlePromote} className="border border-border px-4 py-2 text-xs font-medium text-ink-muted hover:bg-surface-hover disabled:opacity-60">
              Set as Master
            </button>
          )}
        </section>

        <section className="space-y-3 border-t border-border pt-6">
          <h2 className="font-serif text-lg font-semibold text-ink">Duplicate or archive this version</h2>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={duplicateTitle}
              onChange={(e) => setDuplicateTitle(e.target.value)}
              placeholder="Title for the duplicate"
              className="border border-border bg-surface-elevated px-3 py-1.5 text-sm text-ink"
            />
            <button type="button" disabled={editor.busy} onClick={handleDuplicate} className="border border-border px-3 py-1.5 text-xs font-medium text-ink-muted hover:bg-surface-hover disabled:opacity-60">
              Duplicate
            </button>
            {confirmingArchive ? (
              <>
                <span className="text-xs text-ink-muted">Archive this version? It will no longer appear in your active versions.</span>
                <button type="button" disabled={editor.busy} onClick={handleArchive} className="border border-error-700 bg-error-950 px-3 py-1.5 text-xs font-medium text-error-300 hover:bg-error-900 disabled:opacity-60">
                  Confirm archive
                </button>
                <button type="button" onClick={() => setConfirmingArchive(false)} className="text-xs text-ink-muted underline">
                  Cancel
                </button>
              </>
            ) : (
              <button type="button" disabled={editor.busy} onClick={() => setConfirmingArchive(true)} className="border border-border px-3 py-1.5 text-xs font-medium text-ink-muted hover:bg-surface-hover disabled:opacity-60">
                Archive
              </button>
            )}
          </div>
        </section>

        <section className="space-y-3 border-t border-border pt-6">
          <h2 className="font-serif text-lg font-semibold text-ink">AI suggestions</h2>
          <p className="text-xs text-ink-muted">Nothing here is applied automatically -- every suggestion requires your explicit accept, edit-then-accept, or reject.</p>
          <AISuggestionsSection
            suggestions={ai.suggestions}
            busy={ai.busy}
            unavailableMessage={ai.unavailableMessage}
            error={ai.error}
            requestableFields={requestableFields}
            currentTextByField={currentTextByField}
            onRequestSuggestion={(targetField) => {
              const evidence = [editor.viewModel?.summary ?? '', ...editor.state.entries.map((e) => e.overrideDescription ?? '')].filter(Boolean)
              ai.requestSuggestion(targetField, currentTextByField[targetField] ?? '', evidence, false)
            }}
            onDecide={ai.decide}
          />
        </section>
      </div>
    </MemberLayout>
  )
}
