import { describe, it, expect } from 'vitest'
import { findDuplicateCandidate, pickCanonicalJob, groupDuplicateCandidates, type DedupCandidate } from './jobDeduplication'

describe('findDuplicateCandidate (conservative, exact-match only)', () => {
  const canonicalJobs = [
    { id: 'job-1', title: 'Data Analyst', company: 'Acme Inc.', location: 'Austin, TX' },
    { id: 'job-2', title: 'Warehouse Associate', company: 'Globex LLC', location: 'Dallas, TX' },
  ]

  it('finds an exact-key match across a differently-formatted company name', () => {
    const newJob = { title: 'DATA ANALYST', company: 'Acme LLC', location: 'Austin, TX' }
    expect(findDuplicateCandidate(newJob, canonicalJobs)).toBe('job-1')
  })

  it('returns null for a genuinely new posting -- never a false positive', () => {
    const newJob = { title: 'Software Engineer', company: 'Initech', location: 'Houston, TX' }
    expect(findDuplicateCandidate(newJob, canonicalJobs)).toBeNull()
  })

  it('returns null (not a fuzzy near-match) for a similar-but-distinct title at the same company/location', () => {
    const newJob = { title: 'Senior Data Analyst', company: 'Acme Inc.', location: 'Austin, TX' }
    expect(findDuplicateCandidate(newJob, canonicalJobs)).toBeNull()
  })

  it('handles an empty candidate list without throwing', () => {
    expect(findDuplicateCandidate({ title: 'X', company: 'Y', location: null }, [])).toBeNull()
  })
})

function candidate(overrides: Partial<DedupCandidate> = {}): DedupCandidate {
  return {
    id: 'job-1', source: 'greenhouse', title: 'Data Analyst', company: 'Acme', location: 'Austin, TX',
    postedAt: '2026-01-01',
    ...overrides,
  }
}

describe('pickCanonicalJob', () => {
  it('prefers the more reliable source', () => {
    const greenhouse = candidate({ id: 'gh', source: 'greenhouse' })
    const adzuna = candidate({ id: 'az', source: 'adzuna' })
    expect(pickCanonicalJob(greenhouse, adzuna).id).toBe('gh')
    expect(pickCanonicalJob(adzuna, greenhouse).id).toBe('gh') // order-independent
  })

  it('prefers a ranked source over an unranked one', () => {
    const adzuna = candidate({ id: 'az', source: 'adzuna' })
    const unknown = candidate({ id: 'zz', source: 'some-unranked-source' })
    expect(pickCanonicalJob(adzuna, unknown).id).toBe('az')
    expect(pickCanonicalJob(unknown, adzuna).id).toBe('az')
  })

  it('breaks a same-reliability tie by earliest posted date (first-seen wins)', () => {
    const earlier = candidate({ id: 'a', source: 'greenhouse', postedAt: '2026-01-01' })
    const later = candidate({ id: 'b', source: 'lever', postedAt: '2026-02-01' })
    expect(pickCanonicalJob(earlier, later).id).toBe('a')
  })

  it('is fully deterministic (lower id wins) when both source and date are tied/unknown', () => {
    const a = candidate({ id: 'a', postedAt: null })
    const b = candidate({ id: 'b', postedAt: null })
    expect(pickCanonicalJob(a, b).id).toBe('a')
    expect(pickCanonicalJob(b, a).id).toBe('a')
  })
})

describe('groupDuplicateCandidates', () => {
  it('groups jobs that share an exact dedupe key and omits groups with no duplicate', () => {
    const jobs: DedupCandidate[] = [
      candidate({ id: 'gh-1', source: 'greenhouse', title: 'Data Analyst', company: 'Acme Inc.', location: 'Austin, TX', postedAt: '2026-01-01' }),
      candidate({ id: 'lever-1', source: 'lever', title: 'Data Analyst', company: 'Acme LLC', location: 'Austin, TX', postedAt: '2026-01-10' }),
      candidate({ id: 'unique-1', source: 'greenhouse', title: 'Warehouse Associate', company: 'Globex', location: 'Dallas, TX' }),
    ]

    const groups = groupDuplicateCandidates(jobs)
    expect(groups).toHaveLength(1)
    expect(groups[0].canonicalId).toBe('gh-1') // greenhouse + lever tie on reliability, gh-1 posted earlier
    expect(groups[0].duplicateIds).toEqual(['lever-1'])
  })

  it('returns an empty array when nothing is duplicated -- never invents a group', () => {
    const jobs: DedupCandidate[] = [
      candidate({ id: 'a', title: 'Data Analyst', company: 'Acme', location: 'Austin, TX' }),
      candidate({ id: 'b', title: 'Warehouse Associate', company: 'Globex', location: 'Dallas, TX' }),
    ]
    expect(groupDuplicateCandidates(jobs)).toEqual([])
  })

  it('handles an empty batch without throwing', () => {
    expect(groupDuplicateCandidates([])).toEqual([])
  })

  it('groups three-way duplicates across three different sources into one group', () => {
    const jobs: DedupCandidate[] = [
      candidate({ id: 'gh', source: 'greenhouse', title: 'Data Analyst', company: 'Acme', location: 'Austin, TX', postedAt: '2026-01-01' }),
      candidate({ id: 'lv', source: 'lever', title: 'Data Analyst', company: 'Acme', location: 'Austin, TX', postedAt: '2026-01-02' }),
      candidate({ id: 'as', source: 'ashby', title: 'Data Analyst', company: 'Acme', location: 'Austin, TX', postedAt: '2026-01-03' }),
    ]
    const groups = groupDuplicateCandidates(jobs)
    expect(groups).toHaveLength(1)
    expect(groups[0].canonicalId).toBe('gh')
    expect(new Set(groups[0].duplicateIds)).toEqual(new Set(['lv', 'as']))
  })
})
