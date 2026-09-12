import { describe, expect, it } from 'vitest'
import { planWeeklyDigest, type DigestPlanInput } from './digestPlanning'
import type { DigestCandidateMatch } from './digestCandidates'

const NOW = new Date('2026-09-15T00:00:00.000Z')

function makeMatch(overrides: Partial<DigestCandidateMatch> = {}): DigestCandidateMatch {
  return {
    id: 'm1', freshFitScore: 80, title: 'Data Analyst', company: 'Acme',
    postingUrl: 'https://example.com/1', dismissedAt: null, promotedOpportunityId: null,
    ...overrides,
  }
}

function makeInput(overrides: Partial<DigestPlanInput> = {}): DigestPlanInput {
  return {
    toEmail: 'member@example.com',
    memberFirstName: 'Jamie',
    prefs: null,
    matches: [makeMatch()],
    lastDigestSentAt: null,
    previouslySentMatchIds: [],
    now: NOW,
    ...overrides,
  }
}

describe('planWeeklyDigest', () => {
  it('returns a plan with the eligible candidate when everything lines up', () => {
    const plan = planWeeklyDigest(makeInput())
    expect(plan).not.toBeNull()
    expect(plan?.matchIds).toEqual(['m1'])
    expect(plan?.payload.toEmail).toBe('member@example.com')
  })

  it('returns null when the member has opted out of the weekly digest', () => {
    const plan = planWeeklyDigest(makeInput({ prefs: { email_notifications: true, weekly_digest: false, immediate_alerts: true } }))
    expect(plan).toBeNull()
  })

  it('returns null when the member opted out of email entirely, even with weekly_digest true', () => {
    const plan = planWeeklyDigest(makeInput({ prefs: { email_notifications: false, weekly_digest: true, immediate_alerts: true } }))
    expect(plan).toBeNull()
  })

  it('returns null when not yet due (last digest sent too recently)', () => {
    const twoDaysAgo = new Date(NOW.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString()
    const plan = planWeeklyDigest(makeInput({ lastDigestSentAt: twoDaysAgo }))
    expect(plan).toBeNull()
  })

  it('returns null when due but there are no new eligible matches', () => {
    const plan = planWeeklyDigest(makeInput({ matches: [] }))
    expect(plan).toBeNull()
  })

  it('excludes matches already sent in a prior digest -- duplicate suppression flows all the way through', () => {
    const plan = planWeeklyDigest(makeInput({ previouslySentMatchIds: ['m1'] }))
    expect(plan).toBeNull()
  })

  it('respects a custom frequencyDays override', () => {
    const twoDaysAgo = new Date(NOW.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString()
    const plan = planWeeklyDigest(makeInput({ lastDigestSentAt: twoDaysAgo, frequencyDays: 1 }))
    expect(plan).not.toBeNull()
  })

  it('is always due for a member who has never received a digest, regardless of prefs row existing', () => {
    const plan = planWeeklyDigest(makeInput({ lastDigestSentAt: null }))
    expect(plan).not.toBeNull()
  })
})
