import type { EducationEntry, EmploymentEntry } from '@/types'

/**
 * What the deterministic Resume Intelligence analyzers read. Deliberately
 * built from the existing member_profiles-shaped types (EmploymentEntry,
 * EducationEntry) rather than a new competing shape — Resume Intelligence
 * never forks career-history data (locked decision).
 */
export interface ResumeContentInput {
  fullName: string
  email: string
  phone: string
  location: string
  summary: string
  employment: EmploymentEntry[]
  education: EducationEntry[]
  skills: string[]
}
