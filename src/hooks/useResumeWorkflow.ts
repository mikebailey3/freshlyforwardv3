import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { fetchResumeWorkflowSnapshot } from '@/lib/resumeIntelligence/workflow/fetchResumeWorkflowSnapshot'
import { computeResumeWorkflowStage } from '@/lib/resumeIntelligence/workflow/resumeWorkflowStage'
import type { ResumeWorkflowSnapshot } from '@/lib/resumeIntelligence/workflow/fetchResumeWorkflowSnapshot'
import type { ResumeWorkflowStage } from '@/lib/resumeIntelligence/workflow/resumeWorkflowStage'
import { importResumeDocument } from '@/lib/resumeIntelligence/import/importResumeDocument'
import { recordProposalDecision } from '@/lib/resumeIntelligence/import/reviewProposals'
import type { ProposalRow } from '@/lib/resumeIntelligence/import/reviewProposals'
import { createMasterResume } from '@/lib/resumeIntelligence/masterResume/createMasterResume'
import { updateMasterResumeEntries } from '@/lib/resumeIntelligence/masterResume/updateMasterResumeEntries'
import { setMasterResumeSummaryOverride } from '@/lib/resumeIntelligence/masterResume/masterResumeOverrides'
import { promoteResumeVersionToMaster } from '@/lib/resumeIntelligence/masterResume/promoteResumeVersionToMaster'
import { listResumeVersions } from '@/lib/resumeIntelligence/masterResume/listResumeVersions'
import { fetchMasterResumeEntries } from '@/lib/resumeIntelligence/masterResume/fetchMasterResumeEntries'
import { analyzeMasterResume } from '@/lib/resumeIntelligence/masterResume/analyzeMasterResume'
import type { MasterResumeEntryInput } from '@/lib/resumeIntelligence/masterResume/resumeEntryValidation'
import type { ResumeVersionSummary } from '@/lib/resumeIntelligence/masterResume/listResumeVersions'
import type { ConfirmationDecision, ResumeIntelligenceResult } from '@/types/resume'
import type { ImportResult } from '@/lib/resumeIntelligence/import/types'

/**
 * Phase 4: the one place that orchestrates the whole Resume Intelligence
 * member workflow (upload -> import -> review -> Master Resume -> promote
 * -> analyze). Every actual read/write lives in `src/lib/resumeIntelligence/`
 * (already unit-tested in isolation, DI'd against a fake Supabase client);
 * this hook's only job is wiring those calls to React state and refreshing
 * the snapshot afterward -- no business rule lives here that isn't already
 * covered by a lib-level test.
 */
