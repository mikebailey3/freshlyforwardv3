-- Forward-only hotfix for a NULL-swallows-authorization-check bug in
-- public.add_roadmap_milestone (originally created by
-- 20260907000000_add_roadmap_milestone_rpc.sql, NOT edited by this
-- migration -- this is a fresh CREATE OR REPLACE on top of it, per repo
-- convention of never editing an already-applied migration file).
--
-- ALREADY HOTFIXED LIVE (per live report, 2026-09-08). This migration
-- brings the repo's migration history in sync with that live hotfix -- it
-- is NOT a proposal pending live application like the reserved-event RLS
-- migration sitting alongside it. It has not been independently re-verified
-- against a live Supabase project from this sandbox (no live access here,
-- as documented throughout this repo's other migrations/tests) -- the root
-- cause was independently re-derived and confirmed from the SQL text alone
-- before writing this file, not simply taken on faith.
--
-- ROOT CAUSE (independently verified against the actual original migration
-- text, not just the incident report):
--   v_caller_is_admin boolean := (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin';
--
-- For any authenticated caller whose JWT app_metadata has no `role` key at
-- all -- i.e. every ordinary member, which is the default/common case --
-- `auth.jwt() -> 'app_metadata' ->> 'role'` evaluates to SQL NULL, and
-- `NULL = 'admin'` evaluates to NULL (SQL three-valued logic: a comparison
-- against NULL is never TRUE or FALSE, it's NULL), NOT false. That NULL
-- then poisons the authorization check:
--
--   IF NOT (
--     auth.uid() = p_member_id      -- FALSE (different member's id)
--     OR v_is_assigned_strategist   -- FALSE (EXISTS(...) never returns NULL)
--     OR v_caller_is_admin          -- NULL  (the bug)
--   ) THEN RAISE EXCEPTION ...
--
-- Three-valued OR: FALSE OR FALSE OR NULL = NULL (not FALSE), because OR
-- only resolves to FALSE when EVERY operand is definitively FALSE -- one
-- NULL operand with no TRUE anywhere makes the whole expression NULL.
-- NOT NULL = NULL. PL/pgSQL treats a NULL IF-condition as if it were FALSE
-- (the THEN branch is skipped, PostgreSQL docs: "if the value is null, the
-- result is as if it were false"). So the RAISE EXCEPTION never fired, and
-- an ordinary member (no assigned-strategist relationship, no admin role --
-- i.e. the default state for every regular member) could call this
-- function with an arbitrary OTHER member's p_member_id and have it
-- silently succeed, inserting a career_roadmap milestone into a stranger's
-- timeline. A genuine authorization bypass, not a cosmetic bug.
--
-- v_is_assigned_strategist has no equivalent risk: it's assigned via
-- `SELECT EXISTS (...) INTO v_is_assigned_strategist`, and EXISTS always
-- returns a definite TRUE or FALSE, never NULL, regardless of how many
-- rows match. Confirmed by re-reading that block specifically before
-- concluding this fix needed to touch only the one line below.
--
-- auth.uid() = p_member_id could theoretically also be NULL if auth.uid()
-- itself were NULL, but this function's REVOKE ALL ... FROM PUBLIC, anon /
-- GRANT EXECUTE ... TO authenticated scoping (preserved unchanged below)
-- structurally guarantees only the `authenticated` role can call it at
-- all, and an authenticated request always carries a valid JWT with a real
-- `sub` claim -- so that path is not reachable in practice and is
-- deliberately NOT touched by this fix, matching the live hotfix's own
-- scope (null-safe admin predicate only).
--
-- THE FIX (the only line that changes, everything else below is byte-for-
-- byte identical to 20260907000000_add_roadmap_milestone_rpc.sql):
--   v_caller_is_admin boolean := COALESCE((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
-- COALESCE forces the NULL case to FALSE, so an ordinary member with no
-- role claim now correctly contributes FALSE (not NULL) to the OR chain,
-- and the exception fires exactly as originally intended.
--
-- Preserved unchanged: SECURITY DEFINER, SET search_path = '' with every
-- reference schema-qualified, the three-way authorization check's
-- structure and ordering, all idempotency behavior (the ON CONFLICT
-- upsert-or-fetch logic, unchanged; the pre-existing unique index from
-- 20260907000000 is not touched or recreated here), and the existing
-- REVOKE/GRANT statements (re-issued below, unchanged, for this
-- migration's own self-contained idempotency -- CREATE OR REPLACE FUNCTION
-- does not by itself alter existing grants, but restating them here means
-- this migration doesn't depend on assuming nothing touched them between
-- the two migrations).

CREATE OR REPLACE FUNCTION public.add_roadmap_milestone(
  p_member_id uuid,
  p_title text,
  p_description text DEFAULT NULL,
  p_event_date timestamptz DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS public.career_timeline
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_is_admin boolean := COALESCE((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
  v_is_assigned_strategist boolean;
  v_result public.career_timeline;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.strategist_assignments sa
    WHERE sa.strategist_id = auth.uid()
      AND sa.member_id = p_member_id
      AND sa.is_active = true
  ) INTO v_is_assigned_strategist;

  -- Three legitimate authors: the member themself (self-service, matches
  -- career_timeline's existing plain RLS semantics), an actively assigned
  -- strategist, or an admin. Anyone else is rejected. Checked before input
  -- validation so an unauthorized caller always gets the same "not
  -- authorized" answer regardless of what they pass for title/description.
  IF NOT (
    auth.uid() = p_member_id
    OR v_is_assigned_strategist
    OR v_caller_is_admin
  ) THEN
    RAISE EXCEPTION 'Not authorized to add a roadmap milestone for this member';
  END IF;

  IF p_title IS NULL OR btrim(p_title) = '' THEN
    RAISE EXCEPTION 'Milestone title is required';
  END IF;

  -- Idempotency: only dedup when the caller opts in with a key (a fresh
  -- client-generated UUID per submit-attempt, re-sent unchanged on retry).
  -- Two independent milestones that merely happen to share a title/date
  -- are NOT deduped -- only literal retries of the same attempt, for the
  -- same member, are. The ON CONFLICT target is scoped to (user_id,
  -- idempotency_key), so two different members can never collide with (or
  -- see) each other's rows via a coincidentally-matching key. When no key
  -- is supplied, metadata->>'idempotency_key' is NULL, which the partial
  -- unique index never indexes, so the insert can never conflict.
  INSERT INTO public.career_timeline (user_id, event_type, event_title, event_description, event_date, metadata)
  VALUES (
    p_member_id,
    'career_roadmap',
    btrim(p_title),
    NULLIF(btrim(COALESCE(p_description, '')), ''),
    COALESCE(p_event_date, now()),
    CASE WHEN p_idempotency_key IS NOT NULL
      THEN jsonb_build_object('idempotency_key', p_idempotency_key)
      ELSE '{}'::jsonb
    END
  )
  ON CONFLICT (user_id, (metadata->>'idempotency_key'))
    WHERE metadata->>'idempotency_key' IS NOT NULL
    DO NOTHING
  RETURNING * INTO v_result;

  IF NOT FOUND THEN
    -- A concurrent (or earlier) call already won this idempotency key for
    -- this member; return that row instead of returning nothing.
    SELECT * INTO v_result FROM public.career_timeline
    WHERE user_id = p_member_id AND metadata->>'idempotency_key' = p_idempotency_key
    LIMIT 1;

    IF NOT FOUND THEN
      -- Should be unreachable (the row that lost the race must exist), but
      -- fail loudly rather than silently returning an all-NULL record if
      -- it ever is (e.g. deleted between the conflict and this re-select).
      RAISE EXCEPTION 'Failed to create or locate roadmap milestone for idempotency_key=%', p_idempotency_key;
    END IF;
  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.add_roadmap_milestone(uuid, text, text, timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_roadmap_milestone(uuid, text, text, timestamptz, text) TO authenticated;
