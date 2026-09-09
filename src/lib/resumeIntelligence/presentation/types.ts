/**
 * Phase 5 — the normalized resume view model. Every template, the live
 * preview, and both export renderers (PDF/DOCX) consume this and only
 * this — never `member_profiles` or `resume_entries` directly. This is
 * the "one shape, many renderers" contract the master plan requires.
 *
 * Locked: this is a pure DERIVATION. Nothing here is persisted; building
 * a view model never writes anything. It never duplicates career truth —
 * every string here is either a literal canonical field, a literal
 * resume-specific override already saved via `updateMasterResumeEntries`/
 * `updateResumeLayout`, or a formatted composite (e.g. a date range) of
 * canonical fields.
 */

export type ResumeSectionKey = 'employment' | 'education' | 'certifications' | 'skills'

export const KNOWN_SECTION_KEYS: ResumeSectionKey[] = ['employment', 'education', 'certifications', 'skills']

export const DEFAULT_SECTION_LABELS: Record<ResumeSectionKey, string> = {
  employment: 'Experience',
  education: 'Education',
  certifications: 'Certifications',
  skills: 'Skills',
}

export interface ResumeContactBlock {
  fullName: string
  email: string
  phone: string
  location: string
}

export interface ResumeViewModelEntry {
  /** canonicalEntryId for employment/education/certification, skillValue for skill. Never regenerated, never array position. */
  id: string
  entryKind: 'employment' | 'education' | 'certification' | 'skill'
  primaryText: string
  secondaryText: string
  dateRange: string
  /** Resume-specific override if set, else the canonical description. Empty string for kinds with no free-text field (education/certification/skill). */
  description: string
  sortOrder: number
}

export interface ResumeViewModelSection {
  key: ResumeSectionKey
  label: string
  entries: ResumeViewModelEntry[]
}

export interface ResumeViewModel {
  resumeVersionId: string
  templateKey: string
  contact: ResumeContactBlock
  summary: string
  /** Non-empty sections only, already in the member's chosen (or default) order. */
  sections: ResumeViewModelSection[]
}
