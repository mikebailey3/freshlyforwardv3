import { describe, it, expect } from 'vitest'
import { scoreLocationDimension, remoteHardConstraint } from './location'
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
