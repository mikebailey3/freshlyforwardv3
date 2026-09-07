-- Roadmap write-path repair: narrowly-scoped SECURITY DEFINER RPC so an
-- active assigned strategist, an admin, or the member themself can create
-- a career_roadmap milestone -- without broadening career_timeline's
-- existing auth.uid() = user_id-only INSERT policy to arbitrary
-- event_types for arbitrary callers. Modeled directly on this repo's own
-- enroll_member_with_random_strategist() (20260820000000_strategist_enrollment.sql),
-- tightened to match current official Supabase guidance: SET search_path = ''
-- (fully empty) with every public.-schema reference explicitly qualified,
-- rather than SET search_path = public. career_timeline's own RLS policies
-- are completely untouched by this migration.
--
-- Revision notes (post-review fixes):
-- 1. The idempotency key lookup/uniqueness is scoped to (user_id,
--    idempotency_key), not the key alone -- a global key index would let
--    one caller's idempotency key coincidentally collide with an unrelated
--    member's row and leak it back to a different, unrelated caller.
-- 2. The check-then-insert idempotency logic was replaced with a single
--    atomic INSERT ... ON CONFLICT DO NOTHING to close a TOCTOU race
--    between two concurrent calls sharing the same key.
-- 3. The unique index is created BEFORE the function: Postgres resolves
--    ON CONFLICT arbiter indexes at CREATE FUNCTION parse-analysis time,
--    so the index must already exist or the migration fails to apply.

CREATE UNIQUE INDEX IF NOT EXISTS idx_career_timeline_user_idempotency_key
  ON public.career_timeline (user_id, (metadata->>'idempotency_key'))
  WHERE metadata->>'idempotency_key' IS NOT NULL;

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
  v_caller_is_admin boolean := (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin';
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
