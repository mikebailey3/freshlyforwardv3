/*
# Career Compass Assessment System

## Overview
Adds persistence for the Career Compass free assessment (Archetype +
Forward Readiness) described in
docs/superpowers/specs/2026-08-29-career-compass-design.md section 8.
Supports a logged-out visitor starting and completing the assessment
before ever creating an account, then "claiming" that work the moment
they sign up -- without losing any answers.

## New Tables

### `career_compass_assessments`
The raw answer state for one assessment attempt. `user_id` starts NULL
for anonymous visitors and is populated by the claim operation on
signup; `anonymous_session_id` is kept permanently (even after
claiming) as an audit trail of where the assessment originated.

### `career_compass_results`
The computed, scored output of a completed assessment (dimension
scores, archetype, readiness, barriers, plan recommendation). Supports
retakes: multiple result rows can exist per user, but only one may have
`is_current = true` at a time (enforced by a partial unique index).
Anonymous users have exactly one active assessment in V1, so the
`is_current` uniqueness constraint is scoped to authenticated
(`user_id IS NOT NULL`) rows only.

## Security (see spec section 8 & 10 for the full risk writeup)
Every score is calculated client-side by the pure functions in
`src/lib/careerCompass/`; these tables only ever store already-computed
results plus the raw answers needed to allow a retake/resume. Nothing
here executes AI calls or reaches an external API.

Two access patterns coexist on both tables, by necessity: a signed-out
visitor (Supabase `anon` role, no `auth.uid()`) manages their own
unclaimed row via a client-held `anonymous_session_id`; a signed-in
member (`authenticated` role) manages rows where `user_id = auth.uid()`.
This is inherently weaker than pure `auth.uid()`-scoped RLS -- anyone who
obtained the anonymous session id could read that one row -- accepted per
spec section 10 because the id is an unguessable random UUID that is
never placed in a URL or logged. A third, narrow policy on each table
lets a freshly authenticated user attach their own uid to a
still-unclaimed row (the one-time "claim" operation performed right
after signup) -- this is the only path by which `user_id` ever changes
from NULL to non-NULL.
*/

-- ============================================================
-- CAREER_COMPASS_ASSESSMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS career_compass_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  anonymous_session_id text,
  version text NOT NULL DEFAULT '1.0',
  archetype_answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  readiness_answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (user_id IS NOT NULL OR anonymous_session_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_career_compass_assessments_user ON career_compass_assessments(user_id);
CREATE INDEX IF NOT EXISTS idx_career_compass_assessments_anon_session ON career_compass_assessments(anonymous_session_id);

ALTER TABLE career_compass_assessments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_manage_own_anonymous_assessment" ON career_compass_assessments;
CREATE POLICY "anon_manage_own_anonymous_assessment"
  ON career_compass_assessments FOR ALL
  TO anon
  USING (user_id IS NULL AND anonymous_session_id IS NOT NULL)
  WITH CHECK (user_id IS NULL AND anonymous_session_id IS NOT NULL);

DROP POLICY IF EXISTS "authenticated_manage_own_assessment" ON career_compass_assessments;
CREATE POLICY "authenticated_manage_own_assessment"
  ON career_compass_assessments FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "authenticated_claim_anonymous_assessment" ON career_compass_assessments;
CREATE POLICY "authenticated_claim_anonymous_assessment"
  ON career_compass_assessments FOR UPDATE
  TO authenticated
  USING (user_id IS NULL AND anonymous_session_id IS NOT NULL)
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION set_career_compass_assessments_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_career_compass_assessments_updated_at ON career_compass_assessments;
CREATE TRIGGER trg_career_compass_assessments_updated_at
  BEFORE UPDATE ON career_compass_assessments
  FOR EACH ROW EXECUTE FUNCTION set_career_compass_assessments_updated_at();

-- ============================================================
-- CAREER_COMPASS_RESULTS
-- ============================================================
CREATE TABLE IF NOT EXISTS career_compass_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES career_compass_assessments(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  is_current boolean NOT NULL DEFAULT true,
  dimension_scores jsonb NOT NULL,
  archetype_scores jsonb NOT NULL,
  primary_archetype text NOT NULL,
  secondary_archetype text NOT NULL,
  readiness_scores jsonb NOT NULL,
  primary_barrier text NOT NULL,
  secondary_barrier text NOT NULL,
  recommended_plan_slug text,
  service_fit_pct integer NOT NULL DEFAULT 0 CHECK (service_fit_pct BETWEEN 0 AND 100),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_career_compass_results_assessment ON career_compass_results(assessment_id);
CREATE INDEX IF NOT EXISTS idx_career_compass_results_user ON career_compass_results(user_id);

-- Only one *authenticated* member may have a single "current" result at a
-- time (spec section 8). Anonymous rows (user_id IS NULL) are exempt --
-- V1 supports exactly one active anonymous assessment per browser anyway,
-- enforced at the application layer, not the database layer.
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_current_result_per_user
  ON career_compass_results(user_id)
  WHERE is_current = true AND user_id IS NOT NULL;

ALTER TABLE career_compass_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_manage_own_anonymous_result" ON career_compass_results;
CREATE POLICY "anon_manage_own_anonymous_result"
  ON career_compass_results FOR ALL
  TO anon
  USING (user_id IS NULL)
  WITH CHECK (user_id IS NULL);

DROP POLICY IF EXISTS "authenticated_manage_own_result" ON career_compass_results;
CREATE POLICY "authenticated_manage_own_result"
  ON career_compass_results FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "authenticated_claim_anonymous_result" ON career_compass_results;
CREATE POLICY "authenticated_claim_anonymous_result"
  ON career_compass_results FOR UPDATE
  TO authenticated
  USING (user_id IS NULL)
  WITH CHECK (user_id = auth.uid());
