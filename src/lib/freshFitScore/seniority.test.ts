import { describe, it, expect } from 'vitest'
import { inferSeniorityLevel, getMemberCurrentSeniority } from './seniority'
import type { EmploymentEntry } from '@/types'

function entry(overrides: Partial<EmploymentEntry> = {}): EmploymentEntry {
  return { company: 'Acme', title: 'Analyst', start_date: '2020-01-01', end_date: null, current: false, description: '', ...overrides }
}

describe('inferSeniorityLevel', () => {
  it('recognizes an intern-level title', () => {
    expect(inferSeniorityLevel('Marketing Intern')).toBe(0)
  })

  it('recognizes a junior/entry-level title', () => {
    expect(inferSeniorityLevel('Junior Data Analyst')).toBe(1)
  })

  it('defaults an unmodified title to mid-level', () => {
    expect(inferSeniorityLevel('Data Analyst')).toBe(2)
  })

  it('recognizes a senior title', () => {
    expect(inferSeniorityLevel('Senior Data Analyst')).toBe(3)
  })

  it('recognizes a lead/principal/staff title', () => {
    expect(inferSeniorityLevel('Principal Engineer')).toBe(4)
    expect(inferSeniorityLevel('Lead Developer')).toBe(4)
  })

  it('recognizes a manager-level title', () => {
    expect(inferSeniorityLevel('Operations Manager')).toBe(5)
  })

  it('recognizes a director/executive-level title', () => {
    expect(inferSeniorityLevel('Director of Sales')).toBe(6)
    expect(inferSeniorityLevel('VP of Engineering')).toBe(6)
  })

  it('returns null for a blank title', () => {
    expect(inferSeniorityLevel('')).toBeNull()
  })
})

describe('getMemberCurrentSeniority', () => {
  it('returns null for no employment history at all', () => {
    expect(getMemberCurrentSeniority([])).toBeNull()
  })

  it('uses the entry marked current when present', () => {
    const history = [
      entry({ title: 'Junior Analyst', current: false, start_date: '2018-01-01', end_date: '2020-01-01' }),
      entry({ title: 'Senior Analyst', current: true, start_date: '2020-01-01', end_date: null }),
    ]
    expect(getMemberCurrentSeniority(history)).toBe(3)
  })

  it('falls back to the most recently started entry when none is marked current', () => {
    const history = [
      entry({ title: 'Junior Analyst', current: false, start_date: '2018-01-01', end_date: '2020-01-01' }),
      entry({ title: 'Manager', current: false, start_date: '2020-06-01', end_date: '2022-01-01' }),
    ]
    expect(getMemberCurrentSeniority(history)).toBe(5)
  })
})
