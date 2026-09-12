import { describe, expect, it } from 'vitest'
import { computeDigestEligibility } from './eligibility'

describe('computeDigestEligibility', () => {
  it('defaults to eligible for both cadences when no preferences row exists yet -- mirrors the schema column defaults, never silently excludes a brand-new member', () => {
    const result = computeDigestEligibility(null)
    expect(result).toEqual({ weeklyDigestEligible: true, immediateAlertEligible: true })
  })

  it('is eligible for both cadences when both are explicitly enabled', () => {
    const result = computeDigestEligibility({ email_notifications: true, weekly_digest: true, immediate_alerts: true })
    expect(result).toEqual({ weeklyDigestEligible: true, immediateAlertEligible: true })
  })

  it('the global email_notifications kill switch overrides both cadences even if individually enabled', () => {
    const result = computeDigestEligibility({ email_notifications: false, weekly_digest: true, immediate_alerts: true })
    expect(result).toEqual({ weeklyDigestEligible: false, immediateAlertEligible: false })
  })

  it('tracks weekly_digest and immediate_alerts independently -- a member can want one without the other', () => {
    const digestOnly = computeDigestEligibility({ email_notifications: true, weekly_digest: true, immediate_alerts: false })
    expect(digestOnly).toEqual({ weeklyDigestEligible: true, immediateAlertEligible: false })

    const alertsOnly = computeDigestEligibility({ email_notifications: true, weekly_digest: false, immediate_alerts: true })
    expect(alertsOnly).toEqual({ weeklyDigestEligible: false, immediateAlertEligible: true })
  })

  it('is ineligible for both when a member has explicitly opted out of both cadences', () => {
    const result = computeDigestEligibility({ email_notifications: true, weekly_digest: false, immediate_alerts: false })
    expect(result).toEqual({ weeklyDigestEligible: false, immediateAlertEligible: false })
  })
})
