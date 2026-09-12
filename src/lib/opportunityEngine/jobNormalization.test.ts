import { describe, it, expect } from 'vitest'
import {
  normalizeTitle,
  normalizeCompanyName,
  normalizeLocationText,
  normalizeJobKey,
  inferWorkModel,
  normalizeEmploymentType,
  extractMinYearsExperience,
  extractEducationRequirement,
  extractResponsibilities,
  normalizePostedAt,
  normalizeApplyUrl,
  getSourceReliability,
  normalizeJob,
  type JobLike,
} from './jobNormalization'

function makeJob(overrides: Partial<JobLike> = {}): JobLike {
  return {
    source: 'greenhouse',
    title: 'Data Analyst',
    company: 'Acme Inc.',
    location: 'Austin, TX',
    description: 'Looking for a data analyst with SQL experience.',
    salary_text: '$60,000 - $70,000',
    employment_type: 'Full-time',
    posting_url: 'https://boards.greenhouse.io/acme/jobs/1',
    posted_at: '2026-01-05T00:00:00.000Z',
    ...overrides,
  }
}

describe('normalizeTitle', () => {
  it('lowercases and strips punctuation', () => {
    expect(normalizeTitle('Sr. Data Analyst!')).toBe('sr data analyst')
  })

  it('collapses repeated whitespace', () => {
    expect(normalizeTitle('Data   Analyst')).toBe('data analyst')
  })

  it('handles an empty/null-ish title without throwing', () => {
    expect(normalizeTitle('')).toBe('')
  })
})

describe('normalizeCompanyName', () => {
  it('strips a trailing legal suffix with punctuation', () => {
    expect(normalizeCompanyName('Acme, Inc.')).toBe('acme')
  })

  it('strips a trailing legal suffix without punctuation', () => {
    expect(normalizeCompanyName('Acme LLC')).toBe('acme')
  })

  it('strips "Corp" specifically (a real dedup case across two ATS listings)', () => {
    expect(normalizeCompanyName('Acme Corp')).toBe('acme')
    expect(normalizeCompanyName('Acme Corporation')).toBe('acme')
  })

  it('leaves a company name with no legal suffix unchanged (aside from case)', () => {
    expect(normalizeCompanyName('Acme')).toBe('acme')
  })
})

describe('normalizeLocationText', () => {
  it('splits a well-formed "City, ST" string', () => {
    expect(normalizeLocationText('Austin, TX')).toEqual({ normalized: 'austin, tx', city: 'austin', state: 'tx' })
  })

  it('falls back to the whole normalized string when it cannot parse city/state -- never fabricates a guess', () => {
    expect(normalizeLocationText('Austin, Texas')).toEqual({ normalized: 'austin, texas', city: null, state: null })
    expect(normalizeLocationText('Remote')).toEqual({ normalized: 'remote', city: null, state: null })
  })

  it('handles null/empty location', () => {
    expect(normalizeLocationText(null)).toEqual({ normalized: '', city: null, state: null })
    expect(normalizeLocationText('')).toEqual({ normalized: '', city: null, state: null })
  })
})

describe('normalizeJobKey (conservative, exact-match dedup key)', () => {
  it('produces the same key for the same role/company/city regardless of casing or company legal suffix', () => {
    const a = normalizeJobKey('Data Analyst', 'Acme Inc.', 'Austin, TX')
    const b = normalizeJobKey('DATA ANALYST', 'Acme LLC', 'Austin, TX')
    expect(a).toBe(b)
  })

  it('produces different keys for different titles -- never collapses distinct openings', () => {
    const a = normalizeJobKey('Data Analyst', 'Acme Inc.', 'Austin, TX')
    const b = normalizeJobKey('Senior Data Analyst', 'Acme Inc.', 'Austin, TX')
    expect(a).not.toBe(b)
  })

  it('produces different keys for different companies', () => {
    const a = normalizeJobKey('Data Analyst', 'Acme Inc.', 'Austin, TX')
    const b = normalizeJobKey('Data Analyst', 'Globex Inc.', 'Austin, TX')
    expect(a).not.toBe(b)
  })

  it('is a known, accepted limitation: an unparseable location variant (e.g. full state name) does not match an abbreviated one', () => {
    const a = normalizeJobKey('Data Analyst', 'Acme Inc.', 'Austin, TX')
    const b = normalizeJobKey('Data Analyst', 'Acme Inc.', 'Austin, Texas')
    expect(a).not.toBe(b)
  })
})

