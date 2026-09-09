import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }))

vi.mock('@/lib/supabase', () => ({
  supabase: { from: mockFrom },
}))

import {
  getPublicProfileByUsername,
  updatePublicProfileVisibility,
  isReservedUsername,
  PUBLIC_PROFILE_ALLOWED_COLUMNS,
} from './publicProfile'

function mockSelectChain(result: { data: unknown; error: { message: string } | null }) {
  const maybeSingle = vi.fn().mockResolvedValue(result)
  const eq = vi.fn().mockReturnValue({ maybeSingle })
  const select = vi.fn().mockReturnValue({ eq })
  mockFrom.mockReturnValue({ select })
  return { select, eq, maybeSingle }
}

describe('PUBLIC_PROFILE_ALLOWED_COLUMNS (the security-bearing allow-list)', () => {
  it('never contains any excluded/sensitive member_profiles column', () => {
    const excluded = [
      'phone', 'salary_min', 'salary_max', 'salary_currency', 'preferred_benefits',
      'stripe_customer_id', 'stripe_subscription_id', 'subscription_status',
      'account_status', 'account_status_reason', 'account_status_changed_at',
      'plan_id', 'status', 'application_authorized', 'electronic_consent',
      'consent_date', 'search_readiness_score', 'onboarding_completed',
      'onboarding_completed_at', 'is_strategist', 'weaknesses', 'jobs_to_avoid',
      'jobs_not_enjoyed', 'biggest_challenge', 'motivators', 'strengths',
      'jobs_enjoyed', 'preferred_jobs', 'preferred_industries', 'schedule_preference',
      'max_commute_minutes', 'remote_preference', 'willing_to_relocate',
      'travel_willingness', 'work_style', 'target_timeframe', 'target_role',
      'user_id', 'id', 'public_profile_enabled', 'public_profile_sections',
    ]
    for (const col of excluded) {
      expect(PUBLIC_PROFILE_ALLOWED_COLUMNS).not.toContain(col)
    }
  })

  it('is never the wildcard select', () => {
    expect(PUBLIC_PROFILE_ALLOWED_COLUMNS).not.toBe('*')
    expect(PUBLIC_PROFILE_ALLOWED_COLUMNS).not.toContain('*')
  })

  it('contains exactly the approved public-safe fields', () => {
    const expectedFields = [
      'username', 'avatar_url', 'full_name', 'headline', 'location',
      'linkedin_url', 'portfolio_url', 'summary', 'employment_history',
      'education', 'certifications', 'skills', 'career_goals',
    ]
    const actualFields = PUBLIC_PROFILE_ALLOWED_COLUMNS.split(',').map((c) => c.trim())
    expect(actualFields.sort()).toEqual(expectedFields.sort())
  })
})

