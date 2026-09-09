import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createMasterResume } from './masterResume/createMasterResume'
import { fetchResumeVersionBuilderData } from './workflow/fetchResumeVersionBuilderData'
import { updateResumeVersionEntries } from './masterResume/updateResumeVersionEntries'
import { buildResumeViewModel } from './presentation/resumeViewModel'
import { exportResumePdfBuffer } from './export/pdf/pdfExportImpl'
import { exportResumeDocxBuffer } from './export/docx/exportResumeDocx'
import { fetchTailoringContext } from './tailoring/fetchTailoringContext'
import { analyzeTailoringFit } from './tailoring/analyzeTailoringFit'
import { createTailoredResumeVersion } from './tailoring/createTailoredResumeVersion'
import { CareerVaultEvidenceCoverageProvider } from './evidenceCoverage'
import { createResumeContentSuggestion, decideResumeContentSuggestion } from './ai/resumeContentSuggestions'
import type { ResumeAIContentProvider, ResumeAISuggestionResult } from './ai/resumeAIProvider'

/**
 * Phase 5-8 completion — end-to-end integration test for the full member
 * journey these four phases together are supposed to support, exercised
 * through the REAL library functions (never re-implemented/mocked
 * business logic) against one shared, purpose-built in-memory fake
 * Supabase client. UI components are intentionally out of scope here
 * (they already have their own RTL coverage) -- this proves the
 * underlying pipeline these pages/hooks call actually composes end to
 * end: Master Resume -> Builder edit -> Preview/Export -> Opportunity ->
 * Derived tailored Resume -> FreshFit fit check -> Career Vault evidence
 * -> AI proposal -> review decision.
 */

interface FakeRow {
  id: string
  [key: string]: unknown
}

const RESUME_VERSION_DEFAULTS = {
  is_archived: false,
  template_key: 'ats_classic',
  section_order: null,
  summary_override: null,
  target_opportunity_id: null,
  derived_from_resume_version_id: null,
  source_document_id: null,
}

const SUGGESTION_DEFAULTS = { status: 'pending', decision: null, decision_edited_value: null, decided_at: null }

function makeInMemoryClient() {
  const db: Record<string, FakeRow[]> = {
    member_profiles: [],
    resume_versions: [],
    resume_entries: [],
    opportunities: [],
    career_win_capabilities: [],
    resume_content_suggestions: [],
  }
  let idCounter = 1

  function nextId(prefix: string) {
    return `${prefix}-${idCounter++}`
  }

  function withDefaults(table: string, row: Record<string, unknown>): FakeRow {
    const defaults = table === 'resume_versions' ? RESUME_VERSION_DEFAULTS : table === 'resume_content_suggestions' ? SUGGESTION_DEFAULTS : {}
    return { id: nextId(table), ...defaults, ...row } as FakeRow
  }

  function makeBuilder(table: string) {
    const filters: [string, unknown][] = []
    let orderCol: string | null = null
    let mode: 'select' | 'insert' | 'update' = 'select'
    let payload: Record<string, unknown> | Record<string, unknown>[] | null = null

    function matches(row: FakeRow) {
      return filters.every(([col, val]) => row[col] === val)
    }

    function execute(): { data: unknown; error: null } {
      const rows = db[table] ?? []
      if (mode === 'insert') {
        const incoming = Array.isArray(payload) ? payload : [payload as Record<string, unknown>]
        const inserted = incoming.map((r) => withDefaults(table, r))
        db[table] = [...rows, ...inserted]
        return { data: Array.isArray(payload) ? inserted : inserted[0], error: null }
      }
      if (mode === 'update') {
        db[table] = rows.map((r) => (matches(r) ? { ...r, ...payload } : r))
        return { data: rows.filter(matches).map((r) => ({ ...r, ...payload })), error: null }
      }
      let result = rows.filter(matches)
      if (orderCol) result = [...result].sort((a, b) => (((a[orderCol as string] as number) ?? 0) - ((b[orderCol as string] as number) ?? 0)))
      return { data: result, error: null }
    }

    const builder = {
      select() { return builder },
      insert(rows: Record<string, unknown> | Record<string, unknown>[]) { mode = 'insert'; payload = rows; return builder },
      update(patch: Record<string, unknown>) { mode = 'update'; payload = patch; return builder },
      eq(col: string, val: unknown) { filters.push([col, val]); return builder },
      order(col: string) { orderCol = col; return builder },
      maybeSingle() { const r = execute(); const d = Array.isArray(r.data) ? (r.data[0] ?? null) : r.data; return Promise.resolve({ data: d, error: null }) },
      single() { const r = execute(); const d = Array.isArray(r.data) ? r.data[0] : r.data; return Promise.resolve({ data: d, error: null }) },
      then(resolve: (v: { data: unknown; error: null }) => unknown) { return Promise.resolve(execute()).then(resolve) },
    }
    return builder
  }

  const client = {
    from: (table: string) => makeBuilder(table),
    rpc: async (name: string, args: { p_resume_version_id: string; p_entries: Record<string, unknown>[] }) => {
      if (name === 'replace_resume_version_entries' || name === 'replace_master_resume_entries') {
        db.resume_entries = (db.resume_entries ?? []).filter((e) => e.resume_version_id !== args.p_resume_version_id)
        const inserted = (args.p_entries ?? []).map((e) => ({ id: nextId('entry'), ...e }))
        db.resume_entries = [...(db.resume_entries ?? []), ...inserted]
        return { data: null, error: null }
      }
      return { data: null, error: { message: `unhandled rpc in integration test fake: ${name}` } }
    },
  } as unknown as SupabaseClient

  return { client, db }
}

