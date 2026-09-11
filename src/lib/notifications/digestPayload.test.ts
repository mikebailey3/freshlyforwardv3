import { describe, expect, it } from 'vitest'
import { buildWeeklyDigestPayload, extractFirstName } from './digestPayload'
import type { DigestCandidateMatch } from './digestCandidates'

function makeMatch(overrides: Partial<DigestCandidateMatch> = {}): DigestCandidateMatch {
  return {
    id: 'm1', freshFitScore: 80, title: 'Data Analyst', company: 'Acme',
    postingUrl: 'https://example.com/1', dismissedAt: null, promotedOpportunityId: null,
    ...overrides,
  }
}

describe('buildWeeklyDigestPayload', () => {
  it('addresses the recipient by first name when known', () => {
    const payload = buildWeeklyDigestPayload('a@b.com', 'Jamie', [makeMatch()])
    expect(payload.subject).toContain('Jamie')
    expect(payload.bodyText).toContain('Hi Jamie,')
  })

  it('falls back to a generic greeting when no first name is known', () => {
    const payload = buildWeeklyDigestPayload('a@b.com', null, [makeMatch()])
    expect(payload.bodyText).toContain('Hi there,')
  })

  it('uses singular phrasing for exactly one match', () => {
    const payload = buildWeeklyDigestPayload('a@b.com', 'Jamie', [makeMatch()])
    expect(payload.subject).toBe('Jamie, you have 1 new match this week')
  })

  it('uses plural phrasing for multiple matches', () => {
    const payload = buildWeeklyDigestPayload('a@b.com', 'Jamie', [makeMatch({ id: 'm1' }), makeMatch({ id: 'm2' })])
    expect(payload.subject).toBe('Jamie, you have 2 new matches this week')
  })

  it('lists every match with its title, company, tier label, and score', () => {
    const payload = buildWeeklyDigestPayload('a@b.com', 'Jamie', [makeMatch({ title: 'Sales Manager', company: 'Globex', freshFitScore: 90 })])
    expect(payload.bodyText).toContain('Sales Manager at Globex (Excellent Match, 90/100)')
  })

  it('includes the posting URL when present, and omits a broken line when absent', () => {
    const withUrl = buildWeeklyDigestPayload('a@b.com', 'Jamie', [makeMatch({ postingUrl: 'https://example.com/job/1' })])
    expect(withUrl.bodyText).toContain('https://example.com/job/1')

    const withoutUrl = buildWeeklyDigestPayload('a@b.com', 'Jamie', [makeMatch({ postingUrl: null })])
    expect(withoutUrl.bodyText).not.toContain('null')
  })

  it('carries the recipient email through unchanged onto the payload', () => {
    const payload = buildWeeklyDigestPayload('member@example.com', 'Jamie', [makeMatch()])
    expect(payload.toEmail).toBe('member@example.com')
  })
})

describe('extractFirstName', () => {
  it('returns the first token of a full name', () => {
    expect(extractFirstName('Jamie Rivera')).toBe('Jamie')
  })

  it('returns the whole string when there is only one token', () => {
    expect(extractFirstName('Jamie')).toBe('Jamie')
  })

  it('returns null for null, empty, or whitespace-only input -- never an empty string', () => {
    expect(extractFirstName(null)).toBeNull()
    expect(extractFirstName('')).toBeNull()
    expect(extractFirstName('   ')).toBeNull()
  })

  it('collapses extra internal whitespace rather than returning an empty first token', () => {
    expect(extractFirstName('  Jamie   Rivera  ')).toBe('Jamie')
  })
})
