import { describe, it, expect } from 'vitest'
import { validateJobSubmission } from './jobSubmission'

const valid = { title: 'Data Analyst', company: 'Acme', location: '', salaryText: '', postingUrl: '', description: 'SQL required.' }

describe('validateJobSubmission', () => {
  it('is valid with just title, company, and description', () => {
    expect(validateJobSubmission(valid)).toEqual({ valid: true, errors: {} })
  })

  it('requires title, company, and description', () => {
    const result = validateJobSubmission({ ...valid, title: '', company: '', description: '' })
    expect(result.valid).toBe(false)
    expect(result.errors.title).toBeDefined()
    expect(result.errors.company).toBeDefined()
    expect(result.errors.description).toBeDefined()
  })

  it('rejects an invalid posting URL but allows a blank one', () => {
    expect(validateJobSubmission({ ...valid, postingUrl: 'not-a-url' }).valid).toBe(false)
    expect(validateJobSubmission({ ...valid, postingUrl: '' }).valid).toBe(true)
    expect(validateJobSubmission({ ...valid, postingUrl: 'https://example.com/job/1' }).valid).toBe(true)
  })
})