describe('inferWorkModel', () => {
  it('detects remote from the location field', () => {
    expect(inferWorkModel('Data Analyst', 'Remote', '')).toBe('remote')
  })

  it('detects remote from the title when location is missing', () => {
    expect(inferWorkModel('Remote Data Analyst', null, '')).toBe('remote')
  })

  it('detects hybrid language in the description', () => {
    expect(inferWorkModel('Data Analyst', 'Austin, TX', 'This is a hybrid role, 3 days in office.')).toBe('hybrid')
  })

  it('defaults to onsite when a concrete non-remote location is given with no other signal', () => {
    expect(inferWorkModel('Data Analyst', 'Austin, TX', '')).toBe('onsite')
  })

  it('is unknown when there is no location or work-model language at all', () => {
    expect(inferWorkModel('Data Analyst', null, 'General role description.')).toBe('unknown')
  })

  it('does not scan free-text description for "remote" -- avoids false positives like "not a remote position"', () => {
    expect(inferWorkModel('Data Analyst', 'Austin, TX', 'This is not a remote position.')).toBe('onsite')
  })
})

describe('normalizeEmploymentType', () => {
  it('maps common full-time variants', () => {
    expect(normalizeEmploymentType('Full-time')).toBe('full_time')
    expect(normalizeEmploymentType('FULLTIME')).toBe('full_time')
  })

  it('maps common part-time variants', () => {
    expect(normalizeEmploymentType('Part time')).toBe('part_time')
  })

  it('maps contract/freelance variants', () => {
    expect(normalizeEmploymentType('Contractor')).toBe('contract')
    expect(normalizeEmploymentType('Freelance')).toBe('contract')
  })

  it('maps internship before other patterns', () => {
    expect(normalizeEmploymentType('Summer Internship')).toBe('internship')
  })

  it('is unknown for null/empty/unrecognized text -- never fabricates a category', () => {
    expect(normalizeEmploymentType(null)).toBe('unknown')
    expect(normalizeEmploymentType('')).toBe('unknown')
    expect(normalizeEmploymentType('Something Weird')).toBe('unknown')
  })
})

describe('extractMinYearsExperience', () => {
  it('extracts a "+" years requirement', () => {
    expect(extractMinYearsExperience('5+ years of experience required.')).toBe(5)
  })

  it('extracts the minimum from a range', () => {
    expect(extractMinYearsExperience('3-5 years of experience.')).toBe(3)
  })

  it('extracts a plain years mention', () => {
    expect(extractMinYearsExperience('At least 2 years experience.')).toBe(2)
  })

  it('returns null (never 0) when no years requirement is mentioned -- Unknown, not "no experience required"', () => {
    expect(extractMinYearsExperience('No specific experience requirement listed.')).toBeNull()
  })
})

describe('extractEducationRequirement', () => {
  it('detects a bachelor requirement', () => {
    expect(extractEducationRequirement("Bachelor's degree required.")).toBe('bachelor')
  })

  it('detects the highest level mentioned when multiple are present', () => {
    expect(extractEducationRequirement("Bachelor's degree required, Master's preferred.")).toBe('master')
  })

  it('detects a doctorate/PhD requirement', () => {
    expect(extractEducationRequirement('PhD in Computer Science required.')).toBe('doctorate')
  })

  it('returns null (never a default) when no education requirement is mentioned', () => {
    expect(extractEducationRequirement('No education requirement listed.')).toBeNull()
  })
})

describe('extractResponsibilities', () => {
  it('extracts a real bulleted list under a Responsibilities heading, stopping at the next section', () => {
    const description = [
      'About Acme.',
      'Responsibilities:',
      '- Own the roadmap',
      '- Partner with engineering',
      '- Ship features',
      'Requirements:',
      '- 5 years experience',
    ].join('\n')

    const result = extractResponsibilities(description)
    expect(result).toEqual(['Own the roadmap', 'Partner with engineering', 'Ship features'])
  })

  it('returns [] when there is a heading but no splittable delimiter (collapsed single-line JD text)', () => {
    const description =
      'About Acme. Responsibilities: Own the roadmap partner with engineering ship features. Requirements: 5 years experience.'
    expect(extractResponsibilities(description)).toEqual([])
  })

  it('returns [] when there is no Responsibilities-style heading at all', () => {
    expect(extractResponsibilities('Just a general job description with no structure.')).toEqual([])
  })

  it('recognizes the "What you\'ll do" heading variant', () => {
    const description = ["What you'll do:", '- Build things', '- Ship things', 'Requirements:', '- SQL'].join('\n')
    expect(extractResponsibilities(description)).toEqual(['Build things', 'Ship things'])
  })
})

