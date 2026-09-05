import { describe, it, expect } from 'vitest'
import { computeFreshFitScore } from './score'
import { getFreshFitTier } from './tiers'
import type { MemberProfile, ScrapedJob, EmploymentEntry } from '@/types'

/**
 * End-to-end behavioral verification of the full composite FreshFit
 * engine (as opposed to score.test.ts's per-dimension-aware but still
 * fairly synthetic cases). Each `it` here corresponds 1:1 to a scenario
 * from the FreshFit 2.0 independent verification checklist: strong
 * match, poor match, career changer, underqualified, overqualified,
 * sparse profile, rich profile, cross-member isolation. This file adds
 * no new production behavior -- it only proves the existing engine
 * behaves sensibly end-to-end across these realistic situations.
 */

function entry(overrides: Partial<EmploymentEntry> = {}): EmploymentEntry {
  return { company: 'Acme', title: 'Analyst', start_date: '2020-01-01', end_date: null, current: true, description: '', ...overrides }
}

function makeProfile(overrides: Partial<MemberProfile> = {}): MemberProfile {
  return {
    id: 'p1', user_id: 'user-1', plan_id: null, status: 'active', username: null, avatar_url: null,
    headline: null, summary: null, full_name: 'Test Member', phone: null, location: null,
    linkedin_url: null, portfolio_url: null, employment_history: [], education: [], certifications: [],
    skills: [], preferred_jobs: [], jobs_to_avoid: [], preferred_industries: [],
    salary_min: null, salary_max: null, salary_currency: 'USD', preferred_benefits: [],
    schedule_preference: null, max_commute_minutes: null, remote_preference: null,
    willing_to_relocate: null, travel_willingness: null, work_style: null,
    career_goals: null, strengths: null, weaknesses: null, jobs_enjoyed: null, jobs_not_enjoyed: null,
    motivators: null, biggest_challenge: null, target_role: null, target_timeframe: null,
    application_authorized: true, electronic_consent: true, consent_date: null,
    search_readiness_score: 0, onboarding_completed: true, onboarding_completed_at: null,
    stripe_customer_id: null, stripe_subscription_id: null, subscription_status: 'active',
    account_status: 'active', account_status_reason: null, account_status_changed_at: null,
    is_strategist: false, created_at: '2020-01-01', updated_at: '2020-01-01',
    ...overrides,
  } as MemberProfile
}

function makeJob(overrides: Partial<ScrapedJob> = {}): ScrapedJob {
  return {
    id: 'job-1', source: 'test', external_id: 'ext-1', title: 'Data Analyst', company: 'TestCo',
    location: 'Austin, TX', description: 'Looking for a data analyst with SQL and analytics experience.',
    salary_text: '$60,000 - $75,000', employment_type: 'full-time', posting_url: 'https://example.com/job',
    posted_at: '2026-01-01', search_query: null, is_active: true, scraped_at: '2026-01-01', created_at: '2026-01-01',
    ...overrides,
  } as ScrapedJob
}

describe('FreshFit end-to-end: strong match', () => {
  it('scores highly with an explanation reflecting genuine strengths', () => {
    const profile = makeProfile({
      skills: ['sql', 'analytics', 'data analysis'],
      preferred_jobs: ['Data Analyst'],
      employment_history: [entry({ title: 'Data Analyst', current: true })],
      location: 'Austin, TX',
      salary_min: 55000, salary_max: 70000,
      remote_preference: 'no-preference',
    })
    const job = makeJob()
    const result = computeFreshFitScore(profile, job, { skills: [], scope: [] }, 80)

    expect(result.score).toBeGreaterThanOrEqual(70)
    expect(getFreshFitTier(result.score)).not.toBe('weak')
    expect(result.matchedSkills.length).toBeGreaterThan(0)
    expect(result.hardConstraints.every((c) => c.status !== 'hard_blocker')).toBe(true)
  })
})

describe('FreshFit end-to-end: poor match', () => {
  it('scores low with a useful (non-empty, honest) explanation', () => {
    const profile = makeProfile({
      skills: ['welding', 'forklift', 'construction'],
      preferred_jobs: ['Welder'],
      employment_history: [entry({ title: 'Welder', current: true })],
      location: 'Miami, FL',
    })
    const job = makeJob({ title: 'Registered Nurse', description: 'Seeking a registered nurse with clinical and patient care experience.' })
    const result = computeFreshFitScore(profile, job, { skills: [], scope: [] }, 20)

    expect(result.score).toBeLessThan(40)
    expect(getFreshFitTier(result.score)).toMatch(/weak|fair/)
    // A useful explanation means real gaps, not a silent/empty result.
    expect(result.missingSkills.length).toBeGreaterThan(0)
  })
})

describe('FreshFit end-to-end: career changer', () => {
  it('does not unfairly reject a candidate for a title mismatch when skills and preferred direction align', () => {
    const profile = makeProfile({
      // Transferable skill (per TRANSFERABLE_MAP: sql <- data analysis) plus a direct match.
      skills: ['data analysis', 'analytics'],
      preferred_jobs: ['Data Analyst'], // matches the JD -- this is the direction they're pursuing
      employment_history: [entry({ title: 'Registered Nurse', current: true })], // unrelated past title
    })
    const job = makeJob()
    const result = computeFreshFitScore(profile, job, { skills: [], scope: [] })

    expect(result.score).toBeGreaterThanOrEqual(50)
    const roleDim = result.dimensions.find((d) => d.key === 'roleRelevance')!
    expect(roleDim.explanation.toLowerCase()).toContain('pursuing')
  })
})