describe('getPublicProfileByUsername', () => {
  beforeEach(() => {
    mockFrom.mockReset()
  })

  it('queries the public_forward_profiles VIEW (never the member_profiles base table) with the exact allow-listed columns', async () => {
    mockSelectChain({ data: null, error: null })

    await getPublicProfileByUsername('jordan')

    expect(mockFrom).toHaveBeenCalledWith('public_forward_profiles')
    expect(mockFrom).not.toHaveBeenCalledWith('member_profiles')
  })

  it('requests exactly the allow-listed columns, never a wildcard', async () => {
    const { select } = mockSelectChain({ data: null, error: null })

    await getPublicProfileByUsername('jordan')

    expect(select).toHaveBeenCalledWith(PUBLIC_PROFILE_ALLOWED_COLUMNS)
  })

  it('looks up by lowercased username, matching how usernames are always stored', async () => {
    const { eq } = mockSelectChain({ data: null, error: null })

    await getPublicProfileByUsername('JORDAN')

    expect(eq).toHaveBeenCalledWith('username', 'jordan')
  })

  it('returns null (not an error) when the profile does not exist or is not public -- indistinguishable, by design, since the view already filters non-public rows out entirely', async () => {
    mockSelectChain({ data: null, error: null })

    const result = await getPublicProfileByUsername('nobody')

    expect(result).toBeNull()
  })

  it('returns null and logs instead of throwing on a query error', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockSelectChain({ data: null, error: { message: 'network down' } })

    const result = await getPublicProfileByUsername('jordan')

    expect(result).toBeNull()
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  it('returns null for an empty/whitespace username without ever querying', async () => {
    mockSelectChain({ data: null, error: null })

    const result = await getPublicProfileByUsername('   ')

    expect(result).toBeNull()
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('maps a found row into the camelCase PublicProfileViewModel shape', async () => {
    mockSelectChain({
      data: {
        username: 'jordan',
        avatar_url: 'https://example.com/a.png',
        full_name: 'Jordan Rivera',
        headline: 'Product Manager',
        location: 'Austin, TX',
        linkedin_url: 'https://linkedin.com/in/jordan',
        portfolio_url: null,
        summary: 'Builds things.',
        employment_history: [{ title: 'PM', company: 'Acme', start_date: '2020', end_date: null, current: true, description: '' }],
        education: [],
        certifications: [],
        skills: ['SQL'],
        career_goals: null,
      },
      error: null,
    })

    const result = await getPublicProfileByUsername('jordan')

    expect(result).toEqual({
      username: 'jordan',
      avatarUrl: 'https://example.com/a.png',
      fullName: 'Jordan Rivera',
      headline: 'Product Manager',
      location: 'Austin, TX',
      linkedinUrl: 'https://linkedin.com/in/jordan',
      portfolioUrl: null,
      summary: 'Builds things.',
      employment: [{ title: 'PM', company: 'Acme', start_date: '2020', end_date: null, current: true, description: '' }],
      education: [],
      certifications: [],
      skills: ['SQL'],
      careerGoals: null,
    })
  })

  it('defaults null jsonb arrays to empty arrays rather than passing null through to the page', async () => {
    mockSelectChain({
      data: {
        username: 'jordan', avatar_url: null, full_name: null, headline: null,
        location: null, linkedin_url: null, portfolio_url: null, summary: null,
        employment_history: null, education: null, certifications: null, skills: null,
        career_goals: null,
      },
      error: null,
    })

    const result = await getPublicProfileByUsername('jordan')

    expect(result?.employment).toEqual([])
    expect(result?.education).toEqual([])
    expect(result?.certifications).toEqual([])
    expect(result?.skills).toEqual([])
  })
})

describe('updatePublicProfileVisibility', () => {
  beforeEach(() => {
    mockFrom.mockReset()
  })

  it('updates only public_profile_enabled and public_profile_sections on member_profiles, scoped to the caller', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null })
    const update = vi.fn().mockReturnValue({ eq })
    mockFrom.mockReturnValue({ update })

    const sections = { summary: true, employment: true, education: false, certifications: false, skills: true, career_goals: false }
    const result = await updatePublicProfileVisibility('user-1', { publicProfileEnabled: true, sections })

    expect(mockFrom).toHaveBeenCalledWith('member_profiles')
    expect(update).toHaveBeenCalledWith({ public_profile_enabled: true, public_profile_sections: sections })
    expect(eq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(result).toEqual({ error: null })
  })

  it('surfaces the error to the caller instead of swallowing it', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const eq = vi.fn().mockResolvedValue({ error: { message: 'db unavailable' } })
    mockFrom.mockReturnValue({ update: vi.fn().mockReturnValue({ eq }) })

    const result = await updatePublicProfileVisibility('user-1', {
      publicProfileEnabled: true,
      sections: { summary: true, employment: true, education: true, certifications: true, skills: true, career_goals: false },
    })

    expect(result).toEqual({ error: 'db unavailable' })
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })
})

describe('isReservedUsername', () => {
  it('rejects usernames colliding with existing top-level app routes', () => {
    expect(isReservedUsername('admin')).toBe(true)
    expect(isReservedUsername('strategist')).toBe(true)
    expect(isReservedUsername('settings')).toBe(true)
    expect(isReservedUsername('signin')).toBe(true)
    expect(isReservedUsername('u')).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(isReservedUsername('ADMIN')).toBe(true)
    expect(isReservedUsername('Admin')).toBe(true)
  })

  it('allows ordinary usernames', () => {
    expect(isReservedUsername('jordan')).toBe(false)
    expect(isReservedUsername('jordan_rivera')).toBe(false)
  })
})
