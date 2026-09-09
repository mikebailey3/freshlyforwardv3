import type { ResumeEntryKind } from '@/types/resume'

/**
 * Shared entry-selection validation, extracted from `createMasterResume.ts`
 * (Phase 4) so `updateMasterResumeEntries.ts` can reuse the exact same
 * enforcement boundary rather than re-implementing it -- DRY, and there is
 * only one place that decides whether a requested entry selection actually
 * exists in a member's current canonical Profile.
 *
 * `resume_entries.canonical_entry_id`/`skill_value` cannot be a foreign key
 * (Postgres cannot reference an element of a jsonb array) -- this validation
 * step is the real enforcement boundary the migration's design notes
 * describe. See `createMasterResume.ts` for the fuller explanation.
 */
export interface MasterResumeEntryInput {
  entryKind: ResumeEntryKind
  /** Required for entryKind employment/education/certification -- must exist in the member's current Profile. */
  canonicalEntryId?: string
  /** Required for entryKind 'skill' -- must be present in member_profiles.skills. */
  skillValue?: string
  included: boolean
  sortOrder: number | null
  overrideDescription?: string | null
}

export interface MemberProfileArrays {
  employment_history: { id?: string }[]
  education: { id?: string }[]
  certifications: { id?: string }[]
  skills: string[]
}

export function validateEntries(
  entries: MasterResumeEntryInput[],
  profile: MemberProfileArrays | null,
): { validEntries: MasterResumeEntryInput[]; errors: string[] } {
  const errors: string[] = []
  const validEntries: MasterResumeEntryInput[] = []

  const idsByKind: Record<'employment' | 'education' | 'certification', Set<string>> = {
    employment: new Set((profile?.employment_history ?? []).map((e) => e.id).filter((id): id is string => !!id)),
    education: new Set((profile?.education ?? []).map((e) => e.id).filter((id): id is string => !!id)),
    certification: new Set((profile?.certifications ?? []).map((e) => e.id).filter((id): id is string => !!id)),
  }
  const skillValues = new Set(profile?.skills ?? [])

  for (const entry of entries) {
    if (entry.entryKind === 'skill') {
      if (!entry.skillValue || !skillValues.has(entry.skillValue)) {
        errors.push(`Skill '${entry.skillValue}' is not present in this member's current Profile skills -- refusing to reference it.`)
        continue
      }
    } else {
      if (!entry.canonicalEntryId || !idsByKind[entry.entryKind].has(entry.canonicalEntryId)) {
        errors.push(`${entry.entryKind} entry '${entry.canonicalEntryId}' does not exist in this member's current Profile -- refusing to reference it.`)
        continue
      }
    }
    validEntries.push(entry)
  }

  return { validEntries, errors }
}

/** Flattens a validated MasterResumeEntryInput into a resume_entries row, matching the migration exactly. */
export function entryInputToRow(resumeVersionId: string, entry: MasterResumeEntryInput): Record<string, unknown> {
  return {
    resume_version_id: resumeVersionId,
    entry_kind: entry.entryKind,
    canonical_entry_id: entry.canonicalEntryId ?? null,
    skill_value: entry.skillValue ?? null,
    included: entry.included,
    sort_order: entry.sortOrder,
    override_description: entry.overrideDescription ?? null,
  }
}
