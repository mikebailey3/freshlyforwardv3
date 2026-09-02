import { describe, it, expect } from 'vitest'
import { getErrorDetail } from './errorDetail'

describe('getErrorDetail', () => {
  it('returns the message of a real Error instance', () => {
    expect(getErrorDetail(new Error('board not found'))).toBe('board not found')
  })

  it('returns the message of a Supabase-style plain error object (not an Error instance)', () => {
    // This is the shape supabase-js returns from a failed query --
    // { message, details, hint, code } -- and what upsertJobs()/etc throw.
    const supabaseError = { message: 'permission denied for table scraped_jobs', details: null, hint: null, code: '42501' }
    expect(getErrorDetail(supabaseError)).toBe('permission denied for table scraped_jobs')
  })

  it('falls back to String() for a plain object with no message property', () => {
    expect(getErrorDetail({ code: 'PGRST116' })).toBe('[object Object]')
  })

  it('falls back to String() for a non-object, non-Error throw', () => {
    expect(getErrorDetail('a plain string throw')).toBe('a plain string throw')
    expect(getErrorDetail(42)).toBe('42')
  })

  it('ignores a non-string message property and falls back to String()', () => {
    expect(getErrorDetail({ message: { nested: true } })).toBe('[object Object]')
  })
})
