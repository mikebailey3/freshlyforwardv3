import type { SupabaseClient } from '@supabase/supabase-js'
import { generateEntryId } from '@/lib/profile/entryIds'
import type { CertificationEntry, EducationEntry, EmploymentEntry } from '@/types'
import type { ProposalDestination, ResumeFieldProposal } from '@/types/resume'

/**
 * Phase 4: the one write path Phase 2/3 deliberately never built (see
 * `applyConfirmedProposals.ts`'s doc comment and the Phase 3 handoff §6.7)
 * -- accepting a parsed `canonical-profile-array` proposal (a brand-new or
 * updated employment/education/certification/skill entry) as canonical.
 *
 * Known, documented limitation: the deterministic parser (Phase 2) never
 * splits an employment/education block into structured fields (company vs.
 * title vs. dates) -- `candidateValue` is the raw joined block text. Rather
 * than fabricate a guess at that split (this codebase's anti-fabrication
 * discipline applies here just as much as to provenance), every candidate's
 * literal text is preserved verbatim in the one existing free-text field
 * closest to it (`description` for employment, `degree` for education,
 * `name` for certification), with the remaining structured fields left
 * blank for the member to fill in afterward via the existing Career Profile
 * editor. Skills have no structural ambiguity -- a skill's identity is its
 * own string value -- so they round-trip exactly.
 */
export async function applyCanonicalArrayWrite(
  userId: string,
  proposal: ResumeFieldProposal,
  action: 'accept_as_canonical' | 'accept_edited_canonical',
  editedValue: string | undefined,
  client: SupabaseClient,
): Promise<string | null> {
  if (proposal.destination.kind !== 'canonical-profile-array') {
    return `applyCanonicalArrayWrite called with a non-array destination for proposal ${proposal.id}.`
  }
  const { field, index } = proposal.destination

  // A no-op means the parser found the candidate already matches the
  // Profile -- correct behavior is to do nothing, not to error.
  if (proposal.proposedAction === 'no-op-already-present') return null

  if (action === 'accept_edited_canonical' && editedValue === undefined) {
    return `Decision 'accept_edited_canonical' for proposal ${proposal.id} requires an editedValue.`
  }
  const value = action === 'accept_edited_canonical' ? (editedValue as string) : proposal.candidateValue

  const { data: profile, error: readError } = await client
    .from('member_profiles')
    .select('employment_history, education, certifications, skills')
    .eq('user_id', userId)
    .maybeSingle()

  if (readError || !profile) {
    return `Failed to load Career Profile for proposal ${proposal.id}: ${readError?.message ?? 'profile not found'}`
  }

  const profileRow = profile as ProfileArrays

  if (field === 'skills') {
    return writeSkills(userId, profileRow, index, value, proposal, client)
  }

  return writeStructuredArray(userId, field, profileRow, index, value, proposal, client)
}

interface ProfileArrays {
  employment_history: EmploymentEntry[]
  education: EducationEntry[]
  certifications: CertificationEntry[]
  skills: string[]
}

async function writeSkills(
  userId: string,
  profile: ProfileArrays,
  index: (ProposalDestination & { kind: 'canonical-profile-array' })['index'],
  value: string,
  proposal: ResumeFieldProposal,
  client: SupabaseClient,
): Promise<string | null> {
  const skills = [...profile.skills]

  if (proposal.proposedAction === 'create') {
    if (index !== 'append') {
      return `Cannot create a new skill at a fixed index for proposal ${proposal.id} -- new skills are always appended.`
    }
    if (skills.includes(value)) return null // already present -- nothing to do, not an error
    skills.push(value)
  } else if (proposal.proposedAction === 'update') {
    if (index === 'append' || index < 0 || index >= skills.length) {
      return `Cannot update skill for proposal ${proposal.id}: referenced index does not exist in this member's current Profile.`
    }
    skills[index] = value
  } else {
    return `Unsupported proposedAction '${proposal.proposedAction}' for a skill write on proposal ${proposal.id}.`
  }

  const { error } = await client.from('member_profiles').update({ skills }).eq('user_id', userId)
  return error ? `Failed to write skills for proposal ${proposal.id}: ${error.message}` : null
}

type StructuredArrayField = 'employment_history' | 'education' | 'certifications'

async function writeStructuredArray(
  userId: string,
  field: StructuredArrayField,
  profile: ProfileArrays,
  index: (ProposalDestination & { kind: 'canonical-profile-array' })['index'],
  value: string,
  proposal: ResumeFieldProposal,
  client: SupabaseClient,
): Promise<string | null> {
  const entries = [...profile[field]] as Array<EmploymentEntry | EducationEntry | CertificationEntry>

  if (proposal.proposedAction === 'create') {
    if (index !== 'append') {
      return `Cannot create a new ${field} entry at a fixed index for proposal ${proposal.id} -- new entries are always appended.`
    }
    entries.push(buildEntryFromText(field, value))
  } else if (proposal.proposedAction === 'update') {
    if (index === 'append' || index < 0 || index >= entries.length) {
      return `Cannot update ${field} entry for proposal ${proposal.id}: referenced entry does not exist in this member's current Profile.`
    }
    entries[index] = mergeTextIntoEntry(field, entries[index], value)
  } else {
    return `Unsupported proposedAction '${proposal.proposedAction}' for a ${field} write on proposal ${proposal.id}.`
  }

  const { error } = await client.from('member_profiles').update({ [field]: entries }).eq('user_id', userId)
  return error ? `Failed to write canonical field '${field}' for proposal ${proposal.id}: ${error.message}` : null
}

function buildEntryFromText(field: StructuredArrayField, text: string): EmploymentEntry | EducationEntry | CertificationEntry {
  const id = generateEntryId()
  if (field === 'employment_history') {
    return { id, company: '', title: '', start_date: '', end_date: null, current: false, description: text }
  }
  if (field === 'education') {
    return { id, institution: '', degree: text, field: '', graduation_year: null }
  }
  return { id, name: text, issuer: '', date: null, expiry: null }
}

function mergeTextIntoEntry(
  field: StructuredArrayField,
  existing: EmploymentEntry | EducationEntry | CertificationEntry,
  text: string,
): EmploymentEntry | EducationEntry | CertificationEntry {
  if (field === 'employment_history') return { ...(existing as EmploymentEntry), description: text }
  if (field === 'education') return { ...(existing as EducationEntry), degree: text }
  return { ...(existing as CertificationEntry), name: text }
}
