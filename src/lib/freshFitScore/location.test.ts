import { describe, it, expect } from 'vitest'
import { scoreLocationDimension, remoteHardConstraint, isRemoteText, extractTravelSignal } from './location'
import type { MemberProfile, ScrapedJob } from '@/types'

function makeProfile(overrides: Partial<MemberProfile> = {}): MemberProfile {
  return {
    location: 'Dallas, TX',
    remote_preference: 'remote',
    willing_to_relocate: false,
    max_commute_minutes: null,
    travel_willingness: null,
    ...overrides,
  } as MemberProfile
}
function makeJob(overrides: Partial<ScrapedJob> = {}): ScrapedJob {
  return { location: 'Remote', description: '', ...overrides } as ScrapedJob
}

describe('scoreLocationDimension - remote alignment', () => {
  it('scores highly when a remote-preferring member matches a remote job', () => {
    const result = scoreLocationDimension(makeProfile(), makeJob())
    expect(result.status).toBe('strong')
  })
})

describe('scoreLocationDimension - location mismatch', () => {
  it('scores weakly for an on-site job in a different city with no relocation willingness', () => {
    const result = scoreLocationDimension(
      makeProfile({ remote_preference: 'onsite', location: 'Dallas, TX', willing_to_relocate: false }),
      makeJob({ location: 'Boston, MA' })
    )
    expect(result.status).toBe('weak')
  })
})

describe('scoreLocationDimension - travel mismatch', () => {
  it('folds heavy JD travel language into the explanation when the member has stated low travel willingness', () => {
    const result = scoreLocationDimension(
      makeProfile({ travel_willingness: 'none' }),
      makeJob({ description: 'This role requires up to 50% travel.' })
    )
    expect(result.gaps.some((g) => g.toLowerCase().includes('travel'))).toBe(true)
  })
})

describe('scoreLocationDimension - no data', () => {
  it('is a small neutral credit when there is no location on file and the job is not remote', () => {
    const result = scoreLocationDimension(makeProfile({ location: null, remote_preference: null }), makeJob({ location: 'Chicago, IL' }))
    expect(result.score).toBeGreaterThan(0)
  })
})

describe('remoteHardConstraint', () => {
  it('is unknown, never a false block, when the member has no strict remote requirement', () => {
    const result = remoteHardConstraint(makeProfile({ remote_preference: 'hybrid' }), makeJob({ location: 'Boston, MA' }))
    expect(result.status).toBe('unknown')
  })

  it('flags hard_blocker only for a confirmed remote-only member against a confirmed on-site job with no relocation willingness', () => {
    const result = remoteHardConstraint(
      makeProfile({ remote_preference: 'remote', location: 'Dallas, TX', willing_to_relocate: false }),
      makeJob({ location: 'Boston, MA' })
    )
    expect(result.status).toBe('hard_blocker')
  })

  it('confirms met for a remote-only member against a remote job', () => {
    const result = remoteHardConstraint(makeProfile({ remote_preference: 'remote' }), makeJob({ location: 'Remote' }))
    expect(result.status).toBe('confirmed_match')
  })
})

// OE 2.0 Phase 1: these two are exported so jobNormalization.ts shares
// the exact same remote/travel detection logic instead of a second copy.
describe('isRemoteText (shared, exported for jobNormalization.ts)', () => {
  it('detects "remote" case-insensitively', () => {
    expect(isRemoteText('Remote')).toBe(true)
    expect(isRemoteText('REMOTE - US')).toBe(true)
  })

  it('is false for null/undefined/non-remote text', () => {
    expect(isRemoteText(null)).toBe(false)
    expect(isRemoteText(undefined)).toBe(false)
    expect(isRemoteText('Dallas, TX')).toBe(false)
  })
})

describe('extractTravelSignal (shared, exported for jobNormalization.ts)', () => {
  it('extracts an explicit travel percentage', () => {
    expect(extractTravelSignal('Up to 40% travel required.')).toEqual({ impliesHeavyTravel: true, percentage: 40 })
  })

  it('flags heavy travel language even without a percentage', () => {
    const result = extractTravelSignal('This role requires frequent travel.')
    expect(result.impliesHeavyTravel).toBe(true)
    expect(result.percentage).toBeNull()
  })

  it('is false/null for a description with no travel language', () => {
    expect(extractTravelSignal('Fully remote, no travel.')).toEqual({ impliesHeavyTravel: false, percentage: null })
  })

  it('does not flag a low travel percentage as heavy', () => {
    const result = extractTravelSignal('Up to 10% travel.')
    expect(result.impliesHeavyTravel).toBe(false)
    expect(result.percentage).toBe(10)
  })

  it('handles null/undefined description without throwing', () => {
    expect(extractTravelSignal(null)).toEqual({ impliesHeavyTravel: false, percentage: null })
    expect(extractTravelSignal(undefined)).toEqual({ impliesHeavyTravel: false, percentage: null })
  })
})
