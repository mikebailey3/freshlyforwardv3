import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { fetchPendingResumeContentSuggestions } from '@/lib/resumeIntelligence/ai/fetchPendingResumeContentSuggestions'
import type { PendingResumeContentSuggestion } from '@/lib/resumeIntelligence/ai/fetchPendingResumeContentSuggestions'
import { createResumeContentSuggestion, decideResumeContentSuggestion } from '@/lib/resumeIntelligence/ai/resumeContentSuggestions'
import { NullResumeAIContentProvider } from '@/lib/resumeIntelligence/ai/resumeAIProvider'
import type { ResumeAIContentProvider } from '@/lib/resumeIntelligence/ai/resumeAIProvider'
import type { ConfirmationDecision } from '@/types/resume'

/**
 * Phase 8 — orchestrates the AI suggestion request/review workflow for
 * one resume version, kept deliberately separate from
 * `useResumeEditorState` (single responsibility: that hook owns the
 * draft/save lifecycle, this one owns propose/review). Defaults to
 * `NullResumeAIContentProvider` -- see that class's doc comment for why
 * no real provider exists yet (no AI/LLM infrastructure of any kind is
 * configured anywhere in this codebase today; wiring one, e.g. via AI
 * Innovation Lab, is a deliberate later swap of this one constructor
 * argument, not a change to this hook, the review UI, or the grounding
 * gate).
 */
export function useAIResumeSuggestions(resumeVersionId: string, provider: ResumeAIContentProvider = new NullResumeAIContentProvider()) {
  const { user } = useAuth()
  const providerRef = useRef(provider)
  const [suggestions, setSuggestions] = useState<PendingResumeContentSuggestion[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unavailableMessage, setUnavailableMessage] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!user) return
    setSuggestions(await fetchPendingResumeContentSuggestions(user.id, resumeVersionId))
  }, [user, resumeVersionId])

  useEffect(() => {
    refresh()
  }, [refresh])

  const requestSuggestion = useCallback(
    async (targetField: string, currentText: string, availableEvidence: string[], isPurelyStylistic: boolean) => {
      if (!user) return
      setBusy(true)
      setError(null)
      setUnavailableMessage(null)
      try {
        const result = await createResumeContentSuggestion(
          { userId: user.id, resumeVersionId, targetField, currentText, availableEvidence },
          providerRef.current,
          isPurelyStylistic,
        )
        if (result.error) setError(result.error)
        else if (result.skipped) setUnavailableMessage('No AI suggestion is available for this field right now.')
        await refresh()
      } finally {
        setBusy(false)
      }
    },
    [user, resumeVersionId, refresh],
  )

  const decide = useCallback(
    async (suggestionId: string, decision: ConfirmationDecision, editedValue?: string) => {
      if (!user) return
      setBusy(true)
      setError(null)
      try {
        const result = await decideResumeContentSuggestion(user.id, suggestionId, decision, editedValue)
        if (result.error) setError(result.error)
        await refresh()
      } finally {
        setBusy(false)
      }
    },
    [user, refresh],
  )

  return { suggestions, busy, error, unavailableMessage, requestSuggestion, decide }
}
