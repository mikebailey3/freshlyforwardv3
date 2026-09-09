import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase as defaultClient } from '@/lib/supabase'
import { computeResumeIntelligence } from '@/lib/resumeIntelligence'
import type { ResumeContentInput } from '@/lib/resumeIntelligence/types'
import type { EvidenceCoverageProvider, ResumeIntelligenceResult, TargetRoleAlignmentProvider } from '@/types/resume'
import type { CertificationEntry, EducationEntry, EmploymentEntry } from '@/types'

export interface AnalyzeMasterResumeOptions {
  userId: string
  /**
   * member_profiles has no email column (a known, documented Phase 2
   * limitation) -- the caller passes the member's email from their own
   * auth session rather than this reading/writing a column that doesn't
   * exist.
   */
  email: string
  targetRole?: string | null
  opportunityId?: string | null
  alignmentProvider?: TargetRoleAlignmentProvider
  evidenceProvider?: EvidenceCoverageProvider
}

export interface AnalyzeMasterResumeResult {
  result: ResumeIntelligenceResult | null
  error: string | null
}

interface ResumeEntryRow {
  entry_kind: 'employment' | 'education' | 'certification' | 'skill'
  canonical_entry_id: string | null
  skill_value: string | null
  included: boolean
  sort_order: number | null
  override_description: string | null
}

interface MemberProfileRow {
  full_name: string | null
  phone: string | null
  location: string | null
  summary: string | null
  employment_history: EmploymentEntry[]
  education: EducationEntry[]
  certifications: CertificationEntry[]
  skills: string[]
}

/**
 * Wires the Phase 1 six-dimension engine to a real Master Resume: the
 * analysis input is canonical Profile content filtered/ordered/overridden
 * by this resume version's resume_entries selections -- never the raw
 * Profile alone (a member's Master Resume can legitimately select only
 * some of their Profile's content).
 *
 * Known limitation: resume-specific overrides for fields other than an
 * employment entry's description (a resume-specific `summary_override`,
 * per-entry overrides for education/certification, which have no
 * free-text field to override in the first place) have no persistence
 * layer yet -- `resume-specific` proposal destinations are confirmed but
 * never written anywhere by `applyConfirmedProposals` (by design, Phase
 * 2's locked boundary). Until that lands, `summary` here is always the
 * canonical `member_profiles.summary`.
 */
export async function analyzeMasterResume(
  options: AnalyzeMasterResumeOptions,
  client: SupabaseClient = defaultClient,
): Promise<AnalyzeMasterResumeResult> {
  const { data: master } = await client
    .from('resume_versions')
    .select('id')
    .eq('member_id', options.userId)
    .eq('is_master', true)
    .eq('is_archived', false)
    .maybeSingle()

  if (!master) {
    return { result: null, error: 'No active Master Resume exists yet for this member.' }
  }

  const resumeVersionId = (master as { id: string }).id

  const [{ data: entriesData }, { data: profileData }] = await Promise.all([
    client.from('resume_entries').select('entry_kind, canonical_entry_id, skill_value, included, sort_order, override_description').eq('resume_version_id', resumeVersionId),
    client.from('member_profiles').select('full_name, phone, location, summary, employment_history, education, certifications, skills').eq('user_id', options.userId).maybeSingle(),
  ])

  const entries = (entriesData ?? []) as ResumeEntryRow[]
  const profile = profileData as MemberProfileRow | null

  const content = buildResumeContentInput(options.email, profile, entries)

  const result = await computeResumeIntelligence(content, {
    userId: options.userId,
    targetRole: options.targetRole ?? null,
    opportunityId: options.opportunityId ?? null,
    alignmentProvider: options.alignmentProvider,
    evidenceProvider: options.evidenceProvider,
  })

  return { result, error: null }
}

function buildResumeContentInput(email: string, profile: MemberProfileRow | null, entries: ResumeEntryRow[]): ResumeContentInput {
  const selected = (kind: ResumeEntryRow['entry_kind']) =>
    entries
      .filter((e) => e.entry_kind === kind && e.included)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

  const employment = selected('employment')
    .map((row) => {
      const canonical = profile?.employment_history.find((entry) => entry.id === row.canonical_entry_id)
      if (!canonical) return null
      return row.override_description ? { ...canonical, description: row.override_description } : canonical
    })
    .filter((e): e is EmploymentEntry => !!e)

  const education = selected('education')
    .map((e) => profile?.education.find((entry) => entry.id === e.canonical_entry_id))
    .filter((e): e is EducationEntry => !!e)

  const certifications = selected('certification')
    .map((e) => profile?.certifications.find((entry) => entry.id === e.canonical_entry_id))
    .filter((e): e is CertificationEntry => !!e)

  const skills = selected('skill')
    .map((e) => e.skill_value)
    .filter((v): v is string => !!v)

  return {
    fullName: profile?.full_name ?? '',
    email,
    phone: profile?.phone ?? '',
    location: profile?.location ?? '',
    summary: profile?.summary ?? '',
    employment,
    education,
    certifications,
    skills,
  }
}
