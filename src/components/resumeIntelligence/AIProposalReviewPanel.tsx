import { useState } from 'react'
import { Check, Loader2, Pencil, X } from 'lucide-react'
import type { PendingResumeContentSuggestion } from '@/lib/resumeIntelligence/ai/fetchPendingResumeContentSuggestions'
import type { ConfirmationDecision } from '@/types/resume'

interface AIProposalReviewPanelProps {
  suggestion: PendingResumeContentSuggestion
  /** The field's current literal text, for the required "current wording" vs. "proposed wording" comparison. */
  currentText: string
  busy: boolean
  onDecide: (decision: ConfirmationDecision, editedValue?: string) => Promise<void> | void
}

/**
 * Phase 8 — the member-facing AI proposal review UI. Shows current
 * wording, proposed wording, supporting evidence/provenance, and the
 * recommendation reason side by side, then requires an explicit
 * accept / edit-then-accept / reject decision -- nothing here ever
 * applies a suggestion automatically. Purely presentational (no
 * Supabase calls) so it is trivially testable and reusable regardless
 * of which field/version it is reviewing.
 */
export function AIProposalReviewPanel({ suggestion, currentText, busy, onDecide }: AIProposalReviewPanelProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(suggestion.proposedText)

  return (
    <div className="space-y-3 border border-border bg-surface-card p-4" data-testid={`ai-proposal-${suggestion.id}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Suggested change: {suggestion.targetField}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium text-ink-muted">Current wording</p>
          <p className="mt-1 border-l-2 border-border pl-2 text-sm text-ink-muted">{currentText || '(empty)'}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-ink-muted">Proposed wording</p>
          {editing ? (
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              className="mt-1 w-full border border-border bg-surface-elevated px-2 py-1.5 text-sm text-ink"
            />
          ) : (
            <p className="mt-1 border-l-2 border-primary-600 pl-2 text-sm text-ink">{suggestion.proposedText}</p>
          )}
        </div>
      </div>

      {suggestion.reasoning && (
        <p className="text-xs text-ink-muted"><span className="font-medium">Why this was suggested:</span> {suggestion.reasoning}</p>
      )}
      <p className="text-xs text-ink-muted">
        <span className="font-medium">Supporting evidence:</span> {suggestion.evidenceReference ?? 'None (purely stylistic wording change -- no new facts).'}
      </p>

      <div className="flex flex-wrap gap-2 border-t border-border pt-3">
        {editing ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => onDecide('accept_edited_canonical', draft)}
            className="flex items-center gap-1.5 rounded-full bg-primary-600 px-4 py-2 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Save edit and accept
          </button>
        ) : (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => onDecide('accept_as_canonical')}
              className="flex items-center gap-1.5 rounded-full bg-primary-600 px-4 py-2 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Accept
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 border border-border px-4 py-2 text-xs font-medium text-ink-muted hover:bg-surface-hover disabled:opacity-60"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit then accept
            </button>
          </>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => onDecide('reject')}
          className="flex items-center gap-1.5 border border-error-700 bg-error-950 px-4 py-2 text-xs font-medium text-error-300 hover:bg-error-900 disabled:opacity-60"
        >
          <X className="h-3.5 w-3.5" />
          Reject
        </button>
      </div>
    </div>
  )
}
