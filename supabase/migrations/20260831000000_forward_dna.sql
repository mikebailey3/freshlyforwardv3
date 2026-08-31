/*
# ForwardOS Project 1 -- Forward DNA

## Overview
Adds structured storage for Professional Scope, Responsibilities, and
skill evidence states, per
docs/superpowers/specs/2026-08-31-forward-dna-design.md sections 4 and 6.
Also adds two optional structured career-goal columns to
member_profiles. This migration is purely additive: no existing table,
column, trigger, or policy is modified. member_profiles.search_readiness_score,
its "search-ready" badge trigger, and skills (text[]) are left completely
untouched -- see spec section 2 for why consolidation is explicitly deferred.

## employment_entry_id
employment_history is a jsonb array on member_profiles, not a table, so
there is no foreign key to reference. Each EmploymentEntry gains a
client-generated `id` field (backfilled lazily by
src/lib/forwardDna/employmentEntryIds.ts on first read/save). The new
tables below reference that id as plain text, matched at the
application layer -- there is no DB-level referential integrity to a
jsonb array element, an accepted trade-off since jsonb array elements
cannot be foreign-key targets in Postgres.

## New tables
- career_scope: revenue/team-size/budget metrics per employment entry.
- career_responsibilities: tags per employment entry.
- career_skills: claimed/demonstrated/supported evidence state per
  named skill. Coexists with the existing skills (text[]) column on
  member_profiles; a one-time client-side backfill
  (src/lib/forwardDna/skills.ts:syncSkillsFromProfile) copies any
  skill missing from this table in as `state = 'claimed'`.

## Security
All three tables follow the exact same RLS pattern as every other
member-owned table in this schema: FOR ALL TO authenticated USING
(user_id = auth.uid()) WITH CHECK (user_id = auth.uid()). No anon-role
policy exists on any of them -- Forward DNA is a signed-in-only feature.
*/

-- ============================================================
-- MEMBER_PROFILES: new optional structured career-goal columns
-- ============================================================
ALTER TABLE member_profiles
  ADD COLUMN IF NOT EXISTS target_role text,
  ADD COLUMN IF NOT EXISTS target_timeframe text;

-- ============================================================
-- CAREER_SCOPE
-- ============================================================
CREATE TABLE IF NOT EXISTS career_scope (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  employment_entry_id text NOT NULL,
  revenue_managed_cents bigint,
  team_size integer,
  budget_managed_cents bigint,
  direct_reports integer,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, employment_entry_id)
);

CREATE INDEX IF NOT EXISTS idx_career_scope_user ON career_scope(user_id);

ALTER TABLE career_scope ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "manage_own_career_scope" ON career_scope;
CREATE POLICY "manage_own_career_scope"
  ON career_scope FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION set_career_scope_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_career_scope_updated_at ON career_scope;
CREATE TRIGGER trg_career_scope_updated_at
  BEFORE UPDATE ON career_scope
  FOR EACH ROW EXECUTE FUNCTION set_career_scope_updated_at();

-- ============================================================
-- CAREER_RESPONSIBILITIES
-- ============================================================
CREATE TABLE IF NOT EXISTS career_responsibilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  employment_entry_id text NOT NULL,
  tag text NOT NULL,
  category text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_career_responsibilities_user ON career_responsibilities(user_id);
CREATE INDEX IF NOT EXISTS idx_career_responsibilities_entry ON career_responsibilities(user_id, employment_entry_id);

ALTER TABLE career_responsibilities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "manage_own_career_responsibilities" ON career_responsibilities;
CREATE POLICY "manage_own_career_responsibilities"
  ON career_responsibilities FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- CAREER_SKILLS
-- ============================================================
CREATE TABLE IF NOT EXISTS career_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  skill_name text NOT NULL,
  state text NOT NULL DEFAULT 'claimed' CHECK (state IN ('claimed', 'demonstrated', 'supported')),
  evidence_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, skill_name)
);

CREATE INDEX IF NOT EXISTS idx_career_skills_user ON career_skills(user_id);

ALTER TABLE career_skills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "manage_own_career_skills" ON career_skills;
CREATE POLICY "manage_own_career_skills"
  ON career_skills FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION set_career_skills_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_career_skills_updated_at ON career_skills;
CREATE TRIGGER trg_career_skills_updated_at
  BEFORE UPDATE ON career_skills
  FOR EACH ROW EXECUTE FUNCTION set_career_skills_updated_at();
