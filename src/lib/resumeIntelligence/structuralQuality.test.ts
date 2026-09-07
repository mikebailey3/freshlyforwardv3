import { describe, expect, it } from 'vitest'
import { evaluateStructuralQuality } from './structuralQuality'
import type { ResumeContentInput } from './types'

const BASE: ResumeContentInput = {
  fullName: 'Jamie Rivera',
  email: 'jamie.rivera@example.com',
  phone: '555-123-4567',
  location: 'Denver, CO',
  summary: '',
  employment: [
    { company: 'Acme Co', title: 'Product Manager', start_date: '2021-01', end_date: null, current: true, description: 'Led the roadmap for the payments team.' },
  ],
  education: [
    { institution: 'State University', degree: 'B.A.', field: 'Economics', graduation_year: '2015' },
  ],
  skills: ['product strategy', 'roadmapping', 'stakeholder management', 'sql', 'a/b testing'],
}

describe('evaluateStructuralQuality', () => {
  it('scores a structurally complete resume at 100 with no findings', () => {
    const result = evaluateStructuralQuality(BASE)
    expect(result.key).toBe('structuralQuality')
    expect(result.status).toBe('scored')
    expect(result.score).toBe(100)
    expect(result.findings).toEqual([])
  })

  it('flags zero employment entries as a warning', () => {
    const result = evaluateStructuralQuality({ ...BASE, employment: [] })
    expect(result.findings.some((f) => f.code === 'NO_EXPERIENCE_ENTRIES' && f.severity === 'warning')).toBe(true)
  })

  it('flags an employment entry missing a start date, naming the company/title as evidence', () => {
    const result = evaluateStructuralQuality({
      ...BASE,
      employment: [{ company: 'Acme Co', title: 'Product Manager', start_date: '', end_date: null, current: true, description: 'x' }],
    })
    const finding = result.findings.find((f) => f.code === 'EMPLOYMENT_MISSING_START_DATE')
    expect(finding).toBeDefined()
    expect(finding?.evidence).toContain('Product Manager')
    expect(finding?.evidence).toContain('Acme Co')
  })

  it('flags an employment entry with no description', () => {
    const result = evaluateStructuralQuality({
      ...BASE,
      employment: [{ company: 'Acme Co', title: 'Product Manager', start_date: '2021-01', end_date: null, current: true, description: '   ' }],
    })
    expect(result.findings.some((f) => f.code === 'EMPLOYMENT_MISSING_DESCRIPTION')).toBe(true)
  })

  it('flags zero skills as a warning', () => {
    const result = evaluateStructuralQuality({ ...BASE, skills: [] })
    expect(result.findings.some((f) => f.code === 'NO_SKILLS_LISTED' && f.severity === 'warning')).toBe(true)
  })

  it('flags fewer than 5 skills as info, distinct from zero skills', () => {
    const result = evaluateStructuralQuality({ ...BASE, skills: ['sql', 'excel'] })
    expect(result.findings.some((f) => f.code === 'FEW_SKILLS_LISTED' && f.severity === 'info')).toBe(true)
    expect(result.findings.some((f) => f.code === 'NO_SKILLS_LISTED')).toBe(false)
  })

  it('flags zero education entries as info only, not a warning or error', () => {
    const result = evaluateStructuralQuality({ ...BASE, education: [] })
    const finding = result.findings.find((f) => f.code === 'NO_EDUCATION_ENTRIES')
    expect(finding?.severity).toBe('info')
  })
})
