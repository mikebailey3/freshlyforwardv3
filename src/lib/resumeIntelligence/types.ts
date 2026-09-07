import type { CertificationEntry, EducationEntry, EmploymentEntry } from '@/types'

/**
 * What the deterministic Resume Intelligence analyzers read. Deliberately
 * built from the existing member_profiles-shaped types (EmploymentEntry,
 * EducationEntry, CertificationEntry) rather than a new competing shape —
 * Resume Intelligence never forks career-history data (locked decision).
 * `certifications` has a real, existing canonical source:
 * `member_profiles.certifications` (`20260802172349_phase3_membership_system.sql`),
 * already surfaced on CareerProfilePage.tsx -- this was previously flagged
 * as "unconfirmed" in the Phase 1 report, which was incorrect; it's
 * confirmed and simply hadn't been added to this input shape yet.
 */
export interface ResumeContentInput {
  fullName: string
  email: string
  phone: string
  location: string
  summary: string
  employment: EmploymentEntry[]
  education: EducationEntry[]
  certifications: CertificationEntry[]
  skills: string[]
}
