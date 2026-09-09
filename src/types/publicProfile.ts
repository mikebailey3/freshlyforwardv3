/**
 * Forward Profiles (public, `/u/:username`) -- distinct from the existing
 * PRIVATE "Forward Profile" identity layer (CareerProfilePage/ForwardDnaPage
 * marketing name). See docs/superpowers/plans/2026-09-09-forward-profiles-implementation.md
 * section 0 for the naming disambiguation.
 *
 * This module intentionally does NOT import anything from
 * `resumeIntelligence/` -- visibility here is its own concept sourced from
 * canonical `member_profiles` fields, not tied to any resume version's
 * lifecycle (see plan section 4).
 */

import type { EmploymentEntry, EducationEntry, CertificationEntry } from '@/types/index'

/** Matches the section-key vocabulary already established by Resume
 * Intelligence's ResumeSectionKey for naming consistency, plus two
 * public-profile-only keys (`summary`, `career_goals`). */
export type PublicProfileSectionKey =
  | 'summary'
  | 'employment'
  | 'education'
  | 'certifications'
  | 'skills'
  | 'career_goals'

export const PUBLIC_PROFILE_SECTION_KEYS: PublicProfileSectionKey[] = [
  'summary',
  'employment',
  'education',
  'certifications',
  'skills',
  'career_goals',
]

export type PublicProfileSections = Record<PublicProfileSectionKey, boolean>

/** Default visibility for a brand-new public profile: everything on except
 * career_goals (aspirational/reflective free text some members may consider
 * private -- deliberately off by default per the plan's §3 recommendation). */
export const DEFAULT_PUBLIC_PROFILE_SECTIONS: PublicProfileSections = {
  summary: true,
  employment: true,
  education: true,
  certifications: true,
  skills: true,
  career_goals: false,
}

/**
 * Normalized, camelCase shape returned by getPublicProfileByUsername().
 * Deliberately flat (not a generic ResumeViewModel-style sections array) --
 * a public profile only ever needs these fixed categories, so a generic
 * "sections" abstraction would be unused indirection (YAGNI). Every field
 * here is either a literal allow-listed canonical field or null/empty when
 * the corresponding section is toggled off -- see the public_forward_profiles
 * view, which already omits hidden-section content server-side.
 */
export interface PublicProfileViewModel {
  username: string
  avatarUrl: string | null
  fullName: string | null
  headline: string | null
  location: string | null
  linkedinUrl: string | null
  portfolioUrl: string | null
  summary: string | null
  employment: EmploymentEntry[]
  education: EducationEntry[]
  certifications: CertificationEntry[]
  skills: string[]
  careerGoals: string | null
}
