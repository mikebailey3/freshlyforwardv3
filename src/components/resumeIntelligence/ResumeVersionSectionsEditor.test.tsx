import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ResumeVersionSectionsEditor } from './ResumeVersionSectionsEditor'
import type { ResumeEditorState } from '@/lib/resumeIntelligence/presentation/resumeEditorReducer'
import type { MemberProfile } from '@/types'

const profile = {
  employment_history: [{ id: 'emp-1', title: 'Engineer', company: 'Acme', description: 'Built things', start_date: '2020', end_date: null, current: true }],
  education: [{ id: 'edu-1', degree: 'BS CS', institution: 'State U', field: '', graduation_year: '2019' }],
  certifications: [{ id: 'cert-1', name: 'PMP', issuer: 'PMI', date: '2021' }],
} as unknown as MemberProfile

function makeState(overrides: Partial<ResumeEditorState> = {}): ResumeEditorState {
  return {
    entries: [
      { entryId: 'employment:emp-1', entryKind: 'employment', canonicalEntryId: 'emp-1', included: true, sortOrder: 0, overrideDescription: null },
      { entryId: 'skill:SQL', entryKind: 'skill', skillValue: 'SQL', included: true, sortOrder: 0, overrideDescription: null },
    ],
    sectionOrder: ['employment', 'education', 'certifications', 'skills'],
    templateKey: 'ats_classic',
    summaryOverride: null,
    dirty: false,
    ...overrides,
  }
}

describe('ResumeVersionSectionsEditor', () => {
  it('resolves a human-readable label for an employment entry from the canonical Profile', () => {
    render(<ResumeVersionSectionsEditor state={makeState()} profile={profile} dispatch={vi.fn()} />)
    expect(screen.getAllByText('Engineer — Acme').length).toBeGreaterThan(0)
  })

  it('toggling an entry checkbox dispatches toggleIncluded with that entry id', () => {
    const dispatch = vi.fn()
    render(<ResumeVersionSectionsEditor state={makeState()} profile={profile} dispatch={dispatch} />)
    fireEvent.click(screen.getAllByRole('checkbox')[0] as HTMLElement)
    expect(dispatch).toHaveBeenCalledWith({ type: 'toggleIncluded', entryId: 'employment:emp-1' })
  })

  it('editing the employment override description dispatches setOverrideDescription -- never touches canonical fields', () => {
    const dispatch = vi.fn()
    render(<ResumeVersionSectionsEditor state={makeState()} profile={profile} dispatch={dispatch} />)
    const textarea = screen.getByPlaceholderText(/Resume-specific wording/)
    fireEvent.change(textarea, { target: { value: 'Tailored bullet text' } })
    expect(dispatch).toHaveBeenCalledWith({ type: 'setOverrideDescription', entryId: 'employment:emp-1', text: 'Tailored bullet text' })
  })

  it('changing the template dispatches setTemplateKey', () => {
    const dispatch = vi.fn()
    render(<ResumeVersionSectionsEditor state={makeState()} profile={profile} dispatch={dispatch} />)
    fireEvent.change(screen.getByDisplayValue('ATS Classic'), { target: { value: 'modern' } })
    expect(dispatch).toHaveBeenCalledWith({ type: 'setTemplateKey', templateKey: 'modern' })
  })

  it('editing the summary override dispatches setSummaryOverride with null for empty text', () => {
    const dispatch = vi.fn()
    render(<ResumeVersionSectionsEditor state={makeState({ summaryOverride: 'Something' })} profile={profile} dispatch={dispatch} />)
    fireEvent.change(screen.getByDisplayValue('Something'), { target: { value: '' } })
    expect(dispatch).toHaveBeenCalledWith({ type: 'setSummaryOverride', text: null })
  })

  it('a section with no entries of its kind is never rendered', () => {
    render(<ResumeVersionSectionsEditor state={makeState()} profile={profile} dispatch={vi.fn()} />)
    expect(screen.queryByRole('heading', { name: 'Education' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Certifications' })).not.toBeInTheDocument()
  })
})
