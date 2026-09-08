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
-- Confirmed live facts this migration is designed against (re-confirmed via a
-- second live audit, 2026-09-08, against Supabase project
-- bolt-native-database-69540068, ref siysdmgdsxlceewlwngl -- NOT
-- independently re-run from this sandbox, which has no live Supabase access
-- of any kind; these are the audit results as reported):
--   - event_type is `text NOT NULL`, no CHECK/enum/FK on it.
--   - Only constraints on career_timeline: PK on id, FK user_id -> auth.users(id).
--   - RLS is enabled; INSERT/UPDATE/DELETE policies are all `auth.uid() = user_id`
--     ownership-only, with no event_type awareness.
--   - No triggers exist on career_timeline today.
--   - `authenticated` already holds direct table-level INSERT/UPDATE/DELETE/SELECT
--     grants (unaffected by this migration -- see "Grants" note below).
--   - 12 existing rows, all non-reserved (`joined` x11, `onboarding_completed` x1).
--     Zero existing career_roadmap/promotion_coaching rows.
--   - public.add_roadmap_milestone: SECURITY DEFINER, owned by postgres,
--     executable by authenticated and service_role, not by anon. Explicitly
--     creates event_type = 'career_roadmap' only. service_role separately
--     carries BYPASSRLS, so it is structurally outside every policy below
--     regardless of this migration.
--   - No promotion_coaching-creating function exists live today. That
--     reserved type currently has zero production writer anywhere (repo
--     grep confirms: no addTimelineEvent() call site, no RPC, nothing) --
--     it is reserved for a future write path, not something this migration
--     needs a trusted path for yet.
--
-- Design choice: policy-level restriction, not a table-wide CHECK/enum.
-- Per explicit direction, event_type stays free-form text for extensibility;
-- we are not maintaining a permanent exhaustive allow-list of every timeline
-- event type. Only the two currently-reserved Roadmap milestone types
-- (career_roadmap, promotion_coaching -- see src/lib/roadmap.ts's
-- ROADMAP_EVENT_TYPES, the single TypeScript source of truth this mirrors)
-- are blocked from direct authenticated self-service writes.
--
-- SECURITY CONTRACT (revised 2026-09-08 after an explicit UPDATE/DELETE
-- threat-model review -- see the two policy sections below for the
-- mechanics): the two reserved event types are treated as SYSTEM-OWNED /
-- IMMUTABLE from an ordinary authenticated member's point of view. A member:
--   - cannot directly INSERT a reserved event type (own row or another's)
--   - cannot UPDATE a normal event into a reserved type ("escalate")
--   - cannot UPDATE an already-reserved event AT ALL, including changing it
--     back to a normal type ("launder"/"reserved -> normal to bypass
--     protection") or editing any other field on it
--   - cannot DELETE an existing reserved event
--   - can still fully INSERT/UPDATE/DELETE their own normal (non-reserved)
--     events, completely unchanged from before this migration
-- Trusted/system paths (SECURITY DEFINER RPCs, service_role) are entirely
-- outside `TO authenticated` policies and are therefore unaffected by any of
-- the above -- see the per-policy notes for exactly why.
--
-- Why immutability is safe to adopt (investigated, not assumed): a full
-- repo grep of every `.from('career_timeline')` call site in src/ (as of
-- this migration) finds exactly four -- src/lib/profile.ts (one INSERT via
-- addTimelineEvent(), one SELECT via getTimeline()), src/lib/roadmap.ts (one
-- SELECT), and src/pages/strategist/StrategistMemberWorkspacePage.tsx (one
-- read-only SELECT for a strategist's view of a member's timeline). There
-- is no `.update(` or `.delete(` call against career_timeline anywhere in
-- the application -- not for reserved rows, not for normal rows, not
-- anywhere. No UI feature edits or deletes ANY timeline event today. Locking
-- reserved rows down to fully immutable-from-the-client therefore breaks
-- zero existing legitimate behavior; it only forecloses an attack path that
-- has no legitimate application use today.
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
-- 3. UPDATE policy -- REVISED 2026-09-08 after an explicit UPDATE threat-
--    model review. The original draft only put the reserved-type check in
--    WITH CHECK (evaluated against the resulting NEW row), leaving a real
--    gap: WITH CHECK alone cannot see what the row looked like BEFORE the
--    update, so a member could take an EXISTING reserved row and convert it
--    back to a normal type (e.g. event_type: 'career_roadmap' -> 'joined')
--    to "launder" it out of reserved status -- the NEW row's event_type
--    would be non-reserved, so the old WITH CHECK-only version would
--    incorrectly PASS that update. USING is evaluated against the OLD row
--    and determines whether a row can even be targeted for update at all,
--    so moving the reserved-type exclusion into USING (in addition to
--    keeping it in WITH CHECK) closes this gap correctly:
--      - USING now also excludes any row that is ALREADY reserved, so a
--        member cannot begin an UPDATE against a reserved row at all, for
--        ANY purpose (not just type-conversion) -- this is what makes
--        reserved rows fully immutable from the client, not merely
--        one-way-protected.
--      - WITH CHECK still independently excludes reserved event types on
--        the resulting NEW row, which is what blocks a normal row from
--        being escalated INTO a reserved type.
--    Together: USING blocks starting from a reserved row; WITH CHECK blocks
--    landing on a reserved row. Both directions are covered, and ownership
--    (auth.uid() = user_id) is preserved unchanged in both clauses.
--
--    No NULL-swallowing risk (checked, since this repo has already found
--    exactly this class of bug once this session): event_type is `text NOT
--    NULL` at the column level, so it can never be SQL NULL for a real row,
--    and is_reserved_roadmap_event_type()'s `IN ('career_roadmap',
--    'promotion_coaching')` list contains no NULL literal -- so for any
--    real row, the function always returns a definite TRUE or FALSE, never
--    NULL, and neither AND clause above can be poisoned into a permissive
--    NULL the way a three-valued-logic bug elsewhere in this codebase was.
--
--    Confirmed safe against current legitimate behavior (investigated, not
--    assumed): no `.update(` call against career_timeline exists anywhere
--    in src/ today, for reserved OR normal rows -- there is no "edit
--    milestone" feature and no "edit timeline event" feature of any kind.
--    This tightening therefore breaks zero existing behavior; it only
--    forecloses attack paths with no legitimate use today. If an "edit
--    milestone" feature is ever added for NORMAL (non-reserved) events, it
--    remains fully supported by this policy unchanged; editing an existing
--    RESERVED milestone would need its own SECURITY DEFINER RPC (mirroring
--    add_roadmap_milestone), by design, matching the system-owned contract.
--
--    Security cases covered:
--      - member cannot UPDATE a normal event into a reserved event      -> BLOCKED (WITH CHECK)
--      - member cannot UPDATE an existing reserved event AT ALL          -> BLOCKED (USING)
--      - member cannot "launder" a reserved event back into a normal one -> BLOCKED (USING; the row can't be targeted to begin with)
--      - member can still UPDATE their own normal (non-reserved) events  -> UNCHANGED
--      - member cannot take over another member's row                   -> BLOCKED (unchanged, via USING + WITH CHECK auth.uid()=user_id)
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "update_own_timeline" ON career_timeline;
CREATE POLICY "update_own_timeline"
  ON career_timeline FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND NOT public.is_reserved_roadmap_event_type(event_type)
  )
  WITH CHECK (
    auth.uid() = user_id
    AND NOT public.is_reserved_roadmap_event_type(event_type)
  );

-- --------------------------------------------------------------------------
-- 4. DELETE policy -- ADDED 2026-09-08, same threat-model review. The
--    original draft explicitly left delete_own_timeline untouched (there
--    was no DELETE-side requirement in scope at the time). Revisiting per
--    the system-owned/immutable contract: leaving DELETE unrestricted would
--    have been an incomplete contract -- a member unable to UPDATE a
--    reserved row into oblivion could still simply DELETE it outright,
--    which is just as much a violation of "reserved events are system-
--    owned" as either UPDATE gap above. USING gets the identical
--    reserved-type exclusion as the UPDATE policy's USING clause, for
--    exactly the same reason (DELETE only has a USING clause -- there is no
--    WITH CHECK for DELETE, since there's no resulting row to check).
--
--    Confirmed safe against current legitimate behavior: no `.delete(` call
--    against career_timeline exists anywhere in src/ today, for reserved OR
--    normal rows. This tightening breaks zero existing behavior.
--
--    Security cases covered:
--      - member cannot DELETE an existing reserved event      -> BLOCKED (new)
--      - member can still DELETE their own normal events      -> UNCHANGED
--      - member cannot delete another member's row             -> BLOCKED (unchanged, via auth.uid()=user_id)
-- --------------------------------------------------------------------------
DROP POLICY IF EXISTS "delete_own_timeline" ON career_timeline;
CREATE POLICY "delete_own_timeline"
  ON career_timeline FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    AND NOT public.is_reserved_roadmap_event_type(event_type)
  );

-- --------------------------------------------------------------------------
-- Explicitly NOT touched by this migration:
--   - select_own_timeline policy (no requirement to change it; SELECT
--     behavior must remain fully intact for both normal and reserved rows --
--     members still need to be able to READ their own roadmap milestones,
--     e.g. via src/lib/roadmap.ts's getRoadmapMilestones()).
--   - Any GRANT statements. `authenticated`'s existing table-level
--     INSERT/UPDATE/DELETE/SELECT privileges are unchanged -- this migration
--     only narrows policy-level USING/WITH CHECK conditions for three of
--     those already-granted operations. No privileges are broadened.
--   - add_roadmap_milestone RPC itself, its REVOKE/GRANT EXECUTE lines, or
--     the idempotency unique index -- all from 20260907000000, left as-is.
--     Not modified here because investigation found no necessity: it
--     already only ever creates event_type = 'career_roadmap' via a literal
--     in its INSERT statement, and (per the reasoning above) its
--     SECURITY DEFINER execution is structurally outside all of these
--     `TO authenticated` policies regardless of how they're worded.
--   - career_timeline's columns, constraints, indexes, or existing 12 rows.
--     This migration adds zero CHECK constraints and validates nothing
--     retroactively, so it is trivially safe for existing data regardless
--     of content (and doubly so here, since all 12 existing rows are
--     already non-reserved types per the live audit).
--   - No new event types invented, no promotion_coaching writer added --
--     out of scope; that type remains reserved-but-currently-write-path-less
--     until a future decision adds one (which, per the note above, would
--     need its own SECURITY DEFINER RPC and would be automatically
--     unaffected by this migration, the same way add_roadmap_milestone is).
-- --------------------------------------------------------------------------

-- ============================================================================
-- ROLLBACK (draft, NOT executed as part of this migration -- run manually
-- only if this needs to be reverted post-apply). Restores all three touched
-- policies to their exact pre-migration form:
--
-- DROP POLICY IF EXISTS "delete_own_timeline" ON career_timeline;
-- CREATE POLICY "delete_own_timeline"
--   ON career_timeline FOR DELETE
--   TO authenticated
--   USING (auth.uid() = user_id);
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
--
-- Rollback data-cleanup note: none needed. This migration never validates
-- or rewrites existing rows, so rolling back has zero data impact regardless
-- of what event_type values exist at rollback time.
-- ============================================================================
