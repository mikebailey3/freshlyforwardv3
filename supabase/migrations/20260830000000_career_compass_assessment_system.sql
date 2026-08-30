/*
# Career Compass Assessment System

## Overview
Adds persistence for the Career Compass free assessment (Archetype +
Forward Readiness) described in
docs/superpowers/specs/2026-08-29-career-compass-design.md section 8.
Supports a logged-out visitor starting and completing the assessment
before ever creating an account, then signing up and having that work
carry over automatically -- without losing any answers.

## Identity model (see spec section 8, revised 2026-08-30)
Every visitor -- anonymous or permanent -- gets a real, if temporary,
`auth.uid()` via Supabase Anonymous Sign-In (`auth.signInAnonymously()`,
called client-side in `src/lib/careerCompass/session.ts`). Anonymous
Sign-In issues a genuine JWT under the `authenticated` Postgres role
(the user row is simply flagged `is_anonymous = true`), so both tables
below use one ordinary `user_id = auth.uid()` ownership policy -- the
same pattern already used everywhere else in this schema. `user_id` is
NEVER nullable: there is no "unclaimed" state to represent, because the
uid exists from the moment the visitor starts the assessment.

An earlier version of this migration used a client-generated
`anonymous_session_id` string as the access-control boundary instead.
That could not actually be enforced by RLS -- the shared `anon` role has
no per-visitor identity to check a value against -- and was caught in
review as a full read/write/claim exposure across every visitor's data
before ever being applied to a real database. This version replaces
that design entirely; there is no `anon`-role policy on either table.

## New Tables

### `career_compass_assessments`
The raw answer state for one assessment attempt.

### `career_compass_results`
The computed, scored output of a completed assessment (dimension
scores, archetype, readiness, barriers, plan recommendation). Supports
retakes: multiple result rows can exist per user, but only one may have
`is_current = true` at a time (enforced by a unique index -- this now
applies uniformly to every user, anonymous or permanent, since `user_id`
is always present).

## Security
Every score is calculated client-side by the pure functions in
`src/lib/careerCompass/`; these tables only ever store already-computed
results plus the raw answers needed to allow a retake/resume. Nothing
here executes AI calls or reaches an external API. "Claiming" an
anonymous visitor's work on signup is an identity-layer operation
(`supabase.auth.updateUser()` converting the anonymous account to a
permanent one in place -- see `AuthContext.signUp`), not a data
operation: `auth.uid()` never changes during that conversion, so the
single ownership policy below keeps working, unmodified, before and
after signup.
*/

-- ============================================================
-- CAREER_COMPASS_ASSESSMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS career_compass_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version text NOT NULL DEFAULT '1.0',
  archetype_answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  readiness_answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_career_compass_assessments_user ON career_compass_assessments(user_id);

ALTER TABLE career_compass_assessments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "manage_own_assessment" ON career_compass_assessments;
CREATE POLICY "manage_own_assessment"
  ON career_compass_assessments FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
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
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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

-- Only one "current" result at a time, for every user (anonymous or
-- permanent -- user_id is always present under this identity model).
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_current_result_per_user
  ON career_compass_results(user_id)
  WHERE is_current = true;

ALTER TABLE career_compass_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "manage_own_result" ON career_compass_results;
CREATE POLICY "manage_own_result"
  ON career_compass_results FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
