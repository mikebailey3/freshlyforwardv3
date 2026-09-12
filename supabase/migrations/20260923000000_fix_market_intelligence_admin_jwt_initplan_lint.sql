/*
# OE 2.0 Hardening -- market_intelligence_snapshots admin check: auth_rls_initplan lint fix (syntax only)

## STATUS: PREPARED FOR REVIEW. NOT APPLIED TO PRODUCTION.
Forward migration only -- does not edit 20260922000000_fix_market_intelligence_admin_jwt_claim.sql
in place. Per Round 2 non-prod execution: that migration was applied to
the non-production Supabase project ("Freshly Forward",
szwfxfitrmvqbdvcbgrf) and validated functionally green (the SQLSTATE
42501 defect is fixed; every live RLS/security assertion, including all
four new market_intelligence_snapshots admin/strategist/member/anon
checks, passed). One `auth_rls_initplan` Performance Advisor finding
remained on this same policy. Production
(`bolt-native-database-69540068`) has not been touched and is not
touched by this migration.

## The finding
Supabase's Performance Advisor's `(select auth.<fn>())` InitPlan
optimization pattern specifically recognizes a bare, wrapped function
call. 20260922000000 wrapped the entire downstream jsonb-extraction
chain instead of just the function call:

    (select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'

Here the `-> 'app_metadata' ->> 'role'` operators execute *inside* the
scalar subquery, which does not match the advisor's recognized InitPlan
shape, so it re-flagged this policy.

## The fix -- syntax only, zero behavior change
Move the closing parenthesis so only the function call itself is
wrapped, and the jsonb-extraction operators apply to its already-
evaluated result, outside the subquery:

    ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'

This is the exact fix requested and is purely a re-parenthesization.
`auth.jwt()` is `STABLE`, so `(select auth.jwt())` and `auth.jwt()`
return the byte-identical `jsonb` value for the lifetime of a single
statement -- applying `-> 'app_metadata' ->> 'role'` to that value
either inside or outside the wrapping subquery produces the identical
result. **No authorization behavior changes.** Every other detail of
this policy is preserved exactly, byte-for-byte, from 20260922000000:
- `TO authenticated` (unchanged)
- The admin check still keys off `app_metadata` (never `user_metadata`)
- The active-strategist-assignment `OR` branch (unchanged, untouched)
- All grants (from 20260921000000_oe_table_grants_hardening.sql,
  untouched) and every other policy on this or any other table
  (untouched)

## Scope
This migration changes exactly one policy's syntactic wrapping and
nothing else -- no product behavior, no authorization semantics, no
other table, policy, grant, or index.
*/

DROP POLICY IF EXISTS "admin_strategist_read_market_intelligence" ON public.market_intelligence_snapshots;
CREATE POLICY "admin_strategist_read_market_intelligence"
  ON public.market_intelligence_snapshots FOR SELECT
  TO authenticated
  USING (
    ((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'
    OR (select auth.uid()) IN (
      SELECT strategist_id FROM public.strategist_assignments
      WHERE strategist_assignments.is_active = true
    )
  );
