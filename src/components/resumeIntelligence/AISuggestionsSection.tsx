import { Loader2, Sparkles } from 'lucide-react'
import { AIProposalReviewPanel } from './AIProposalReviewPanel'
import type { PendingResumeContentSuggestion } from '@/lib/resumeIntelligence/ai/fetchPendingResumeContentSuggestions'
import type { ConfirmationDecision } from '@/types/resume'

export interface RequestableAIField {
  targetField: string
  label: string
}

interface AISuggestionsSectionProps {
  suggestions: PendingResumeContentSuggestion[]
  busy: boolean
  unavailableMessage: string | null
  error: string | null
  requestableFields: RequestableAIField[]
  currentTextByField: Record<string, string>
  onRequestSuggestion: (targetField: string) => void
  onDecide: (suggestionId: string, decision: ConfirmationDecision, editedValue?: string) => void
}

/**
 * Phase 8 — the member-facing container for the whole propose/review
 * loop on one resume version. Purely presentational (no Supabase calls);
 * `useAIResumeSuggestions` supplies everything here as props, same
 * convention as `ImportReviewPanel`/`onDecide`. Required live proposal
 * types (bullet rewrite, summary proposal, target-role wording) are all
 * just different `targetField` values through this one generic path --
 * no per-type UI branching needed.
 */
export function AISuggestionsSection({ suggestions, busy, unavailableMessage, error, requestableFields, currentTextByField, onRequestSuggestion, onDecide }: AISuggestionsSectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {requestableFields.map((field) => (
          <button
            key={field.targetField}
            type="button"
            disabled={busy}
            onClick={() => onRequestSuggestion(field.targetField)}
            className="flex items-center gap-1.5 border border-border px-3 py-1.5 text-xs font-medium text-ink-muted hover:bg-surface-hover disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Get AI suggestion: {field.label}
          </button>
        ))}
      </div>

      {unavailableMessage && <p className="text-xs text-ink-muted">{unavailableMessage}</p>}
      {error && <p className="text-xs text-error-300">{error}</p>}

      {suggestions.length === 0 ? (
        <p className="text-xs text-ink-muted">No pending AI suggestions to review.</p>
      ) : (
        <div className="space-y-3">
          {suggestions.map((suggestion) => (
            <AIProposalReviewPanel
              key={suggestion.id}
              suggestion={suggestion}
              currentText={currentTextByField[suggestion.targetField] ?? ''}
              busy={busy}
              onDecide={(decision, editedValue) => onDecide(suggestion.id, decision, editedValue)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
