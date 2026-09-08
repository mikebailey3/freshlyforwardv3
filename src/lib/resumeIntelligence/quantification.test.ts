import { describe, expect, it } from 'vitest'
import { evaluateQuantification } from './quantification'
import type { ResumeContentInput } from './types'

const BASE: ResumeContentInput = {
  fullName: 'Jamie Rivera',
  email: 'jamie.rivera@example.com',
  phone: '555-123-4567',
  location: 'Denver, CO',
  summary: '',
  employment: [],
  education: [],
  certifications: [],
  skills: [],
}

describe('evaluateQuantification', () => {
  it('reports no bullets to quantify (info) when there is no employment content, not a penalty', () => {
    const result = evaluateQuantification(BASE)
    expect(result.key).toBe('quantification')
    expect(result.status).toBe('scored')
    expect(result.findings.some((f) => f.code === 'NO_BULLETS_TO_QUANTIFY' && f.severity === 'info')).toBe(true)
  })

  it('scores full quantification coverage at 100 with no findings', () => {
    const result = evaluateQuantification({
      ...BASE,
      employment: [
        { company: 'Acme Co', title: 'PM', start_date: '2021', end_date: null, current: true, description: 'Grew revenue by 30% and led a team of 8.' },
      ],
    })
    expect(result.score).toBe(100)
    expect(result.findings).toEqual([])
  })

  it('flags an unquantified bullet, naming the employer and quoting the bullet as evidence', () => {
    const result = evaluateQuantification({
      ...BASE,
      employment: [
        { company: 'Acme Co', title: 'PM', start_date: '2021', end_date: null, current: true, description: 'Improved team morale and collaboration.' },
      ],
    })
    const finding = result.findings.find((f) => f.code === 'BULLET_NOT_QUANTIFIED')
    expect(finding).toBeDefined()
    expect(finding?.evidence).toContain('Improved team morale')
    expect(finding?.action).toContain('Acme Co')
  })

  it('scores a mix of quantified and unquantified bullets proportionally', () => {
    const result = evaluateQuantification({
      ...BASE,
      employment: [
        { company: 'A', title: 'X', start_date: '2021', end_date: null, current: true, description: 'Grew revenue 30%.' },
        { company: 'B', title: 'Y', start_date: '2020', end_date: '2021', current: false, description: 'Helped the team collaborate better.' },
      ],
    })
    expect(result.findings.filter((f) => f.code === 'BULLET_NOT_QUANTIFIED')).toHaveLength(1)
    expect(result.score).toBeLessThan(100)
    expect(result.score).toBeGreaterThan(0)
  })

  it('ignores an employment entry with an empty description rather than flagging it as unquantified', () => {
    const result = evaluateQuantification({
      ...BASE,
      employment: [{ company: 'Acme Co', title: 'PM', start_date: '2021', end_date: null, current: true, description: '   ' }],
    })
    expect(result.findings.some((f) => f.code === 'BULLET_NOT_QUANTIFIED')).toBe(false)
  })
})
