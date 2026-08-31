import { describe, it, expect } from 'vitest'
import { isSafeHttpUrl } from './url'

describe('isSafeHttpUrl', () => {
  it('accepts http and https URLs', () => {
    expect(isSafeHttpUrl('https://example.com/job/1')).toBe(true)
    expect(isSafeHttpUrl('http://example.com/job/1')).toBe(true)
  })

  it('rejects javascript: and data: URIs', () => {
    expect(isSafeHttpUrl('javascript:alert(1)')).toBe(false)
    expect(isSafeHttpUrl('data:text/html,<script>alert(1)</script>')).toBe(false)
  })

  it('rejects null, empty, and malformed input', () => {
    expect(isSafeHttpUrl(null)).toBe(false)
    expect(isSafeHttpUrl('')).toBe(false)
    expect(isSafeHttpUrl('not-a-url')).toBe(false)
  })
})
