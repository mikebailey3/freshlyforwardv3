-- career_timeline reserved event-type RLS hardening.
--
-- REVIEW-ONLY DRAFT. NOT APPLIED. Do not run against any Supabase project
-- (local or production) without explicit approval.
--
-- ============================================================================
-- DEPLOYMENT PREREQUISITE -- DO NOT APPLY THIS MIGRATION STANDALONE.
--
-- Live-audit finding (2026-09-08): a direct `pg_proc` query against the live
-- FreshlyForward Supabase project (bolt-native-database-69540068, ref
-- siysdmgdsxlceewlwngl) for `public.add_roadmap_milestone` returned ZERO
-- ROWS. The RPC this migration's entire safety argument depends on
-- (20260907000000_add_roadmap_milestone_rpc.sql) has NOT been deployed to
-- production as of that finding.
--
-- This migration's core assumption -- that add_roadmap_milestone's insert
-- bypasses these tightened `authenticated`-scoped policies via table-owner/
-- superuser RLS bypass -- is REPO-LEVEL REASONING ONLY until the RPC has
-- actually been deployed and smoke-tested live. It cannot be verified before
-- that RPC exists to inspect.
--
-- REQUIRED deployment sequence (do not apply this file out of that order):
--   1. Deploy 20260907000000_add_roadmap_milestone_rpc.sql.
--   2. Live smoke-test add_roadmap_milestone: confirm a self-service member
--      call AND an assigned-strategist-for-another-member call both
--      successfully insert a career_timeline row.
--   3. Only after step 2 passes, apply this migration as its own controlled
--      step.
-- Chronological filename ordering (20260907000000 < 20260908010000) means a
-- normal `supabase db push`/`migration up` batch run already applies them in
-- the correct order -- the real risk is a manual/partial apply (e.g. running
-- only this file via the SQL editor) that skips step 1-2 entirely. See
-- src/lib/careerTimelineRlsMigrationOrdering.test.ts for the repo-side
-- static guard against this file's timestamp ever silently sorting ahead of
-- the RPC migration's.
-- ============================================================================
--
-- Confirmed live facts this migration is designed against (per user-supplied
-- audit of Supabase project bolt-native-database-69540068, ref
-- siysdmgdsxlceewlwngl -- NOT independently verified from this sandbox,
-- which has no live Supabase access of any kind):
--   - event_type is `text NOT NULL`, no CHECK/enum/FK on it.
--   - Only constraints on career_timeline: PK on id, FK user_id -> auth.users(id).
--   - RLS is enabled; INSERT/UPDATE/DELETE policies are all `auth.uid() = user_id`
--     ownership-only, with no event_type awareness.
--   - No triggers exist on career_timeline today.
--   - `authenticated` already holds direct table-level INSERT/UPDATE/DELETE/SELECT
--     grants (unaffected by this migration -- see "Grants" note below).
--   - 12 existing rows, all non-reserved (`joined` x11, `onboarding_completed` x1).
--     Zero existing career_roadmap/promotion_coaching rows.
--
-- Design choice: policy-level restriction, not a table-wide CHECK/enum.
-- Per explicit direction, event_type stays free-form text for extensibility;
-- we are not maintaining a permanent exhaustive allow-list of every timeline
-- event type. Only the two currently-reserved Roadmap milestone types
-- (career_roadmap, promotion_coaching -- see src/lib/roadmap.ts's
-- ROADMAP_EVENT_TYPES, the single TypeScript source of truth this mirrors)
-- are blocked from direct authenticated self-service writes.
--
-- Why this is safe for add_roadmap_milestone (20260907000000_add_roadmap_milestone_rpc.sql)
-- without touching that RPC at all: it is SECURITY DEFINER with no
-- FORCE ROW LEVEL SECURITY set on career_timeline (confirmed: no ALTER TABLE
-- ... FORCE ROW LEVEL SECURITY appears anywhere in this repo's migration
-- history for this table). Its INSERT already has to bypass the
-- `authenticated`-scoped insert_own_timeline policy today for its
-- strategist/admin-authored path to work at all: a strategist calling it for
-- a member who is NOT the strategist's own auth.uid() inserts a row where
-- user_id != auth.uid(), which the ORIGINAL, unmodified
-- `WITH CHECK (auth.uid() = user_id)` would already reject if it were being
-- enforced against that insert. Since that strategist path is already
-- shipped, tested, and confirmed working
-- (docs/superpowers/plans/2026-09-07-roadmap-write-path-repair.md), this is
-- strong indirect evidence the function's own insert runs as a role that
-- bypasses `TO authenticated` policies entirely (table-owner/superuser RLS
-- bypass), not as `authenticated` itself. Both policies below are scoped
-- `TO authenticated` only, so they add zero new conditions to whatever role
-- the RPC's insert actually executes as. NOT independently confirmed against
-- a live `\d+ career_timeline` / role inspection from this sandbox --
-- flagged again in the final report as an assumption to verify live before
-- applying.
--
-- Why service-role (stripe-webhook) is unaffected: Supabase's service_role
-- Postgres role carries BYPASSRLS and is not `authenticated`, so it is
-- structurally outside the scope of any policy `TO authenticated` --
-- including these two, unchanged from before this migration.

