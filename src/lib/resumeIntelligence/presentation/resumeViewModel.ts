import type { EmploymentEntry, EducationEntry, CertificationEntry } from '@/types'
import type { MasterResumeEntryInput } from '../masterResume/resumeEntryValidation'
import type { ResumeContactBlock, ResumeSectionKey, ResumeViewModel, ResumeViewModelEntry, ResumeViewModelSection } from './types'
import { DEFAULT_SECTION_LABELS, KNOWN_SECTION_KEYS } from './types'

export interface ResumeViewModelProfile {
  full_name: string | null
  email: string | null
  phone: string | null
  location: string | null
  summary: string | null
  employment_history: EmploymentEntry[]
  education: EducationEntry[]
  certifications: CertificationEntry[]
}

export interface BuildResumeViewModelInput {
  resumeVersionId: string
  templateKey: string
  /** Member-chosen section order. Unknown keys are dropped; missing known sections are appended in default order -- never crashes on bad input. */
  sectionOrder: string[] | null
  summaryOverride: string | null
  entries: MasterResumeEntryInput[]
  profile: ResumeViewModelProfile | null
}

function formatDateRange(start: string, end: string | null, current: boolean): string {
  const endLabel = current ? 'Present' : end ?? ''
  return [start, endLabel].filter(Boolean).join(' - ')
}

function resolveSectionOrder(requested: string[] | null): ResumeSectionKey[] {
  const valid = (requested ?? []).filter((key): key is ResumeSectionKey => KNOWN_SECTION_KEYS.includes(key as ResumeSectionKey))
  const missing = KNOWN_SECTION_KEYS.filter((key) => !valid.includes(key))
  return [...valid, ...missing]
}

function buildContact(profile: ResumeViewModelProfile | null): ResumeContactBlock {
  return {
    fullName: profile?.full_name ?? '',
    email: profile?.email ?? '',
    phone: profile?.phone ?? '',
    location: profile?.location ?? '',
  }
}

function buildEmploymentEntries(entries: MasterResumeEntryInput[], employmentHistory: EmploymentEntry[]): ResumeViewModelEntry[] {
  const byId = new Map(employmentHistory.filter((e) => e.id).map((e) => [e.id as string, e]))
  const out: ResumeViewModelEntry[] = []
  entries
    .filter((e) => e.entryKind === 'employment' && e.included)
    .forEach((entry, index) => {
      const canonical = entry.canonicalEntryId ? byId.get(entry.canonicalEntryId) : undefined
      if (!canonical) return // never fabricate a row for a reference that no longer resolves
      out.push({
        id: entry.canonicalEntryId as string,
        entryKind: 'employment',
        primaryText: canonical.title,
        secondaryText: canonical.company,
        dateRange: formatDateRange(canonical.start_date, canonical.end_date, canonical.current),
        description: entry.overrideDescription ?? canonical.description ?? '',
        sortOrder: entry.sortOrder ?? index,
      })
    })
  return out.sort((a, b) => a.sortOrder - b.sortOrder)
}

function buildEducationEntries(entries: MasterResumeEntryInput[], education: EducationEntry[]): ResumeViewModelEntry[] {
  const byId = new Map(education.filter((e) => e.id).map((e) => [e.id as string, e]))
  const out: ResumeViewModelEntry[] = []
  entries
    .filter((e) => e.entryKind === 'education' && e.included)
    .forEach((entry, index) => {
      const canonical = entry.canonicalEntryId ? byId.get(entry.canonicalEntryId) : undefined
      if (!canonical) return
      out.push({
        id: entry.canonicalEntryId as string,
        entryKind: 'education',
        primaryText: `${canonical.degree}${canonical.field ? `, ${canonical.field}` : ''}`,
        secondaryText: canonical.institution,
        dateRange: canonical.graduation_year ?? '',
        description: '', // education has no free-text field to override (locked, per Phase 3/4 handoff)
        sortOrder: entry.sortOrder ?? index,
      })
    })
  return out.sort((a, b) => a.sortOrder - b.sortOrder)
}

function buildCertificationEntries(entries: MasterResumeEntryInput[], certifications: CertificationEntry[]): ResumeViewModelEntry[] {
  const byId = new Map(certifications.filter((e) => e.id).map((e) => [e.id as string, e]))
  const out: ResumeViewModelEntry[] = []
  entries
    .filter((e) => e.entryKind === 'certification' && e.included)
    .forEach((entry, index) => {
      const canonical = entry.canonicalEntryId ? byId.get(entry.canonicalEntryId) : undefined
      if (!canonical) return
      out.push({
        id: entry.canonicalEntryId as string,
        entryKind: 'certification',
        primaryText: canonical.name,
        secondaryText: canonical.issuer,
        dateRange: canonical.date ?? '',
        description: '',
        sortOrder: entry.sortOrder ?? index,
      })
    })
  return out.sort((a, b) => a.sortOrder - b.sortOrder)
}

function buildSkillEntries(entries: MasterResumeEntryInput[]): ResumeViewModelEntry[] {
  return entries
    .filter((e) => e.entryKind === 'skill' && e.included && e.skillValue)
    .map((entry, index) => ({
      id: entry.skillValue as string,
      entryKind: 'skill' as const,
      primaryText: entry.skillValue as string,
      secondaryText: '',
      dateRange: '',
      description: '',
      sortOrder: entry.sortOrder ?? index,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

const SECTION_BUILDERS: Record<ResumeSectionKey, (entries: MasterResumeEntryInput[], profile: ResumeViewModelProfile | null) => ResumeViewModelEntry[]> = {
  employment: (entries, profile) => buildEmploymentEntries(entries, profile?.employment_history ?? []),
  education: (entries, profile) => buildEducationEntries(entries, profile?.education ?? []),
  certifications: (entries, profile) => buildCertificationEntries(entries, profile?.certifications ?? []),
  skills: (entries) => buildSkillEntries(entries),
}

/** Derives the normalized `ResumeViewModel` every template/preview/export renderer consumes. Never persists anything. */
export function buildResumeViewModel(input: BuildResumeViewModelInput): ResumeViewModel {
  const orderedKeys = resolveSectionOrder(input.sectionOrder)

  const sections: ResumeViewModelSection[] = orderedKeys
    .map((key) => ({
      key,
      label: DEFAULT_SECTION_LABELS[key],
      entries: SECTION_BUILDERS[key](input.entries, input.profile),
    }))
    .filter((section) => section.entries.length > 0)

  return {
    resumeVersionId: input.resumeVersionId,
    templateKey: input.templateKey,
    contact: buildContact(input.profile),
    summary: input.summaryOverride ?? input.profile?.summary ?? '',
    sections,
  }
}