describe('FreshFit end-to-end: underqualified', () => {
  it('reflects a real seniority gap in both the score and the gaps list', () => {
    const profile = makeProfile({
      skills: ['analytics'],
      preferred_jobs: [],
      employment_history: [entry({ title: 'Junior Data Analyst', current: true })],
    })
    const job = makeJob({ title: 'Director of Data Analytics', description: 'Seeking a director-level leader for our analytics organization.' })
    const result = computeFreshFitScore(profile, job, { skills: [], scope: [] })

    const roleDim = result.dimensions.find((d) => d.key === 'roleRelevance')!
    expect(roleDim.gaps.some((g) => g.toLowerCase().includes('senior'))).toBe(true)
  })
})

describe('FreshFit end-to-end: overqualified', () => {
  it('notes the potential mismatch rather than scoring purely on "more experience is better"', () => {
    const profile = makeProfile({
      skills: ['leadership', 'management'],
      preferred_jobs: [],
      employment_history: [entry({ title: 'Director of Sales', current: true })],
      salary_min: 150000,
    })
    const job = makeJob({
      title: 'Junior Sales Associate',
      description: 'Entry-level sales associate role, in-office.',
      salary_text: '$40,000 - $45,000',
    })
    const result = computeFreshFitScore(profile, job, { skills: [], scope: [] })

    const roleDim = result.dimensions.find((d) => d.key === 'roleRelevance')!
    expect(roleDim.explanation.toLowerCase()).toContain('junior')
    // Score is not maxed out just because the candidate has more experience --
    // the comp mismatch (director-level salary floor vs. entry-level pay) is a
    // real, separate signal that should show up as a hard constraint.
    expect(result.hardConstraints.some((c) => c.key === 'compensationFloor' && c.status === 'hard_blocker')).toBe(true)
  })
})

describe('FreshFit end-to-end: sparse profile', () => {
  it('degrades gracefully -- no crash, no fabricated certainty, low confidence', () => {
    const profile = makeProfile() // everything empty/null by default
    const job = makeJob()
    const result = computeFreshFitScore(profile, job, { skills: [], scope: [] }, null)

    expect(Number.isFinite(result.score)).toBe(true)
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(100)
    expect(result.confidence).toBe('low')
    // Nothing should be reported as a confirmed gap purely from silence --
    // an empty profile means unknowns, not confirmed mismatches.
    const roleDim = result.dimensions.find((d) => d.key === 'roleRelevance')!
    expect(roleDim.status).toBe('no-data')
    expect(roleDim.gaps).toEqual([])
  })
})

describe('FreshFit end-to-end: rich profile', () => {
  it('does not inflate the score purely because more (mostly irrelevant) data exists', () => {
    const job = makeJob()
    const leanProfile = makeProfile({
      skills: ['sql', 'analytics'],
      preferred_jobs: ['Data Analyst'],
      employment_history: [entry({ title: 'Data Analyst', current: true })],
    })
    const richProfile = makeProfile({
      skills: [
        'sql', 'analytics', 'welding', 'forklift', 'construction', 'plumbing', 'hvac',
        'nursing', 'patient care', 'graphic design', 'video editing', 'bilingual', 'spanish',
      ],
      preferred_jobs: ['Data Analyst'],
      employment_history: [entry({ title: 'Data Analyst', current: true })],
      education: [{ institution: 'State University', degree: 'BA', field_of_study: 'Business', start_date: '2010', end_date: '2014', current: false } as never],
      summary: 'Extensive, decorated career across many unrelated industries with many achievements.',
    })

    const leanResult = computeFreshFitScore(leanProfile, job, { skills: [], scope: [] })
    const richResult = computeFreshFitScore(richProfile, job, { skills: [], scope: [] })

    expect(richResult.score).toBeLessThanOrEqual(leanResult.score + 5)
  })
})

describe('FreshFit end-to-end: cross-member isolation', () => {
  it('never lets one member\'s data influence or leak into another member\'s result', () => {
    const memberA = makeProfile({
      user_id: 'member-a',
      skills: ['sql', 'analytics', 'member-a-exclusive-skill'],
      preferred_jobs: ['Data Analyst'],
      employment_history: [entry({ title: 'Data Analyst', current: true })],
    })
    const memberB = makeProfile({
      user_id: 'member-b',
      skills: ['welding', 'forklift', 'member-b-exclusive-skill'],
      preferred_jobs: ['Welder'],
      employment_history: [entry({ title: 'Welder', current: true })],
    })
    const job = makeJob()

    const resultA1 = computeFreshFitScore(memberA, job, { skills: [], scope: [] })
    const resultB = computeFreshFitScore(memberB, job, { skills: [], scope: [] })
    const resultA2 = computeFreshFitScore(memberA, job, { skills: [], scope: [] })

    // Calling B in between two A calls must not change A's result (no shared mutable state).
    expect(resultA1).toEqual(resultA2)

    // Neither result should ever reference the other member's exclusive data.
    const allA = [...resultA1.matchedSkills, ...resultA1.missingSkills, ...resultA1.unknowns]
    const allB = [...resultB.matchedSkills, ...resultB.missingSkills, ...resultB.unknowns]
    expect(allA.some((s) => s.includes('member-b'))).toBe(false)
    expect(allB.some((s) => s.includes('member-a'))).toBe(false)
  })
})
