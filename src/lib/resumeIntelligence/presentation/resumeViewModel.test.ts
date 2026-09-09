import { describe, it, expect } from 'vitest'
import { buildResumeViewModel } from './resumeViewModel'
import type { ResumeViewModelProfile } from './resumeViewModel'
import type { MasterResumeEntryInput } from '../masterResume/resumeEntryValidation'

const profile: ResumeViewModelProfile = {
  full_name: 'Jordan Rivera',
  email: 'jordan@example.com',
  phone: '555-0100',
  location: 'Austin, TX',
  summary: 'Canonical summary text.',
  employment_history: [
    { id: 'emp-1', company: 'Acme Corp', title: 'Senior Analyst', start_date: '2020', end_date: null, current: true, description: 'Canonical employment description.' },
    { id: 'emp-2', company: 'Old Co', title: 'Analyst', start_date: '2018', end_date: '2020', current: false, description: 'Older role.' },
  ],
  education: [{ id: 'edu-1', institution: 'State University', degree: 'B.S.', field: 'Economics', graduation_year: '2018' }],
  certifications: [{ id: 'cert-1', name: 'PMP', issuer: 'PMI', date: '2021', expiry: null }],
}

function baseEntries(): MasterResumeEntryInput[] {
  return [
    { entryKind: 'employment', canonicalEntryId: 'emp-1', included: true, sortOrder: 0 },
    { entryKind: 'employment', canonicalEntryId: 'emp-2', included: true, sortOrder: 1 },
    { entryKind: 'education', canonicalEntryId: 'edu-1', included: true, sortOrder: 0 },
    { entryKind: 'certification', canonicalEntryId: 'cert-1', included: true, sortOrder: 0 },
    { entryKind: 'skill', skillValue: 'SQL', included: true, sortOrder: 0 },
  ]
}

describe('buildResumeViewModel', () => {
  it('never persists and derives contact/summary from canonical profile when no override exists', () => {
    const vm = buildResumeViewModel({
      resumeVersionId: 'rv-1',
      templateKey: 'ats_classic',
      sectionOrder: null,
      summaryOverride: null,
      entries: baseEntries(),
      profile,
    })
    expect(vm.contact.fullName).toBe('Jordan Rivera')
    expect(vm.summary).toBe('Canonical summary text.')
  })

  it('prefers a resume-specific summary override over the canonical summary', () => {
    const vm = buildResumeViewModel({
      resumeVersionId: 'rv-1',
      templateKey: 'ats_classic',
      sectionOrder: null,
      summaryOverride: 'Tailored summary for this version only.',
      entries: baseEntries(),
      profile,
    })
    expect(vm.summary).toBe('Tailored summary for this version only.')
  })

  it('hides an entry that is not included, without deleting it from the canonical Profile (the profile fixture is untouched)', () => {
    const entries = baseEntries().map((e) => (e.canonicalEntryId === 'emp-2' ? { ...e, included: false } : e))
    const vm = buildResumeViewModel({ resumeVersionId: 'rv-1', templateKey: 'ats_classic', sectionOrder: null, summaryOverride: null, entries, profile })
    const employmentSection = vm.sections.find((s) => s.key === 'employment')
    expect(employmentSection?.entries.map((e) => e.id)).toEqual(['emp-1'])
    expect(profile.employment_history).toHaveLength(2) // canonical data untouched
  })

  it('applies a resume-specific employment description override without changing the canonical description', () => {
    const entries = baseEntries().map((e) => (e.canonicalEntryId === 'emp-1' ? { ...e, overrideDescription: 'Resume-specific rewritten bullet.' } : e))
    const vm = buildResumeViewModel({ resumeVersionId: 'rv-1', templateKey: 'ats_classic', sectionOrder: null, summaryOverride: null, entries, profile })
    const entry = vm.sections.find((s) => s.key === 'employment')?.entries.find((e) => e.id === 'emp-1')
    expect(entry?.description).toBe('Resume-specific rewritten bullet.')
    expect(profile.employment_history[0].description).toBe('Canonical employment description.')
  })

  it('never fabricates a row for a canonicalEntryId that no longer resolves against the current Profile', () => {
    const entries: MasterResumeEntryInput[] = [{ entryKind: 'employment', canonicalEntryId: 'ghost-id', included: true, sortOrder: 0 }]
    const vm = buildResumeViewModel({ resumeVersionId: 'rv-1', templateKey: 'ats_classic', sectionOrder: null, summaryOverride: null, entries, profile })
    expect(vm.sections.find((s) => s.key === 'employment')).toBeUndefined()
  })

  it('omits sections with zero visible entries entirely', () => {
    const entries = baseEntries().filter((e) => e.entryKind !== 'certification')
    const vm = buildResumeViewModel({ resumeVersionId: 'rv-1', templateKey: 'ats_classic', sectionOrder: null, summaryOverride: null, entries, profile })
    expect(vm.sections.find((s) => s.key === 'certifications')).toBeUndefined()
  })

  it('respects a member-chosen section order, ignoring unknown keys and appending missing known sections', () => {
    const vm = buildResumeViewModel({
      resumeVersionId: 'rv-1',
      templateKey: 'ats_classic',
      sectionOrder: ['skills', 'not-a-real-section', 'employment'],
      summaryOverride: null,
      entries: baseEntries(),
      profile,
    })
    expect(vm.sections.map((s) => s.key)).toEqual(['skills', 'employment', 'education', 'certifications'])
  })

  it('orders entries within a section by sortOrder', () => {
    const entries = baseEntries().map((e) => (e.canonicalEntryId === 'emp-1' ? { ...e, sortOrder: 5 } : e.canonicalEntryId === 'emp-2' ? { ...e, sortOrder: 1 } : e))
    const vm = buildResumeViewModel({ resumeVersionId: 'rv-1', templateKey: 'ats_classic', sectionOrder: null, summaryOverride: null, entries, profile })
    expect(vm.sections.find((s) => s.key === 'employment')?.entries.map((e) => e.id)).toEqual(['emp-2', 'emp-1'])
  })

  it('handles a null profile without crashing: canonical-lookup entries (employment/education/certification) vanish, but skills -- which need no profile lookup, only the already-validated skillValue -- still render', () => {
    const vm = buildResumeViewModel({ resumeVersionId: 'rv-1', templateKey: 'ats_classic', sectionOrder: null, summaryOverride: null, entries: baseEntries(), profile: null })
    expect(vm.contact).toEqual({ fullName: '', email: '', phone: '', location: '' })
    expect(vm.sections.map((s) => s.key)).toEqual(['skills'])
  })
})
