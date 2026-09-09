import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ProfileEditForm } from './ProfileEditForm'
import type { MemberProfile } from '@/types'

/**
 * Resume Intelligence Phase 3 save-path audit: proves editing one unrelated
 * field never touches the employment/education/certifications arrays --
 * ProfileEditForm.buildInitialFormData reads each field's raw profile value
 * directly (no reconstruction), so an entry's backfilled `id` (an extra key
 * the MemberProfile/EmploymentEntry types don't fully model at the object
 * level in this test) survives an unrelated save untouched, by reference.
 */

const baseProfile: MemberProfile = {
  id: 'profile-1',
  user_id: 'u1',
  plan_id: null,
  status: 'active',
  username: null,
  avatar_url: null,
  public_profile_enabled: false,
  public_profile_sections: { summary: true, employment: true, education: true, certifications: true, skills: true, career_goals: false },
  headline: null,
  summary: null,
  full_name: 'Ada Lovelace',
  phone: null,
  location: null,
  linkedin_url: null,
  portfolio_url: null,
  employment_history: [
    { id: 'entry-1', company: 'Acme', title: 'Manager', start_date: '2020-01', end_date: null, current: true, description: '' } as never,
  ],
  education: [{ id: 'entry-edu-1', institution: 'MIT', degree: 'BS', field: 'CS', graduation_year: '2010' } as never],
  certifications: [{ id: 'entry-cert-1', name: 'PMP', issuer: 'PMI', date: '2022', expiry: null } as never],
  skills: ['SQL', 'Leadership'],
  preferred_jobs: [],
  jobs_to_avoid: [],
  preferred_industries: [],
  salary_min: null,
  salary_max: null,
  salary_currency: 'USD',
  preferred_benefits: [],
  schedule_preference: null,
  max_commute_minutes: null,
  remote_preference: null,
  willing_to_relocate: null,
  travel_willingness: null,
  work_style: null,
  career_goals: null,
  strengths: null,
  weaknesses: null,
  jobs_enjoyed: null,
  jobs_not_enjoyed: null,
  motivators: null,
  biggest_challenge: null,
  target_role: 'VP of Operations',
  target_timeframe: 'within 12 months',
  application_authorized: true,
  electronic_consent: true,
  consent_date: null,
  search_readiness_score: 0,
  onboarding_completed: true,
  onboarding_completed_at: null,
  stripe_customer_id: null,
  stripe_subscription_id: null,
  subscription_status: 'active',
  account_status: 'active',
  account_status_reason: null,
  account_status_changed_at: null,
  is_strategist: false,
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
}

describe('ProfileEditForm: saving an unrelated field preserves canonical entry ids', () => {
  it('editing full_name and saving leaves employment/education/certification ids untouched', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<ProfileEditForm profile={baseProfile} onSave={onSave} onCancel={vi.fn()} />)

    fireEvent.change(screen.getByPlaceholderText('Jane Doe'), { target: { value: 'Ada Byron' } })
    fireEvent.click(screen.getByText('Save Changes'))

    await vi.waitFor(() => expect(onSave).toHaveBeenCalled())

    const [updates] = onSave.mock.calls[0] as [Record<string, unknown>]
    expect(updates.full_name).toBe('Ada Byron')
    expect(updates.employment_history).toEqual(baseProfile.employment_history)
    expect(updates.education).toEqual(baseProfile.education)
    expect(updates.certifications).toEqual(baseProfile.certifications)
    // Same array reference, not just deep-equal -- proves nothing rebuilt it.
    expect(updates.employment_history).toBe(baseProfile.employment_history)
  })
})