class FakeGroundedProvider implements ResumeAIContentProvider {
  suggest(): Promise<ResumeAISuggestionResult> {
    return Promise.resolve({
      available: true,
      proposedText: 'Led cross-functional engineering teams to ship customer-facing features.',
      evidenceReference: 'Led cross-functional engineering teams',
      reasoning: 'Reinforces leadership language already present in your Master Resume summary.',
    })
  }
}

describe('Resume Intelligence Phase 5-8 journey (integration)', () => {
  it('walks Master -> Builder edit -> Preview/Export -> Tailor -> FreshFit -> Evidence Coverage -> AI proposal -> review, end to end', async () => {
    const { client, db } = makeInMemoryClient()
    const userId = 'user-1'

    db.member_profiles.push({
      id: 'profile-1',
      user_id: userId,
      full_name: 'Jamie Rivera',
      summary: 'Engineering leader focused on reliable delivery.',
      phone: '555-1234',
      location: 'Remote',
      employment_history: [{ id: 'emp-1', title: 'Engineering Manager', company: 'Acme Co', description: 'Led cross-functional engineering teams.', start_date: '2020', end_date: null, current: true }],
      education: [],
      certifications: [],
      skills: ['sql', 'leadership', 'python'],
    })

    // 1. Master Resume created (comprehensive, canonical-truth-resolving).
    const { resumeVersionId: masterId, errors: createErrors } = await createMasterResume(
      userId,
      {
        title: 'Master Resume',
        entries: [
          { entryKind: 'employment', canonicalEntryId: 'emp-1', included: true, sortOrder: 0 },
          { entryKind: 'skill', skillValue: 'sql', included: true, sortOrder: 0 },
          { entryKind: 'skill', skillValue: 'leadership', included: true, sortOrder: 1 },
          { entryKind: 'skill', skillValue: 'python', included: false, sortOrder: 2 },
        ],
      },
      client,
    )
    expect(createErrors).toEqual([])
    expect(masterId).toBeTruthy()

    // 2. Builder loads the version (Master-awareness, generic read path).
    const builderData = await fetchResumeVersionBuilderData(userId, masterId as string, client)
    expect(builderData?.isMaster).toBe(true)
    expect(builderData?.entries).toHaveLength(4)

    // 3. Builder edit: use the generic (non-Master-restricted) write path to include python too.
    const editedEntries = (builderData?.entries ?? []).map((e) => (e.skillValue === 'python' ? { ...e, included: true } : e))
    const { errors: saveErrors } = await updateResumeVersionEntries(userId, masterId as string, editedEntries, client)
    expect(saveErrors).toEqual([])

    // 4. Preview: rebuild the view model from the saved state -- same shape export uses.
    const reloaded = await fetchResumeVersionBuilderData(userId, masterId as string, client)
    const viewModel = buildResumeViewModel({
      resumeVersionId: masterId as string,
      templateKey: reloaded?.templateKey ?? 'ats_classic',
      sectionOrder: reloaded?.sectionOrder ?? null,
      summaryOverride: reloaded?.summaryOverride ?? null,
      entries: reloaded?.entries ?? [],
      profile: {
        full_name: 'Jamie Rivera',
        email: 'jamie@example.com',
        phone: '555-1234',
        location: 'Remote',
        summary: 'Engineering leader focused on reliable delivery.',
        employment_history: db.member_profiles[0]!.employment_history as never,
        education: [],
        certifications: [],
      },
    })
    expect(viewModel.summary).toContain('Engineering leader')
    const skillsSection = viewModel.sections.find((s) => s.key === 'skills')
    expect(skillsSection?.entries.map((e) => e.primaryText).sort()).toEqual(['leadership', 'python', 'sql'])

    // 5. Export: PDF and DOCX both render from the exact same view model.
    const pdfBuffer = await exportResumePdfBuffer(viewModel)
    const docxBuffer = await exportResumeDocxBuffer(viewModel)
    expect(pdfBuffer.length).toBeGreaterThan(0)
    expect(docxBuffer.length).toBeGreaterThan(0)

    // 6. Opportunity exists; member wants to tailor toward it.
    db.opportunities.push({ id: 'opp-1', member_id: userId, job_title: 'Senior Backend Engineer', employer: 'Globex', full_job_description: 'Requires sql and leadership; javascript is a plus.' })

    const { context, error: contextError } = await fetchTailoringContext(userId, 'opp-1', client)
    expect(contextError).toBeNull()
    expect(context?.sourceResumeVersionId).toBe(masterId)

    // 7. FreshFit-reused fit check: honest three-bucket classification, never fabricated additions.
    const fit = analyzeTailoringFit(context!.jobText, context!.canonicalSkills, context!.includedResumeSkills)
    expect(fit.matchedIncluded.sort()).toEqual(['leadership', 'sql'])
    expect(fit.notOnFile.sort()).toEqual(['java', 'javascript'])

    // 8. Tailored derived version created -- Master untouched, lineage + opportunity link preserved.
    const { newResumeVersionId: tailoredId, error: tailorError } = await createTailoredResumeVersion(userId, context!.sourceResumeVersionId, 'opp-1', 'Master Resume — Tailored for Senior Backend Engineer', client)
    expect(tailorError).toBeNull()
    expect(tailoredId).not.toBe(masterId)
    const tailoredRow = db.resume_versions.find((v) => v.id === tailoredId)
    expect(tailoredRow?.target_opportunity_id).toBe('opp-1')
    expect(tailoredRow?.derived_from_resume_version_id).toBe(masterId)
    const masterStillHasFourEntries = db.resume_entries.filter((e) => e.resume_version_id === masterId)
    expect(masterStillHasFourEntries).toHaveLength(4) // duplication never mutated the source

    // 9. Career Vault evidence coverage: strong/weak/missing + reverse (evidence not on this resume).
    db.career_win_capabilities.push(
      { id: 'win-1', user_id: userId, skill_name: 'sql', status: 'confirmed' },
      { id: 'win-2', user_id: userId, skill_name: 'sql', status: 'confirmed' },
      { id: 'win-3', user_id: userId, skill_name: 'python', status: 'confirmed' },
    )
    const evidenceProvider = new CareerVaultEvidenceCoverageProvider(client)
    const evidenceResult = await evidenceProvider.score({ userId, claimedSkills: ['sql', 'leadership'] })
    expect(evidenceResult.status).toBe('scored')
    expect(evidenceResult.findings.some((f) => f.code === 'SKILL_STRONG_VAULT_EVIDENCE' && f.evidence === 'sql')).toBe(true)
    expect(evidenceResult.findings.some((f) => f.code === 'SKILL_MISSING_VAULT_EVIDENCE' && f.evidence === 'leadership')).toBe(true)
    expect(evidenceResult.findings.some((f) => f.code === 'VAULT_EVIDENCE_NOT_ON_RESUME' && f.evidence === 'python')).toBe(true)

    // 10. AI proposal: grounded suggestion persisted as pending, never auto-applied.
    const provider = new FakeGroundedProvider()
    const suggestionResult = await createResumeContentSuggestion(
      { userId, resumeVersionId: tailoredId as string, targetField: 'summary', currentText: 'Engineering leader focused on reliable delivery.', availableEvidence: ['Led cross-functional engineering teams.'] },
      provider,
      false,
      client,
    )
    expect(suggestionResult.error).toBeNull()
    expect(suggestionResult.skipped).toBe(false)
    const pendingRow = db.resume_content_suggestions.find((s) => s.id === suggestionResult.suggestionId)
    expect(pendingRow?.status).toBe('pending')

    // 11. Explicit member review decision -- accepted, but still never auto-applied to the resume content itself.
    const decisionResult = await decideResumeContentSuggestion(userId, suggestionResult.suggestionId as string, 'accept_as_canonical', undefined, client)
    expect(decisionResult.error).toBeNull()
    const decidedRow = db.resume_content_suggestions.find((s) => s.id === suggestionResult.suggestionId)
    expect(decidedRow?.status).toBe('reviewed')
    expect(decidedRow?.decision).toBe('accept_as_canonical')
    const tailoredEntriesUnchanged = db.resume_entries.filter((e) => e.resume_version_id === tailoredId)
    expect(tailoredEntriesUnchanged).toHaveLength(4) // accepting a suggestion recorded the decision only -- did not silently rewrite entries
  })
})
