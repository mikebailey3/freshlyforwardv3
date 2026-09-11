import { describe, expect, it } from 'vitest'
import { isDigestDue, DEFAULT_WEEKLY_DIGEST_FREQUENCY_DAYS } from './schedule'

const NOW = new Date('2026-09-15T00:00:00.000Z')

describe('isDigestDue', () => {
  it('is always due when the member has never received a digest before', () => {
    expect(isDigestDue(null, NOW, DEFAULT_WEEKLY_DIGEST_FREQUENCY_DAYS)).toBe(true)
  })

  it('is not due when fewer than frequencyDays have elapsed', () => {
    const threeDaysAgo = new Date(NOW.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString()
    expect(isDigestDue(threeDaysAgo, NOW, 7)).toBe(false)
  })

  it('is due once exactly frequencyDays have elapsed', () => {
    const sevenDaysAgo = new Date(NOW.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    expect(isDigestDue(sevenDaysAgo, NOW, 7)).toBe(true)
  })

  it('is due when well past frequencyDays -- e.g. the pipeline was paused for a while', () => {
    const thirtyDaysAgo = new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
    expect(isDigestDue(thirtyDaysAgo, NOW, 7)).toBe(true)
  })

  it('treats a malformed timestamp as due -- never permanently blocks a member over bad data', () => {
    expect(isDigestDue('not-a-real-date', NOW, 7)).toBe(true)
  })

  it('respects a custom frequency, not just the 7-day default', () => {
    const twoDaysAgo = new Date(NOW.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString()
    expect(isDigestDue(twoDaysAgo, NOW, 1)).toBe(true)
    expect(isDigestDue(twoDaysAgo, NOW, 3)).toBe(false)
  })
})
