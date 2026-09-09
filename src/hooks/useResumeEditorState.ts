import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { fetchResumeVersionBuilderData } from '@/lib/resumeIntelligence/workflow/fetchResumeVersionBuilderData'
import type { ResumeVersionBuilderData } from '@/lib/resumeIntelligence/workflow/fetchResumeVersionBuilderData'
import { updateResumeVersionEntries } from '@/lib/resumeIntelligence/masterResume/updateResumeVersionEntries'
import { updateResumeLayout } from '@/lib/resumeIntelligence/masterResume/updateResumeLayout'
import { duplicateResumeVersion } from '@/lib/resumeIntelligence/masterResume/duplicateResumeVersion'
import { archiveResumeVersion } from '@/lib/resumeIntelligence/masterResume/archiveResumeVersion'
import { promoteResumeVersionToMaster } from '@/lib/resumeIntelligence/masterResume/promoteResumeVersionToMaster'
import { buildResumeViewModel } from '@/lib/resumeIntelligence/presentation/resumeViewModel'
import { resumeEditorReducer, initialResumeEditorState } from '@/lib/resumeIntelligence/presentation/resumeEditorReducer'
import type { ResumeEditorEntry } from '@/lib/resumeIntelligence/presentation/resumeEditorReducer'
import { KNOWN_SECTION_KEYS } from '@/lib/resumeIntelligence/presentation/types'
import type { ResumeViewModel } from '@/lib/resumeIntelligence/presentation/types'
import type { MasterResumeEntryInput } from '@/lib/resumeIntelligence/masterResume/resumeEntryValidation'

function entryToEditorEntry(entry: MasterResumeEntryInput): ResumeEditorEntry {
  const entryId = entry.entryKind === 'skill' ? `skill:${entry.skillValue}` : `${entry.entryKind}:${entry.canonicalEntryId}`
  return { ...entry, entryId }
}

function editorEntryToInput(entry: ResumeEditorEntry): MasterResumeEntryInput {
  const { entryId: _entryId, ...rest } = entry
  return rest
}

/**
 * Phase 5 completion — the hook `resumeEditorReducer.ts` always said
 * would exist (see that file's doc comment) but never did: wires the
 * pure reducer to real data for exactly one resume version (Master or
 * derived) and adds the explicit network calls (load/save/duplicate/
 * archive/promote) the reducer itself deliberately has none of.
 *
 * This is the ONE hook `ResumeBuilderPage` uses -- no other component
 * talks to Supabase directly for version-editing concerns. `save()`
 * always writes through `updateResumeVersionEntries`/`updateResumeLayout`
 * (the generic, non-Master-restricted paths), so this hook works
 * identically whether `resumeVersionId` is the active Master or a
 * tailored derivative -- exactly the "one cohesive experience" the
 * completion review asked for.
 */
export function useResumeEditorState(resumeVersionId: string) {
  const { user, profile } = useAuth()
  const [versionMeta, setVersionMeta] = useState<ResumeVersionBuilderData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [state, dispatch] = useReducer(resumeEditorReducer, initialResumeEditorState)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setNotFound(false)
    setError(null)
    const data = await fetchResumeVersionBuilderData(user.id, resumeVersionId)
    if (!data) {
      setNotFound(true)
      setLoading(false)
      return
    }
    setVersionMeta(data)
    dispatch({
      type: 'load',
      entries: data.entries.map(entryToEditorEntry),
      sectionOrder: data.sectionOrder ?? KNOWN_SECTION_KEYS,
      templateKey: data.templateKey,
      summaryOverride: data.summaryOverride,
    })
    setLoading(false)
  }, [user, resumeVersionId])

  useEffect(() => {
    load()
  }, [load])

  const viewModel: ResumeViewModel | null = useMemo(() => {
    if (!versionMeta || !profile) return null
    return buildResumeViewModel({
      resumeVersionId,
      templateKey: state.templateKey,
      sectionOrder: state.sectionOrder,
      summaryOverride: state.summaryOverride,
      entries: state.entries.map(editorEntryToInput),
      profile: {
        full_name: profile.full_name,
        // member_profiles has no email column -- the account's auth email is the correct source, same convention as analyzeMasterResume's caller.
        email: user?.email ?? null,
        phone: profile.phone,
        location: profile.location,
        summary: profile.summary,
        employment_history: profile.employment_history,
        education: profile.education,
        certifications: profile.certifications,
      },
    })
  }, [versionMeta, profile, user, state, resumeVersionId])

  const save = useCallback(async (): Promise<string | null> => {
    if (!user) return 'You must be signed in.'
    setBusy(true)
    setError(null)
    try {
      const entriesResult = await updateResumeVersionEntries(user.id, resumeVersionId, state.entries.map(editorEntryToInput))
      if (entriesResult.errors.length > 0) {
        setError(entriesResult.errors[0] as string)
        return entriesResult.errors[0] as string
      }
      const layoutResult = await updateResumeLayout(user.id, resumeVersionId, {
        sectionOrder: state.sectionOrder,
        templateKey: state.templateKey,
        summaryOverride: state.summaryOverride,
      })
      if (layoutResult.error) {
        setError(layoutResult.error)
        return layoutResult.error
      }
      dispatch({ type: 'markSaved' })
      await load()
      return null
    } finally {
      setBusy(false)
    }
  }, [user, resumeVersionId, state, load])

  const duplicate = useCallback(
    async (title: string) => {
      if (!user) return { newResumeVersionId: null, error: 'You must be signed in.' }
      setBusy(true)
      try {
        return await duplicateResumeVersion(user.id, resumeVersionId, title)
      } finally {
        setBusy(false)
      }
    },
    [user, resumeVersionId],
  )

  const archive = useCallback(async (): Promise<string | null> => {
    if (!user) return 'You must be signed in.'
    setBusy(true)
    try {
      const result = await archiveResumeVersion(user.id, resumeVersionId)
      return result.error
    } finally {
      setBusy(false)
    }
  }, [user, resumeVersionId])

  const promoteToMaster = useCallback(async (): Promise<string | null> => {
    setBusy(true)
    try {
      const { error: rpcError } = await promoteResumeVersionToMaster(resumeVersionId)
      if (!rpcError) await load()
      return rpcError
    } finally {
      setBusy(false)
    }
  }, [resumeVersionId, load])

  return { loading, notFound, busy, error, state, dispatch, versionMeta, viewModel, save, duplicate, archive, promoteToMaster, reload: load }
}
