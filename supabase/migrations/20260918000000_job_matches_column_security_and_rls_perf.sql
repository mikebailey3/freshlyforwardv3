/*
# OE 2.0 Hardening -- job_matches: close a column-security gap + RLS perf pass

## STATUS: PREPARED FOR REVIEW. NOT APPLIED TO PRODUCTION.
Forward migration only -- supersedes (does not edit in place)
20260915000000_harden_job_matches_update_policies.sql, which has
already been applied to the non-production Supabase project
("Freshly Forward", szwfxfitrmvqbdvcbgrf). Production
(`bolt-native-database-69540068`) is not touched.

## Finding -- computed_at was left unprotected (re-review of item 5)
Re-auditing the hardened `WITH CHECK` clauses column-by-column against
`job_matches`'s FULL current column list (base table
20260821000000_opportunity_engine.sql + `engine_version` added by
20260905000000_freshfit_engine_v2.sql) surfaced one gap:
`computed_at` (set by the sync script, meant to reflect when
FreshFit actually computed this match) was never included in either
policy's "everything else must stay unchanged" comparison list. As
shipped in 20260915, a member or strategist could still rewrite
`computed_at` via a direct out-of-band UPDATE -- not a data leak or
privilege escalation on its own (it doesn't gate any authorization
decision), but a real integrity gap: a member could make a stale match
appear freshly computed, or a strategist could do the same when
reviewing it. This migration adds `computed_at` to both policies'
column allow-lists, alongside every other pre-existing comparison.

No other columns were missed -- the full current column set is:
`id` (immutable PK, never compared/needs no check), `member_id`,
`scraped_job_id`, `fresh_fit_score`, `matched_skills`, `missing_skills`,
`score_breakdown`, `dismissed_at`, `promoted_opportunity_id`,
`computed_at`, `engine_version`. Every one of these except the two
actor-specific mutable fields (`dismissed_at` for members,
`promoted_opportunity_id` for strategists) is now compared.

`dismissed_at` and `promoted_opportunity_id` are compared with
`IS NOT DISTINCT FROM` (NULL-safe equality) because both are commonly
NULL and a plain `=` would make `NULL = NULL` evaluate to `NULL` --
which Postgres's `WITH CHECK` treats as "reject" -- silently blocking
completely legitimate updates where that column was NULL before and
stays NULL after. Re-verified: no other compared column is nullable
(`member_id`/`scraped_job_id`/`fresh_fit_score`/`engine_version` are
`NOT NULL`; `matched_skills`/`missing_skills` are `NOT NULL DEFAULT
'{}'`; `score_breakdown` is `NOT NULL DEFAULT '{}'::jsonb`;
`computed_at` is `NOT NULL DEFAULT now()`), so plain `=` remains correct
for all of them -- no other NULL-comparison bug exists in this policy
pair.

## RLS performance pass (Supabase Performance Advisor: repeated
## auth.uid() re-evaluation)
Every `auth.uid()` call in these three job_matches policies is rewritten
to `(select auth.uid())`. Wrapping in a scalar subquery lets Postgres
evaluate it once per statement (as an InitPlan) instead of once per row
scanned -- Supabase's own documented fix for this exact advisor
warning. This is a pure performance change: every expression's boolean
result is identical to before for every possible input, so
authorization behavior does not change in any way. `select_own_job_matches`
(SELECT, unrelated to the column-security fix above) is included here
purely for the performance pass, scoped to this migration since it's
the same table/file being touched anyway -- its `USING` clause is
otherwise byte-for-byte unchanged.
*/

DROP POLICY IF EXISTS "select_own_job_matches" ON public.job_matches;
CREATE POLICY "select_own_job_matches"
  ON public.job_matches FOR SELECT
  TO authenticated
  USING (
    (select auth.uid()) = member_id
    OR (select auth.uid()) IN (
      SELECT strategist_id FROM public.strategist_assignments
      WHERE strategist_assignments.member_id = job_matches.member_id
      AND strategist_assignments.is_active = true
    )
  );

DROP POLICY IF EXISTS "member_dismiss_own_job_matches" ON public.job_matches;
CREATE POLICY "member_dismiss_own_job_matches"
  ON public.job_matches FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = member_id)
  WITH CHECK (
    (select auth.uid()) = member_id
    AND member_id = (public.get_job_match_snapshot(id)).member_id
    AND scraped_job_id = (public.get_job_match_snapshot(id)).scraped_job_id
    AND fresh_fit_score = (public.get_job_match_snapshot(id)).fresh_fit_score
    AND matched_skills = (public.get_job_match_snapshot(id)).matched_skills
    AND missing_skills = (public.get_job_match_snapshot(id)).missing_skills
    AND score_breakdown = (public.get_job_match_snapshot(id)).score_breakdown
    AND computed_at = (public.get_job_match_snapshot(id)).computed_at
    AND engine_version = (public.get_job_match_snapshot(id)).engine_version
    AND promoted_opportunity_id IS NOT DISTINCT FROM (public.get_job_match_snapshot(id)).promoted_opportunity_id
  );

DROP POLICY IF EXISTS "strategist_promote_job_matches" ON public.job_matches;
CREATE POLICY "strategist_promote_job_matches"
  ON public.job_matches FOR UPDATE
  TO authenticated
  USING (
    (select auth.uid()) IN (
      SELECT strategist_id FROM public.strategist_assignments
      WHERE strategist_assignments.member_id = job_matches.member_id
      AND strategist_assignments.is_active = true
    )
  )
  WITH CHECK (
    (select auth.uid()) IN (
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
    AND computed_at = (public.get_job_match_snapshot(id)).computed_at
    AND engine_version = (public.get_job_match_snapshot(id)).engine_version
    AND dismissed_at IS NOT DISTINCT FROM (public.get_job_match_snapshot(id)).dismissed_at
  );