describe('normalizePostedAt', () => {
  it('canonicalizes a valid date to YYYY-MM-DD', () => {
    expect(normalizePostedAt('2026-01-05T00:00:00.000Z')).toBe('2026-01-05')
  })

  it('returns null (never fabricates today) for null/unparseable input', () => {
    expect(normalizePostedAt(null)).toBeNull()
    expect(normalizePostedAt('not a date')).toBeNull()
  })
})

describe('normalizeApplyUrl', () => {
  it('passes through a safe https URL', () => {
    expect(normalizeApplyUrl('https://example.com/jobs/1')).toBe('https://example.com/jobs/1')
  })

  it('rejects a javascript: URL -- reuses the same safe-URL guard as every other render site', () => {
    expect(normalizeApplyUrl('javascript:alert(1)')).toBeNull()
  })

  it('returns null for null/empty/malformed input', () => {
    expect(normalizeApplyUrl(null)).toBeNull()
    expect(normalizeApplyUrl('')).toBeNull()
    expect(normalizeApplyUrl('not a url')).toBeNull()
  })
})

describe('getSourceReliability', () => {
  it('ranks the documented public ATS APIs highest', () => {
    expect(getSourceReliability('greenhouse')).toBeGreaterThan(getSourceReliability('adzuna'))
    expect(getSourceReliability('lever')).toBeGreaterThan(getSourceReliability('adzuna'))
    expect(getSourceReliability('ashby')).toBeGreaterThan(getSourceReliability('adzuna'))
  })

  it('ranks the licensed aggregator below the ATS boards that publish first-hand', () => {
    // Adzuna republishes a posting, one hop further from the employer than
    // an ATS board -- so an ATS record wins the tie for the same opening.
    const adzuna = getSourceReliability('adzuna')
    expect(adzuna).toBeGreaterThan(0)
    expect(adzuna).toBeLessThan(getSourceReliability('greenhouse'))
  })

  it('ranks member-submitted below the documented APIs', () => {
    const memberSubmitted = getSourceReliability('member-submitted')
    expect(memberSubmitted).toBeGreaterThan(0)
    expect(memberSubmitted).toBeLessThan(getSourceReliability('greenhouse'))
  })

  it('defaults unknown sources to the lowest reliability rather than throwing', () => {
    expect(getSourceReliability('some-new-source')).toBe(0)
  })

  it('gives every ingested source an explicit entry -- a missing one silently loses all dedup ties', () => {
    // Regression: `adzuna` shipped without an entry and scored 0, below even
    // the retired Indeed scrape. Any source written into `scraped_jobs` must
    // be ranked here deliberately, not by falling through to the default.
    for (const source of ['greenhouse', 'lever', 'ashby', 'adzuna', 'member-submitted']) {
      expect(getSourceReliability(source)).toBeGreaterThan(0)
    }
  })
})

describe('normalizeJob (composition)', () => {
  it('composes every normalized field from one raw job', () => {
    const result = normalizeJob(makeJob())

    expect(result.normalizedTitle).toBe('data analyst')
    expect(result.normalizedCompany).toBe('acme')
    expect(result.normalizedLocation).toEqual({ normalized: 'austin, tx', city: 'austin', state: 'tx' })
    expect(result.dedupeKey).toBe('data analyst|acme|austin')
    expect(result.workModel).toBe('onsite')
    expect(result.employmentType).toBe('full_time')
    expect(result.seniorityLevel).toBe(2) // mid-level default, reused from freshFitScore/seniority.ts
    expect(result.skills).toEqual(expect.arrayContaining(['sql']))
    expect(result.salaryRange).toEqual({ min: 60000, max: 70000 })
    expect(result.postedAt).toBe('2026-01-05')
    expect(result.source).toBe('greenhouse')
    expect(result.sourceReliability).toBe(3)
    expect(result.applyUrl).toBe('https://boards.greenhouse.io/acme/jobs/1')
  })

  it('degrades gracefully for a sparse job with almost no free-text signal (missing data, never a crash)', () => {
    const result = normalizeJob(
      makeJob({ description: '', salary_text: null, employment_type: null, posted_at: null, posting_url: '' })
    )
    expect(result.salaryRange).toBeNull()
    expect(result.employmentType).toBe('unknown')
    expect(result.postedAt).toBeNull()
    expect(result.applyUrl).toBeNull()
    expect(result.minYearsExperience).toBeNull()
    expect(result.educationRequirement).toBeNull()
    expect(result.responsibilities).toEqual([])
  })

  it('never fabricates data for a malformed/unsafe apply URL', () => {
    const result = normalizeJob(makeJob({ posting_url: 'javascript:alert(1)' }))
    expect(result.applyUrl).toBeNull()
  })
})
