/*
# OE 2.0 Hardening -- pin get_job_match_snapshot() search_path + least-privilege EXECUTE

## STATUS: PREPARED FOR REVIEW. NOT APPLIED TO PRODUCTION.
Forward migration only -- does not edit 20260915000000_harden_job_matches_update_policies.sql
in place. Per non-prod validation, that migration (and the other five
prepared OE 2.0 migrations) have been applied to the non-production
Supabase project ("Freshly Forward", szwfxfitrmvqbdvcbgrf) and Supabase's
Security Advisor there flagged this function's mutable search_path.
Production (`bolt-native-database-69540068`) has not been touched and
is not touched by this migration.

## Finding 1 -- mutable search_path (Security Advisor)
`public.get_job_match_snapshot(uuid)` (added by
20260915000000_harden_job_matches_update_policies.sql) was created
without an explicit `search_path`, so it inherits whatever
`search_path` is in effect for the calling session/role at execution
time. For a `STABLE`/`SQL` function this is a well-known class of risk:
if a role with schema-creation rights could ever get a same-named
object earlier in that session's resolvable search_path, the function
could silently resolve to the wrong object instead of
`public.job_matches`. The function body already fully-qualifies its one
table reference (`public.job_matches`), so this was never practically
exploitable here -- but Supabase's advisor is correct that leaving
`search_path` mutable is fragile/best-practice-violating regardless,
and pinning it is the standard fix.

**Fix:** `ALTER FUNCTION ... SET search_path = ''` -- forces every
identifier inside the function body to resolve via fully-qualified
names only (which it already does). This is a metadata-only change: it
does NOT redefine the function body, does NOT change its signature or
return type, and does NOT require touching either of the two policies
that call it (`member_dismiss_own_job_matches`,
`strategist_promote_job_matches`) -- they keep working unchanged, since
they already only ever call `public.get_job_match_snapshot(id)` (fully
qualified) and never relied on the function's own internal
search_path resolution for anything.

**Verified safe with the hardened UPDATE policies:** `SET search_path = ''`
only affects unqualified identifier resolution *inside this function's
own body*. It has zero effect on how the *policies themselves* resolve
`public.job_matches`, `public.strategist_assignments`, etc. -- those
references in the policy SQL are unaffected by this function's
search_path setting, and were already fully qualified in the
20260915 migration.

## Finding 2 -- RPC EXECUTE exposure (least privilege)
Postgres grants `EXECUTE` on newly created functions to `PUBLIC` by
default (unlike tables, which get no default grants) -- `anon` and
`authenticated` both inherit `PUBLIC`'s privileges. Because this
function lives in the `public` schema, PostgREST auto-exposes it as a
directly callable RPC endpoint (`/rest/v1/rpc/get_job_match_snapshot`)
to any authenticated (and, before this fix, any anonymous) caller --
it was never meant to be called directly by client code; it exists
solely to be called from inside the two job_matches UPDATE policies.

**Verified Postgres behavior before deciding what to revoke:** RLS
policies are evaluated as part of the query, executed as the querying
role (this function is `SECURITY INVOKER`, not `DEFINER`). A function
call inside a policy expression requires the *querying role* to hold
`EXECUTE` on that function, exactly as if it were called directly in a
query. Supabase's `authenticated` role is the role every real member
and strategist request runs as -- it is the same role that must
satisfy `member_dismiss_own_job_matches`/`strategist_promote_job_matches`
during a normal dismiss/promote. **Therefore `authenticated` cannot
have `EXECUTE` revoked without breaking policy evaluation for every
real user** -- this was verified by reasoning through Postgres's
privilege model, not assumed: there is no mechanism in Postgres to
grant "callable only from within a policy, not directly by the same
role" -- an EXECUTE grant is not call-site-sensitive.

**What IS safe to revoke:** `PUBLIC` and `anon`. Neither `anon` nor any
future untrusted role needs to invoke this helper -- `anon` never
satisfies either policy's `USING`/`WITH CHECK` clause in the first
place (both are `TO authenticated` only), so `anon` never legitimately
triggers this function via policy evaluation, and it has no legitimate
reason to call it directly either.

**Why leaving `authenticated`'s EXECUTE in place is still safe (the
"safest valid alternative" per the residual risk):** this function is
`SECURITY INVOKER` and `STABLE`, and its body is nothing more than
`SELECT * FROM public.job_matches WHERE id = match_id`. Calling it
directly via RPC as an authenticated user is bound by the *exact same*
RLS `SELECT` policy (`select_own_job_matches`) that already governs a
direct `SELECT * FROM job_matches WHERE id = X` over the regular
PostgREST table endpoint -- a caller only ever gets back a row they
could already read via the ordinary table API. The RPC therefore grants
zero additional data access beyond what already exists; revoking
`anon`+`PUBLIC` closes the only privilege that had no legitimate use
case, while the unavoidable `authenticated` grant is provably bounded
by existing RLS, not a new exposure.
*/

ALTER FUNCTION public.get_job_match_snapshot(uuid) SET search_path = '';

REVOKE ALL ON FUNCTION public.get_job_match_snapshot(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_job_match_snapshot(uuid) FROM anon;

-- authenticated MUST retain EXECUTE -- required for
-- member_dismiss_own_job_matches / strategist_promote_job_matches
-- policy evaluation to keep working for real users (see Finding 2
-- above). Explicit GRANT (rather than relying on a pre-revoke default)
-- so this migration is correct and idempotent regardless of what the
-- project's current grant state happens to be.
GRANT EXECUTE ON FUNCTION public.get_job_match_snapshot(uuid) TO authenticated;
