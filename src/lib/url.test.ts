import { describe, it, expect } from 'vitest'
import { isSafeHttpUrl, isSafeAppLink } from './url'

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

// Regression: NotificationsPage briefly used isSafeHttpUrl directly for
// notifications.link, which rejects every relative in-app route (new
// URL('/x') throws without a base) -- silently hiding real notification
// links like '/strategist/applications' (see
// supabase/migrations/20260821010000_interviews_reports_profile_upgrade.sql).
describe('isSafeAppLink', () => {
  it('accepts absolute http/https URLs, same as isSafeHttpUrl', () => {
    expect(isSafeAppLink('https://example.com/job/1')).toBe(true)
    expect(isSafeAppLink('http://example.com/job/1')).toBe(true)
  })

  it('accepts a same-origin relative in-app route', () => {
    expect(isSafeAppLink('/strategist/applications')).toBe(true)
    expect(isSafeAppLink('/messages')).toBe(true)
    expect(isSafeAppLink('/messages?tab=unread')).toBe(true)
    expect(isSafeAppLink('/messages#top')).toBe(true)
  })

  it('rejects protocol-relative URLs (//host) that would navigate off-origin', () => {
    expect(isSafeAppLink('//evil.com')).toBe(false)
  })

  it('rejects the backslash bypass of the protocol-relative trick (/\\host)', () => {
    expect(isSafeAppLink('/\\evil.com')).toBe(false)
  })

  it('rejects javascript:/data: URIs and null/empty input', () => {
    expect(isSafeAppLink('javascript:alert(1)')).toBe(false)
    expect(isSafeAppLink('data:text/html,<script>alert(1)</script>')).toBe(false)
    expect(isSafeAppLink(null)).toBe(false)
    expect(isSafeAppLink('')).toBe(false)
  })

  it('rejects a bare relative path with no leading slash', () => {
    expect(isSafeAppLink('messages')).toBe(false)
  })
})
