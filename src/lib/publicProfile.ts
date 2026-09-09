import { supabase } from '@/lib/supabase'
import type { PublicProfileViewModel, PublicProfileSections } from '@/types/publicProfile'
import type { EmploymentEntry, EducationEntry, CertificationEntry } from '@/types/index'

/**
 * Reads/writes for Forward Profiles (public `/u/:username` pages).
 *
 * SECURITY: getPublicProfileByUsername queries `public_forward_profiles`, a
 * Postgres VIEW (supabase/migrations/<timestamp>_forward_profiles_public_view.sql,
 * unapplied) with a hard-coded column allow-list -- it never queries
 * `member_profiles` directly. `member_profiles` has no anon/public SELECT
 * policy and this file must never add one. See
 * docs/superpowers/plans/2026-09-09-forward-profiles-implementation.md
 * sections 2 and 5 for the full rationale.
 *
 * PUBLIC_PROFILE_ALLOWED_COLUMNS is deliberately an explicit literal list
 * (never '*') so a future edit that widens this query is caught by
 * publicProfile.test.ts's exact-allow-list assertions instead of silently
 * starting to request whatever the view happens to expose.
 */
export const PUBLIC_PROFILE_ALLOWED_COLUMNS =
  'username, avatar_url, full_name, headline, location, linkedin_url, portfolio_url, summary, employment_history, education, certifications, skills, career_goals'

const PUBLIC_PROFILE_VIEW = 'public_forward_profiles'

interface PublicForwardProfileRow {
  username: string
  avatar_url: string | null
  full_name: string | null
  headline: string | null
  location: string | null
  linkedin_url: string | null
  portfolio_url: string | null
  summary: string | null
  employment_history: EmploymentEntry[] | null
  education: EducationEntry[] | null
  certifications: CertificationEntry[] | null
  skills: string[] | null
  career_goals: string | null
}

function toViewModel(row: PublicForwardProfileRow): PublicProfileViewModel {
  return {
    username: row.username,
    avatarUrl: row.avatar_url,
    fullName: row.full_name,
    headline: row.headline,
    location: row.location,
    linkedinUrl: row.linkedin_url,
    portfolioUrl: row.portfolio_url,
    summary: row.summary,
    employment: row.employment_history ?? [],
    education: row.education ?? [],
    certifications: row.certifications ?? [],
    skills: row.skills ?? [],
    careerGoals: row.career_goals,
  }
}

/**
 * Fetches a public Forward Profile by username, for the public `/u/:username`
 * route. Returns null both when no such profile exists AND when a profile
 * exists but isn't public -- the view itself already filters non-public
 * rows out entirely (public_profile_enabled = true, username set, account
 * active), so this function structurally cannot distinguish "private" from
 * "doesn't exist," which is the correct privacy behavior (never confirm to
 * an anonymous visitor that a given username belongs to a real, just-private
 * account).
 */
export async function getPublicProfileByUsername(username: string): Promise<PublicProfileViewModel | null> {
  const normalized = username.trim().toLowerCase()
  if (!normalized) return null

  const { data, error } = await supabase
    .from(PUBLIC_PROFILE_VIEW)
    .select(PUBLIC_PROFILE_ALLOWED_COLUMNS)
    .eq('username', normalized)
    .maybeSingle()

  if (error) {
    console.error('Error fetching public profile:', error)
    return null
  }
  if (!data) return null

  return toViewModel(data as unknown as PublicForwardProfileRow)
}

export interface UpdatePublicProfileVisibilityInput {
  publicProfileEnabled: boolean
  sections: PublicProfileSections
}

/**
 * Updates the caller's own public-profile visibility settings. Writes go
 * through the existing owner-only `update_own_profile` RLS policy on
 * member_profiles (unchanged by this feature) -- these are just two more
 * columns a member updates about their own row, same as ProfileCard's
 * existing avatar/username flow.
 */
export async function updatePublicProfileVisibility(
  userId: string,
  input: UpdatePublicProfileVisibilityInput,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('member_profiles')
    .update({
      public_profile_enabled: input.publicProfileEnabled,
      public_profile_sections: input.sections,
    })
    .eq('user_id', userId)

  if (error) {
    console.error('Error updating public profile visibility:', error)
    return { error: error.message }
  }
  return { error: null }
}

// Existing top-level route segments (see src/App.tsx) plus a few obviously
// confusing handles. A member can never register one of these as their
// Forward Profiles username, so /u/<reserved> can never be mistaken for
// the real app route of the same name. Hygiene only -- /u/:username is its
// own route namespace and would never actually collide with these routes
// (they don't live under /u/), but a username of "admin" or "settings" is
// still worth blocking outright.
const RESERVED_USERNAMES = new Set([
  'admin', 'strategist', 'settings', 'signin', 'signup', 'dashboard', 'profile',
  'pricing', 'about', 'contact', 'faq', 'privacy', 'terms', 'checkout',
  'onboarding', 'membership', 'careers', 'support', 'help', 'api', 'u',
])

export function isReservedUsername(username: string): boolean {
  return RESERVED_USERNAMES.has(username.trim().toLowerCase())
}
