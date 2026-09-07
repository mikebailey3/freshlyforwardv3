/*
# ForwardOS Project 2 -- Career Vault + Capability Engine

## Overview
Adds career_wins (verbatim member-authored evidence) and
career_win_capabilities (the evidence-to-skill relationship, serving as
both suggestion and confirmed-evidence record via its `status` column).
Purely additive -- no existing table, column, trigger, or policy is
modified. See docs/superpowers/specs/2026-09-01-career-vault-capability-engine-design.md
sections 4, 7.1, and 14.

## Locked v1 rule (spec section 7.1, Decision 1)
career_win_capabilities.suggested_state is constrained to the single
literal value 'demonstrated'. A single Career Win can never suggest or
write 'supported' in v1. Widening this constraint is a future,
separate, additive migration once stronger/multiple-evidence criteria
for 'supported' are designed -- not scaffolded here.

## Search Readiness
This migration does not touch member_profiles, search_readiness_score,
or any badge trigger. See spec section 12 for the full protected
dependency list.

## Recovery note (2026-09-08) -- content vs. the original branch draft
This is the Career Vault / Capability Engine migration originally
authored on the (never-merged) `career-vault-capability-engine` branch
on 2026-09-01, recovered here via selective transplant per
docs/superpowers/plans/2026-09-08-career-vault-capability-engine-recovery.md.
Before recovery, this SQL was re-reviewed against every migration that
landed on `main` after 2026-09-01 (hardening migration
20260902021400, member_profiles privileged-fields migration
20260902040000, FreshFit engine v2 20260905000000, and the Roadmap
write-path repair 20260907000000). Findings:

- RLS logic, the `strategist_assignments` + `is_active = true` join,
  and the `auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'` idiom are
  unchanged and still exactly current -- the Sept 2 hardening
  migration reaffirms this exact pattern elsewhere, so no RLS logic
  changes were made here.
- Indexes, grants, and table structure needed no changes -- this
  migration creates no callable RPC (only two ordinary `updated_at`
  triggers), so the hardening migration's `REVOKE EXECUTE ...
  FROM PUBLIC, anon` treatment (which targets directly-callable
  functions) does not apply here, matching the precedent already set
  by the unmodified `career_scope`/`career_skills` triggers in
  20260831000000_forward_dna.sql.
- Two purely mechanical naming/qualification changes WERE made,
  because 20260907000000_add_roadmap_milestone_rpc.sql explicitly
  documents a tightened current convention ("current official Supabase
  guidance: SET search_path = '' ... with every public.-schema
  reference explicitly qualified, rather than SET search_path =
  public") and the Sept 2 hardening migration's own RLS policies
  already fully-qualify cross-table references (`public.strategist_assignments`,
  not bare `strategist_assignments`):
    1. Both trigger functions now use `SET search_path = ''` instead
       of `SET search_path = public` (their bodies reference no other
       objects, so no other body change was needed).
    2. Every table/type reference in this migration (`CREATE TABLE`,
       `REFERENCES`, `CREATE INDEX`, `CREATE POLICY ... ON`, and the
       `strategist_assignments` lookups inside the two SELECT
       policies) is now schema-qualified with `public.`, matching the
       fully-qualified style already used in
       20260907000000_add_roadmap_milestone_rpc.sql.
  No RLS decision, permission boundary, index, grant, or table
  structure changed as a result -- this is qualification-only.
- Not applied to any database. No SQL executed. No Edge Function
  deployed. Live Supabase application and verification are handled
  separately from this recovery.
*/

-- ============================================================
-- CAREER_WINS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.career_wins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  employment_entry_id text,
  original_statement text NOT NULL,
  evidence_type text NOT NULL DEFAULT 'accomplishment',
  category text,
  metric_type text,
  metric_value numeric,
  metric_raw text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_career_wins_user ON public.career_wins(user_id);

ALTER TABLE public.career_wins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "manage_own_career_wins" ON public.career_wins;
CREATE POLICY "manage_own_career_wins"
  ON public.career_wins FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "select_career_wins_strategist" ON public.career_wins;
CREATE POLICY "select_career_wins_strategist"
  ON public.career_wins FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR auth.uid() IN (
      SELECT strategist_id FROM public.strategist_assignments
      WHERE public.strategist_assignments.member_id = public.career_wins.user_id
      AND public.strategist_assignments.is_active = true
    )
    OR auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  );

CREATE OR REPLACE FUNCTION public.set_career_wins_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_career_wins_updated_at ON public.career_wins;
CREATE TRIGGER trg_career_wins_updated_at
  BEFORE UPDATE ON public.career_wins
  FOR EACH ROW EXECUTE FUNCTION public.set_career_wins_updated_at();

-- ============================================================
-- CAREER_WIN_CAPABILITIES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.career_win_capabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  career_win_id uuid NOT NULL REFERENCES public.career_wins(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  skill_name text NOT NULL,
  suggested_state text NOT NULL DEFAULT 'demonstrated' CHECK (suggested_state = 'demonstrated'),
  source text NOT NULL CHECK (source IN ('system', 'member')),
  inference_reason text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected')),
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (career_win_id, skill_name)
);

CREATE INDEX IF NOT EXISTS idx_career_win_capabilities_user_skill ON public.career_win_capabilities(user_id, skill_name);
CREATE INDEX IF NOT EXISTS idx_career_win_capabilities_win ON public.career_win_capabilities(career_win_id);

ALTER TABLE public.career_win_capabilities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "manage_own_career_win_capabilities" ON public.career_win_capabilities;
CREATE POLICY "manage_own_career_win_capabilities"
  ON public.career_win_capabilities FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "select_career_win_capabilities_strategist" ON public.career_win_capabilities;
CREATE POLICY "select_career_win_capabilities_strategist"
  ON public.career_win_capabilities FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR auth.uid() IN (
      SELECT strategist_id FROM public.strategist_assignments
      WHERE public.strategist_assignments.member_id = public.career_win_capabilities.user_id
      AND public.strategist_assignments.is_active = true
    )
    OR auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  );
