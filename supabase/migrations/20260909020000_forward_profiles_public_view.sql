-- Forward Profiles: public `/u/:username` pages.
--
-- REVIEW-ONLY DRAFT. NOT APPLIED. Do not run against any Supabase project
-- (local or production) without explicit approval.
--
-- ============================================================================
-- WHAT THIS MIGRATION DOES
-- ============================================================================
-- 1. Adds two new, member-controlled, additive columns to member_profiles:
--      public_profile_enabled boolean NOT NULL DEFAULT false
--      public_profile_sections jsonb  NOT NULL DEFAULT '{...}'
--    Both default to "everything off"/"safe defaults" for every existing
--    row -- no existing member's data becomes public as a side effect of
--    applying this migration. These two columns are NOT added to
--    protect_member_profiles_privileged_fields() (20260902040000) -- they
--    are legitimately member-controlled, same trust tier as `username` and
--    `avatar_url` already are.
--
-- 2. Creates `public_forward_profiles`, a Postgres VIEW with a hard-coded
--    column allow-list, and GRANTs SELECT on that VIEW ONLY to anon and
--    authenticated. member_profiles' own RLS is completely untouched by
--    this migration -- it still has no anon/public SELECT policy, and
--    still never will as a result of this file.
--
-- ============================================================================
-- WHY A VIEW, NOT A ROW-LEVEL RLS POLICY ON THE BASE TABLE
-- ============================================================================
-- Every other anon-readable table in this repo (blog_posts, membership_plans)
-- is one where EVERY column is already meant to be public, so a plain
-- `TO anon USING (...)` row-level policy is safe there. member_profiles is
-- categorically different: alongside headline/employment/skills it also
-- holds phone, salary_min/max, stripe_customer_id/stripe_subscription_id,
-- subscription_status, account_status(+reason), application_authorized,
-- electronic_consent, search_readiness_score, is_strategist, weaknesses,
-- biggest_challenge, jobs_to_avoid, motivators, and more. Postgres RLS is
-- row-level, not column-level -- an anon-readable row-level policy on the
-- base table would still let any anonymous caller `select('*')` and receive
-- every one of those columns for any row the policy allows through,
-- regardless of what a well-behaved client asks for. A VIEW with an
-- explicit column list is the only mechanism that enforces the boundary
-- server-side, independent of what the client requests.
--
-- ============================================================================
-- WHY THE VIEW GATES ON account_status = 'active'
-- ============================================================================
-- account_status is one of the columns protected by
-- protect_member_profiles_privileged_fields() (20260902040000) -- a member
-- cannot flip their own account_status back to 'active' via a client
-- update, so a suspended/banned member's public page reliably stops
-- resolving the moment they're suspended, with no separate enforcement
-- needed here.
--
-- ============================================================================
-- ALLOW-LIST (the security-bearing contract -- keep in sync with
-- src/lib/publicProfile.ts's PUBLIC_PROFILE_ALLOWED_COLUMNS and
-- src/lib/forwardProfilesPublicViewMigration.test.ts)
-- ============================================================================
-- Exposed always (identity/discovery fields, not sensitive):
--   username, avatar_url, full_name, headline, location, linkedin_url,
--   portfolio_url
-- Exposed only when the member's public_profile_sections toggle for that
-- section is true (NULL/empty otherwise, computed inside the view itself):
--   summary, employment_history, education, certifications, skills,
--   career_goals
-- Never exposed, under any toggle combination: every other member_profiles
-- column, full stop.

ALTER TABLE member_profiles
  ADD COLUMN IF NOT EXISTS public_profile_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE member_profiles
  ADD COLUMN IF NOT EXISTS public_profile_sections jsonb NOT NULL DEFAULT
    '{"summary": true, "employment": true, "education": true, "certifications": true, "skills": true, "career_goals": false}'::jsonb;

-- Plain (not lower()-expression) index, deliberately matching the exact
-- equality predicate this feature's own query issues (see
-- getPublicProfileByUsername in src/lib/publicProfile.ts, which always
-- normalizes to lowercase in application code before querying -- same
-- guarantee ProfileCard.tsx already relies on when writing usernames).
-- The separate pre-existing UNIQUE index on lower(username) from
-- 20260821010000_interviews_reports_profile_upgrade.sql is untouched and
-- still the sole enforcer of case-insensitive uniqueness; this index exists
-- purely to keep the new anon-facing lookup path cheap.
CREATE INDEX IF NOT EXISTS idx_member_profiles_public_username
  ON member_profiles (username)
  WHERE public_profile_enabled = true;

CREATE OR REPLACE VIEW public_forward_profiles AS
SELECT
  mp.username,
  mp.avatar_url,
  mp.full_name,
  mp.headline,
  mp.location,
  mp.linkedin_url,
  mp.portfolio_url,
  CASE WHEN (mp.public_profile_sections->>'summary')::boolean
    THEN mp.summary ELSE NULL END AS summary,
  CASE WHEN (mp.public_profile_sections->>'employment')::boolean
    THEN mp.employment_history ELSE '[]'::jsonb END AS employment_history,
  CASE WHEN (mp.public_profile_sections->>'education')::boolean
    THEN mp.education ELSE '[]'::jsonb END AS education,
  CASE WHEN (mp.public_profile_sections->>'certifications')::boolean
    THEN mp.certifications ELSE '[]'::jsonb END AS certifications,
  CASE WHEN (mp.public_profile_sections->>'skills')::boolean
    THEN mp.skills ELSE '[]'::jsonb END AS skills,
  CASE WHEN (mp.public_profile_sections->>'career_goals')::boolean
    THEN mp.career_goals ELSE NULL END AS career_goals
FROM member_profiles mp
WHERE mp.public_profile_enabled = true
  AND mp.username IS NOT NULL
  AND mp.account_status = 'active';

-- Column-list allow-list is enforced by the SELECT list above, not by
-- row-level security on the view -- Postgres views execute with the
-- privileges of the view owner for the columns/expressions they define,
-- so GRANT SELECT on the view is exactly the accesses listed above and
-- nothing else. The base table's RLS remains fully in force for any
-- direct query against member_profiles itself.
GRANT SELECT ON public_forward_profiles TO anon, authenticated;

-- Explicitly confirm no privilege is granted on the base table by this
-- migration. anon has no existing grants on member_profiles today, so this
-- REVOKE is a harmless no-op in practice -- it is included anyway as
-- unambiguous, executable documentation of intent for the next person
-- reading this file, not because it changes any current behavior.
REVOKE ALL ON member_profiles FROM anon;

-- ============================================================================
-- ROLLBACK (for reference; not executed by this file)
-- ============================================================================
-- REVOKE SELECT ON public_forward_profiles FROM anon, authenticated;
-- DROP VIEW IF EXISTS public_forward_profiles;
-- DROP INDEX IF EXISTS idx_member_profiles_public_username;
-- ALTER TABLE member_profiles DROP COLUMN IF EXISTS public_profile_sections;
-- ALTER TABLE member_profiles DROP COLUMN IF EXISTS public_profile_enabled;
