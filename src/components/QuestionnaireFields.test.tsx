import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FieldRenderer } from './QuestionnaireFields'
import type { QuestionnaireField } from '@/data/questionnaire'

/**
 * Resume Intelligence Phase 3 gate: Option A (additive JSONB ids on
 * employment/education/certification entries) is only safe if this shared
 * editor -- used by both onboarding and the member/admin profile forms --
 * never reconstructs an entry from a narrower schema that drops unknown
 * keys. These tests prove the *current* behavior (found during the Phase 3
 * save-path audit) preserves an `id` property the component's own
 * TypeScript interfaces don't declare, using entries shaped like what
 * ensureEmploymentEntryIdsForUser (and its Phase 3 education/certification
 * equivalents) would have already backfilled.
 */

const employmentField: QuestionnaireField = { key: 'employment_history', label: 'Employment History', type: 'employment', required: true }
const educationField: QuestionnaireField = { key: 'education', label: 'Education', type: 'education' }
const certificationsField: QuestionnaireField = { key: 'certifications', label: 'Certifications', type: 'certifications' }

describe('QuestionnaireFields: id preservation (employment)', () => {
  const existing = [
    { id: 'entry-1', company: 'Acme', title: 'Manager', start_date: '2020-01', end_date: null, current: true, description: '' },
    { id: 'entry-2', company: 'Globex', title: 'Analyst', start_date: '2018-01', end_date: '2019-12', current: false, description: '' },
  ]

  it('editing an existing entry preserves its id', () => {
    const onChange = vi.fn()
    render(<FieldRenderer field={employmentField} value={existing} onChange={onChange} />)

    fireEvent.change(screen.getAllByPlaceholderText('Job Title')[0], { target: { value: 'Senior Manager' } })

    const [updated] = onChange.mock.calls.at(-1) as [typeof existing]
    expect(updated[0]).toMatchObject({ id: 'entry-1', title: 'Senior Manager' })
    expect(updated[1]).toMatchObject({ id: 'entry-2' })
  })

  it('adding a new entry leaves existing entries and their ids untouched', () => {
    const onChange = vi.fn()
    render(<FieldRenderer field={employmentField} value={existing} onChange={onChange} />)

    fireEvent.click(screen.getByText('Add Role'))

    const [updated] = onChange.mock.calls.at(-1) as [typeof existing]
    expect(updated).toHaveLength(3)
    expect(updated[0]).toMatchObject({ id: 'entry-1' })
    expect(updated[1]).toMatchObject({ id: 'entry-2' })
    // The freshly added entry has no id yet -- expected; it is backfilled later, never invented here.
    expect(updated[2]).not.toHaveProperty('id')
  })

  it('deleting one entry leaves the remaining entry and its id untouched', () => {
    const onChange = vi.fn()
    render(<FieldRenderer field={employmentField} value={existing} onChange={onChange} />)

    fireEvent.click(screen.getAllByLabelText('Remove role')[0])

    const [updated] = onChange.mock.calls.at(-1) as [typeof existing]
    expect(updated).toHaveLength(1)
    expect(updated[0]).toMatchObject({ id: 'entry-2' })
  })
})

describe('QuestionnaireFields: id preservation (education)', () => {
  const existing = [
    { id: 'entry-edu-1', institution: 'State University', degree: 'B.A.', field: 'Economics', graduation_year: '2015' },
  ]

  it('editing an existing entry preserves its id', () => {
    const onChange = vi.fn()
    render(<FieldRenderer field={educationField} value={existing} onChange={onChange} />)

    fireEvent.change(screen.getByPlaceholderText('Degree'), { target: { value: 'M.A.' } })

    const [updated] = onChange.mock.calls.at(-1) as [typeof existing]
    expect(updated[0]).toMatchObject({ id: 'entry-edu-1', degree: 'M.A.' })
  })

  it('adding a new entry leaves the existing entry and its id untouched', () => {
    const onChange = vi.fn()
    render(<FieldRenderer field={educationField} value={existing} onChange={onChange} />)

    fireEvent.click(screen.getByText('Add Education'))

    const [updated] = onChange.mock.calls.at(-1) as [typeof existing]
    expect(updated).toHaveLength(2)
    expect(updated[0]).toMatchObject({ id: 'entry-edu-1' })
    expect(updated[1]).not.toHaveProperty('id')
  })
})

describe('QuestionnaireFields: id preservation (certifications)', () => {
  const existing = [
    { id: 'entry-cert-1', name: 'PMP', issuer: 'Project Management Institute', date: '2022', expiry: null },
  ]

  it('editing an existing entry preserves its id', () => {
    const onChange = vi.fn()
    render(<FieldRenderer field={certificationsField} value={existing} onChange={onChange} />)

    fireEvent.change(screen.getByPlaceholderText('Certification Name'), { target: { value: 'PMP (renewed)' } })

    const [updated] = onChange.mock.calls.at(-1) as [typeof existing]
    expect(updated[0]).toMatchObject({ id: 'entry-cert-1', name: 'PMP (renewed)' })
  })

  it('deleting the only entry produces an empty array, not an error', () => {
    const onChange = vi.fn()
    render(<FieldRenderer field={certificationsField} value={existing} onChange={onChange} />)

    fireEvent.click(screen.getByLabelText('Remove'))

    const [updated] = onChange.mock.calls.at(-1) as [typeof existing]
    expect(updated).toEqual([])
  })
})
