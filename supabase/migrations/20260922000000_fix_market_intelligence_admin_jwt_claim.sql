/*
# OE 2.0 Hardening -- fix market_intelligence_snapshots admin check (validated defect)

## STATUS: PREPARED FOR REVIEW. NOT APPLIED TO PRODUCTION.
Forward migration only -- does not edit 20260919000000_oe_rls_performance_auth_uid.sql
(or any other already-applied migration) in place. Per controlled non-prod
execution: all five Batch 2 migrations (20260917-20260921) were applied
to the non-production Supabase project ("Freshly Forward",
szwfxfitrmvqbdvcbgrf) and live RLS/security testing found exactly one
validated defect, described below. Production
(`bolt-native-database-69540068`) has not been touched and is not
touched by this migration.

## The validated defect
`admin_strategist_read_market_intelligence`'s admin branch reads:

    (select auth.uid()) IN (SELECT id FROM auth.users WHERE raw_app_meta_data->>'role' = 'admin')

Live testing against non-prod returned SQLSTATE 42501
(`permission denied for table users`) when this branch was evaluated,
because the `authenticated` role does not hold `SELECT` on `auth.users`
in that project. `auth.users` is Supabase's own system table and is
correctly locked down by default -- this migration deliberately does
NOT fix the defect by granting `authenticated` SELECT on it, since that
would let every authenticated user query the full `auth.users` table
directly via PostgREST or via any other future policy's subquery,
exposing every member's email/metadata far beyond what the admin check
itself needs. That was true of the original design regardless of
whether the grant happened to be present or absent in a given project
-- non-prod's absence of that grant surfaced a latent flaw, not a
non-prod-only quirk.

## The fix -- verified JWT app_metadata claim, no auth.users access needed
Supabase's GoTrue auth server embeds each authenticated session's
`app_metadata` (sourced from the same `raw_app_meta_data` column this
whole codebase already treats as its one source of truth for roles --
see the repo-wide convention already used in
20260802172349_phase3_membership_system.sql,
20260803000729_fix_admin_access_strategist_assignments.sql,
20260820000000_strategist_enrollment.sql, and
20260822000000_admin_strategist_assignment.sql) directly into the
request's JWT at token-issuance time. `auth.jwt()` is a standard
Supabase-provided `STABLE` helper (the same family as `auth.uid()`,
already used throughout this codebase) that returns those claims as
`jsonb` with zero additional table access -- so
`(select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'` needs no
grant on `auth.users` at all, matching Supabase's own documented
guidance to prefer `app_metadata`-based JWT claims over a live
`auth.users` lookup for exactly this kind of RLS role check (unlike
`user_metadata`, `app_metadata` is never end-user-editable, so it
remains a safe authorization source). Wrapped in `(select ...)` for the
same InitPlan performance reason already applied everywhere else in
Batch 2.

**Accepted trade-off, stated explicitly:** a JWT's claims are fixed at
issuance time, so if an admin role is granted or revoked, the affected
user's existing access token won't reflect that change until it
refreshes (Supabase's default access-token lifetime; sooner if they
sign out/in). This is the standard, documented behavior of claims-based
authorization and is the same trade-off already implicitly accepted by
every other `auth.uid()`/JWT-based policy in this schema -- it is not a
new gap introduced by this fix, and it is strictly better than the
prior state, which did not work at all for `authenticated` callers in
this project.

## Unchanged
- The active-strategist-assignment `OR` branch is untouched, byte-for-
  byte, from 20260919000000.
- No other table, policy, grant, or index is touched.
- `authenticated`'s existing (already-correct) `SELECT`-only grant on
  `market_intelligence_snapshots` from 20260921000000 is untouched.

## Related, explicitly out-of-scope observation
The exact same `auth.uid() IN (SELECT id FROM auth.users WHERE
raw_app_meta_data->>'role' = 'admin')` pattern also appears in
pre-existing, pre-OE-2.0 policies (e.g.
20260802172349_phase3_membership_system.sql's
`admin_write_membership_plans`) that may carry the identical latent
defect in any project where `authenticated` lacks `SELECT` on
`auth.users`. Per explicit instruction to fix only this validated
defect, those pre-existing policies are not touched here. Already
logged as pre-existing technical debt in the OE 2.0 migration manifest
doc; this observation just confirms it may be a live, not just
theoretical, latent issue.
*/

DROP POLICY IF EXISTS "admin_strategist_read_market_intelligence" ON public.market_intelligence_snapshots;
CREATE POLICY "admin_strategist_read_market_intelligence"
  ON public.market_intelligence_snapshots FOR SELECT
  TO authenticated
  USING (
    (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR (select auth.uid()) IN (
      SELECT strategist_id FROM public.strategist_assignments
      WHERE strategist_assignments.is_active = true
    )
  );