-- --------------------------------------------------------------------------
-- 1. Single source of truth for "is this a reserved Roadmap event type?"
--    Mirrors src/lib/roadmap.ts's ROADMAP_EVENT_TYPES exactly, in one place,
--    so both policies below reference it instead of repeating the literal
--    list. IMMUTABLE + STABLE search_path per current Supabase guidance.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_reserved_roadmap_event_type(p_event_type text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT p_event_type IN ('career_roadmap', 'promotion_coaching')
$$;

COMMENT ON FUNCTION public.is_reserved_roadmap_event_type(text) IS
  'Single source of truth for career_timeline''s two reserved Roadmap milestone '
  'event types. Mirrors src/lib/roadmap.ts ROADMAP_EVENT_TYPES. Used only by '
  'career_timeline''s insert_own_timeline / update_own_timeline RLS policies '
  'to block direct authenticated self-service writes of these two types -- '
  'the only approved write path for them is the add_roadmap_milestone RPC.';

-- --------------------------------------------------------------------------
-- 2. INSERT policy: preserves the existing ownership check byte-for-byte
--    (auth.uid() = user_id -- still blocks inserting a row for another
--    user), and additionally blocks the two reserved event types.
--    Security cases covered:
--      - member can insert a normal non-reserved event for self   -> PASS (unchanged)
--      - member cannot insert career_roadmap directly              -> BLOCKED (new)
--      - member cannot insert promotion_coaching directly          -> BLOCKED (new)
--      - member cannot insert for another user                     -> BLOCKED (unchanged)
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "insert_own_timeline" ON career_timeline;
CREATE POLICY "insert_own_timeline"
  ON career_timeline FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND NOT public.is_reserved_roadmap_event_type(event_type)
  );

-- --------------------------------------------------------------------------
-- 3. UPDATE policy: USING clause (which rows can be targeted at all) is
--    untouched -- still owner-only, so a member can never even attempt to
--    update a row they don't own (blocks "take over another member's row").
--    WITH CHECK gets the same two conditions as INSERT, applied to the
--    POST-update row: this blocks a member from turning an existing
--    non-reserved event into a reserved one via direct UPDATE.
--
--    Side effect, called out explicitly: this also means a member can no
--    longer directly UPDATE any field of an ALREADY-reserved row (since the
--    unchanged event_type would still fail WITH CHECK post-update). Checked
--    the codebase for this: there is no existing "edit milestone" feature
--    anywhere (roadmap.ts only creates via the RPC and reads; no
--    .update() call against career_timeline exists in src/ at all), so this
--    is not a behavior regression today -- only something to design around
--    if a future "edit milestone" feature is ever added (it would need its
--    own SECURITY DEFINER RPC, mirroring add_roadmap_milestone).
--
--    Security cases covered:
--      - member cannot UPDATE a normal event into a reserved event -> BLOCKED (new)
--      - member cannot take over another member's row              -> BLOCKED (unchanged, via USING + WITH CHECK auth.uid()=user_id)
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "update_own_timeline" ON career_timeline;
CREATE POLICY "update_own_timeline"
  ON career_timeline FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND NOT public.is_reserved_roadmap_event_type(event_type)
  );

-- --------------------------------------------------------------------------
-- Explicitly NOT touched by this migration:
--   - select_own_timeline / delete_own_timeline policies (no requirement to
--     change either; SELECT behavior must remain fully intact, and no
--     "delete a reserved milestone" restriction was requested).
--   - Any GRANT statements. `authenticated`'s existing table-level
--     INSERT/UPDATE/DELETE/SELECT privileges are unchanged -- this migration
--     only narrows policy-level WITH CHECK conditions for two of those
--     already-granted operations. No privileges are broadened.
--   - add_roadmap_milestone RPC itself, its REVOKE/GRANT EXECUTE lines, or
--     the idempotency unique index -- all from 20260907000000, left as-is.
--   - career_timeline's columns, constraints, indexes, or existing 12 rows.
--     This migration adds zero CHECK constraints and validates nothing
--     retroactively, so it is trivially safe for existing data regardless
--     of content (and doubly so here, since all 12 existing rows are
--     already non-reserved types per the live audit).
-- --------------------------------------------------------------------------

-- ============================================================================
-- ROLLBACK (draft, NOT executed as part of this migration -- run manually
-- only if this needs to be reverted post-apply):
--
-- DROP POLICY IF EXISTS "update_own_timeline" ON career_timeline;
-- CREATE POLICY "update_own_timeline"
--   ON career_timeline FOR UPDATE
--   TO authenticated
--   USING (auth.uid() = user_id)
--   WITH CHECK (auth.uid() = user_id);
--
-- DROP POLICY IF EXISTS "insert_own_timeline" ON career_timeline;
-- CREATE POLICY "insert_own_timeline"
--   ON career_timeline FOR INSERT
--   TO authenticated
--   WITH CHECK (auth.uid() = user_id);
--
-- DROP FUNCTION IF EXISTS public.is_reserved_roadmap_event_type(text);
-- ============================================================================
