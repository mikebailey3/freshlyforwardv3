import { describe, expect, it } from 'vitest'
import { evaluateAtsReadability } from './atsReadability'
import type { ResumeContentInput } from './types'

const BASE: ResumeContentInput = {
  fullName: 'Jamie Rivera',
  email: 'jamie.rivera@example.com',
  phone: '555-123-4567',
  location: 'Denver, CO',
  summary: '',
  employment: [],
  education: [],
  skills: [],
}

describe('evaluateAtsReadability', () => {
  it('scores a fully-populated contact block at 100 with no findings', () => {
    const result = evaluateAtsReadability(BASE)
    expect(result.key).toBe('atsReadability')
    expect(result.status).toBe('scored')
    expect(result.score).toBe(100)
    expect(result.findings).toEqual([])
  })

  it('flags a missing name as an error with the field named as evidence', () => {
    const result = evaluateAtsReadability({ ...BASE, fullName: '' })
    const finding = result.findings.find((f) => f.code === 'MISSING_NAME')
    expect(finding).toBeDefined()
    expect(finding?.severity).toBe('error')
  })

  it('flags a missing email as an error', () => {
    const result = evaluateAtsReadability({ ...BASE, email: '' })
    expect(result.findings.some((f) => f.code === 'MISSING_EMAIL' && f.severity === 'error')).toBe(true)
  })

  it('flags a malformed email as an error, distinct from missing', () => {
    const result = evaluateAtsReadability({ ...BASE, email: 'not-an-email' })
    const finding = result.findings.find((f) => f.code === 'MALFORMED_EMAIL')
    expect(finding).toBeDefined()
    expect(finding?.severity).toBe('error')
    expect(finding?.evidence).toBe('not-an-email')
    expect(result.findings.some((f) => f.code === 'MISSING_EMAIL')).toBe(false)
  })

  it('flags a missing phone as a warning', () => {
    const result = evaluateAtsReadability({ ...BASE, phone: '' })
    expect(result.findings.some((f) => f.code === 'MISSING_PHONE' && f.severity === 'warning')).toBe(true)
  })

  it('flags a missing location as info', () => {
    const result = evaluateAtsReadability({ ...BASE, location: '' })
    expect(result.findings.some((f) => f.code === 'MISSING_LOCATION' && f.severity === 'info')).toBe(true)
  })

  it('deducts the correct total for multiple simultaneous findings', () => {
    const result = evaluateAtsReadability({ ...BASE, fullName: '', phone: '' })
    // MISSING_NAME (error, -25) + MISSING_PHONE (warning, -10) = 65
    expect(result.score).toBe(65)
  })
})
