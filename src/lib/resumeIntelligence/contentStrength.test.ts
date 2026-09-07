import { describe, expect, it } from 'vitest'
import { evaluateContentStrength } from './contentStrength'
import type { ResumeContentInput } from './types'

const BASE: ResumeContentInput = {
  fullName: 'Jamie Rivera',
  email: 'jamie.rivera@example.com',
  phone: '555-123-4567',
  location: 'Denver, CO',
  summary: 'Led cross-functional teams to grow revenue by 30% year over year.',
  employment: [
    { company: 'Acme Co', title: 'Product Manager', start_date: '2021-01', end_date: null, current: true, description: 'Launched three major features that increased retention by 15%.' },
  ],
  education: [],
  skills: [],
}

describe('evaluateContentStrength', () => {
  it('scores clean, specific content at 100 with no findings', () => {
    const result = evaluateContentStrength(BASE)
    expect(result.key).toBe('contentStrength')
    expect(result.status).toBe('scored')
    expect(result.score).toBe(100)
    expect(result.findings).toEqual([])
  })

  it('flags a cliché in the summary, with the exact phrase as evidence', () => {
    const result = evaluateContentStrength({ ...BASE, summary: 'Hardworking self-starter with a proven track record.' })
    const finding = result.findings.find((f) => f.code === 'CLICHE_IN_SUMMARY')
    expect(finding).toBeDefined()
    expect(finding?.evidence).toMatch(/hardworking|self-starter|proven track record/)
  })

  it('flags a weak-opener bullet in an employment description, naming the employer as context', () => {
    const result = evaluateContentStrength({
      ...BASE,
      employment: [{ company: 'Acme Co', title: 'PM', start_date: '2021', end_date: null, current: true, description: 'Responsible for the roadmap.' }],
    })
    const finding = result.findings.find((f) => f.code === 'WEAK_OPENER_BULLET')
    expect(finding).toBeDefined()
    expect(finding?.evidence).toContain('Responsible for the roadmap')
    expect(finding?.action).toContain('Acme Co')
  })

  it('flags a cliché in an employment description, distinct from the summary finding', () => {
    const result = evaluateContentStrength({
      ...BASE,
      summary: 'Product leader focused on outcomes.',
      employment: [{ company: 'Acme Co', title: 'PM', start_date: '2021', end_date: null, current: true, description: 'Known as a real team player who drives synergy.' }],
    })
    expect(result.findings.some((f) => f.code === 'CLICHE_IN_BULLET')).toBe(true)
    expect(result.findings.some((f) => f.code === 'CLICHE_IN_SUMMARY')).toBe(false)
  })

  it('does not flag an empty summary as a cliché issue', () => {
    const result = evaluateContentStrength({ ...BASE, summary: '' })
    expect(result.findings.some((f) => f.code === 'CLICHE_IN_SUMMARY')).toBe(false)
  })
})
