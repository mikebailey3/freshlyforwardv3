/*
# OE 2.0 Final Security Gate -- harden job_matches member/strategist UPDATE policies

## STATUS: PREPARED FOR REVIEW. NOT APPLIED.
## FLAGGED AS HIGH PRIORITY FOR YOUR REVIEW -- unlike every other
## migration in this OE 2.0 batch, this one modifies policies on a
## table (`job_matches`) that was created back in
## `20260821000000_opportunity_engine.sql`, BEFORE this project's
## "prepared, not applied" convention began (2026-09-11 onward). That
## earlier migration was very likely already applied to your real
## schema in an earlier session. This environment has no live database
## connection, so that could not be verified here -- please confirm
## before deciding whether/how to apply this fix.

## Finding
`member_dismiss_own_job_matches` and `strategist_promote_job_matches`
(both `FOR UPDATE`) each only ever checked row OWNERSHIP
(`auth.uid() = member_id` / an active strategist assignment) -- neither
restricted WHICH COLUMNS could change. Postgres RLS is row-level, not
column-level, so as written:
- A member could PATCH their own job_matches row and change ANY column
  via a direct API call -- not just `dismissed_at` (the only field
  `dismissJobMatch()` in application code ever sets), but also
  `fresh_fit_score`, `matched_skills`, `score_breakdown`, or even
  `promoted_opportunity_id`.
- An assigned strategist could likewise change ANY column on a match
  belonging to one of their assigned members -- not just
  `promoted_opportunity_id` (the only field the promote action in
  application code ever sets).

This is not a data-LEAK (the SELECT policy is unaffected and unchanged
-- nobody gains visibility into rows they couldn't already see), but it
is a real integrity/self-escalation gap: a member could inflate their
own `fresh_fit_score`/fabricate `score_breakdown` evidence they show
themselves, or forge a `promoted_opportunity_id` value.

## Fix
Both policies' `WITH CHECK` now additionally requires every column
*other than* the one each actor is meant to touch
(`dismissed_at` for members, `promoted_opportunity_id` for strategists)
to be unchanged from the current stored row. A small `STABLE` helper,
`public.get_job_match_snapshot`, fetches that current row once per
policy evaluation so the check reads as a column-by-column comparison
rather than nine repeated inline subqueries. Deliberately NOT
`SECURITY DEFINER`: this helper must run with the CALLING user's own
privileges/RLS, not bypass them -- PostgREST auto-exposes every
`public`-schema function an authenticated role can execute as a
directly callable RPC endpoint, so a `SECURITY DEFINER` version of this
helper would itself become a NEW, worse IDOR (any authenticated user
could call it directly to read any match's full row, bypassing RLS
entirely). Running as invoker instead means: (a) the policy's own USING
clause has already confirmed the caller may see this row before WITH
CHECK ever runs, so the helper's own SELECT trivially succeeds in that
context, and (b) if a user calls this function directly via RPC, it
only ever returns rows their existing SELECT policy already allows them
to see -- no new exposure either way.

This does NOT change any application code path: `dismissJobMatch()`
already only ever sends `{ dismissed_at }`, and the strategist promote
action already only ever sends `{ promoted_opportunity_id }` (verified
by grep across src/ before writing this migration) -- both continue to
work unchanged. Only a direct, out-of-band API call attempting to touch
any *other* column on an UPDATE would now be rejected.

## No behavior change until applied
Purely a policy replacement -- no column/table change, no data
migration. Until applied, current (broader) UPDATE behavior continues
exactly as today.
*/

CREATE OR REPLACE FUNCTION public.get_job_match_snapshot(match_id uuid)
RETURNS public.job_matches
LANGUAGE sql
STABLE
AS $$
  SELECT * FROM public.job_matches WHERE id = match_id;
$$;

DROP POLICY IF EXISTS "member_dismiss_own_job_matches" ON public.job_matches;
CREATE POLICY "member_dismiss_own_job_matches"
  ON public.job_matches FOR UPDATE
  TO authenticated
  USING (auth.uid() = member_id)
  WITH CHECK (
    auth.uid() = member_id
    AND member_id = (public.get_job_match_snapshot(id)).member_id
    AND scraped_job_id = (public.get_job_match_snapshot(id)).scraped_job_id
    AND fresh_fit_score = (public.get_job_match_snapshot(id)).fresh_fit_score
    AND matched_skills = (public.get_job_match_snapshot(id)).matched_skills
    AND missing_skills = (public.get_job_match_snapshot(id)).missing_skills
    AND score_breakdown = (public.get_job_match_snapshot(id)).score_breakdown
    AND promoted_opportunity_id IS NOT DISTINCT FROM (public.get_job_match_snapshot(id)).promoted_opportunity_id
    AND engine_version = (public.get_job_match_snapshot(id)).engine_version
  );

DROP POLICY IF EXISTS "strategist_promote_job_matches" ON public.job_matches;
CREATE POLICY "strategist_promote_job_matches"
  ON public.job_matches FOR UPDATE
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT strategist_id FROM public.strategist_assignments
      WHERE strategist_assignments.member_id = job_matches.member_id
      AND strategist_assignments.is_active = true
    )
  )
  WITH CHECK (
    auth.uid() IN (
      SELECT strategist_id FROM public.strategist_assignments
      WHERE strategist_assignments.member_id = job_matches.member_id
      AND strategist_assignments.is_active = true
    )
    AND member_id = (public.get_job_match_snapshot(id)).member_id
    AND scraped_job_id = (public.get_job_match_snapshot(id)).scraped_job_id
    AND fresh_fit_score = (public.get_job_match_snapshot(id)).fresh_fit_score
    AND matched_skills = (public.get_job_match_snapshot(id)).matched_skills
    AND missing_skills = (public.get_job_match_snapshot(id)).missing_skills
    AND score_breakdown = (public.get_job_match_snapshot(id)).score_breakdown
    AND dismissed_at IS NOT DISTINCT FROM (public.get_job_match_snapshot(id)).dismissed_at
    AND engine_version = (public.get_job_match_snapshot(id)).engine_version
  );