export function useResumeWorkflow() {
  const { user } = useAuth()
  const [snapshot, setSnapshot] = useState<ResumeWorkflowSnapshot | null>(null)
  const [versions, setVersions] = useState<ResumeVersionSummary[]>([])
  const [existingEntries, setExistingEntries] = useState<MasterResumeEntryInput[]>([])
  const [analysis, setAnalysis] = useState<ResumeIntelligenceResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!user) return
    const [nextSnapshot, nextVersions] = await Promise.all([
      fetchResumeWorkflowSnapshot(user.id),
      listResumeVersions(user.id),
    ])
    setSnapshot(nextSnapshot)
    setVersions(nextVersions)
    setExistingEntries(nextSnapshot.masterResumeVersionId ? await fetchMasterResumeEntries(nextSnapshot.masterResumeVersionId) : [])
  }, [user])

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }
    refresh().finally(() => setLoading(false))
  }, [user, refresh])

  const stage: ResumeWorkflowStage = snapshot
    ? computeResumeWorkflowStage({
        hasResumeDocument: snapshot.hasResumeDocument,
        hasImportAttempt: snapshot.hasImportAttempt,
        pendingProposalCount: snapshot.pendingProposalCount,
        hasMaster: snapshot.hasMaster,
        hasAnalysisResult: analysis !== null,
      })
    : 'no_document'

  const runWithBusyState = useCallback(async (fn: () => Promise<string | null>) => {
    setBusy(true)
    setError(null)
    try {
      const errorMessage = await fn()
      if (errorMessage) setError(errorMessage)
      await refresh()
      return errorMessage
    } finally {
      setBusy(false)
    }
  }, [refresh])

  const uploadAndImportResume = useCallback(
    (file: File) => runWithBusyState(async () => {
      if (!user) return 'You must be signed in to upload a resume.'
      const fileName = `${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
      const { error: uploadError } = await supabase.storage.from('member-documents').upload(fileName, file)
      if (uploadError) return `Upload failed: ${uploadError.message}`

      const { data: doc, error: insertError } = await supabase
        .from('member_documents')
        .insert({ user_id: user.id, document_type: 'resume', file_name: file.name, file_path: fileName, file_size: file.size, mime_type: file.type })
        .select('id')
        .single()
      if (insertError || !doc) return `Could not record the upload: ${insertError?.message ?? 'unknown error'}`

      const result: ImportResult = await importResumeDocument(user.id, (doc as { id: string }).id)
      if (result.status.kind === 'extraction_failed' || result.status.kind === 'parsing_failed') return result.status.reason
      if (result.status.kind === 'unsupported_format') return `Unsupported file format: ${result.status.mimeType}`
      if (result.status.kind === 'missing_source_document') return 'Could not find the uploaded document.'
      return null
    }),
    [user, runWithBusyState],
  )

  const decideProposal = useCallback(
    (row: ProposalRow, decision: ConfirmationDecision, editedValue?: string) => runWithBusyState(async () => {
      if (!user) return 'You must be signed in.'
      const { errors } = await recordProposalDecision(user.id, row, decision, editedValue)
      if (errors.length === 0 && decision === 'use_as_resume_specific_only' && row.destination_field === 'summary_override' && snapshot?.hasMaster) {
        const overrideText = editedValue ?? row.candidate_value
        const overrideResult = await setMasterResumeSummaryOverride(user.id, overrideText)
        if (overrideResult.error) return overrideResult.error
      }
      return errors[0] ?? null
    }),
    [user, runWithBusyState, snapshot?.hasMaster],
  )

  const saveMasterResume = useCallback(
    (title: string, entries: MasterResumeEntryInput[]) => runWithBusyState(async () => {
      if (!user) return 'You must be signed in.'
      if (snapshot?.masterResumeVersionId) {
        const { errors } = await updateMasterResumeEntries(user.id, snapshot.masterResumeVersionId, entries)
        return errors[0] ?? null
      }
      const { errors } = await createMasterResume(user.id, { title, sourceDocumentId: snapshot?.latestResumeDocumentId ?? null, entries })
      return errors[0] ?? null
    }),
    [user, runWithBusyState, snapshot?.masterResumeVersionId, snapshot?.latestResumeDocumentId],
  )

  const promoteToMaster = useCallback(
    (resumeVersionId: string) => runWithBusyState(async () => {
      const { error: rpcError } = await promoteResumeVersionToMaster(resumeVersionId)
      return rpcError
    }),
    [runWithBusyState],
  )

  const setSummaryOverride = useCallback(
    (overrideText: string | null) => runWithBusyState(async () => {
      if (!user) return 'You must be signed in.'
      const { error: overrideError } = await setMasterResumeSummaryOverride(user.id, overrideText)
      return overrideError
    }),
    [user, runWithBusyState],
  )

  const runAnalysis = useCallback(
    async (targetRole?: string | null) => {
      if (!user?.email) {
        setError('Your account has no email on file -- cannot run analysis.')
        return
      }
      setBusy(true)
      setError(null)
      const { result, error: analysisError } = await analyzeMasterResume({ userId: user.id, email: user.email, targetRole: targetRole ?? null })
      if (analysisError) setError(analysisError)
      setAnalysis(result)
      setBusy(false)
    },
    [user],
  )

  return {
    loading,
    busy,
    error,
    stage,
    snapshot,
    versions,
    existingEntries,
    analysis,
    uploadAndImportResume,
    decideProposal,
    saveMasterResume,
    promoteToMaster,
    setSummaryOverride,
    runAnalysis,
    refresh,
  }
}
