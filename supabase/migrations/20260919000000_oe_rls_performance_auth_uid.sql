/*
# OE 2.0 Hardening -- RLS performance pass (auth.uid() -> (select auth.uid()))

## STATUS: PREPARED FOR REVIEW. NOT APPLIED TO PRODUCTION.
Forward migration only. Scoped EXCLUSIVELY to OE 2.0 objects, per
explicit instruction not to start a repo-wide RLS refactor:
`member_job_exclusion_rules`, `member_feedback`'s one OE-touched policy
(`insert_own_feedback`), `market_intelligence_snapshots`, and
`match_digest_log`. (`job_matches`'s three policies received the same
fix in 20260918000000_job_matches_column_security_and_rls_perf.sql,
bundled there since that migration was already touching the same
table/file for a column-security fix.)

## What changed and why
Supabase's Performance Advisor flags bare `auth.uid()` (and similar
`auth.*`/`current_setting()` calls) inside RLS policies because
Postgres's planner cannot always prove the function is safe to
evaluate once per statement, so it may re-evaluate it once per row
scanned. Wrapping it in a scalar subquery -- `(select auth.uid())` --
gives the planner an unambiguous InitPlan it can evaluate exactly once
per statement, regardless of how many rows the policy is checked
against. This is Supabase's own documented fix for this exact advisor
warning.

**Authorization behavior is unchanged.** `(select auth.uid())` and
`auth.uid()` return the identical scalar value for the lifetime of a
single statement -- `auth.uid()` is `STABLE`, not `VOLATILE`, so this
rewrite is a pure performance optimization. Every policy below is
otherwise byte-for-byte identical to its currently-prepared/applied
version; only the four `auth.uid()` call sites are wrapped.
*/

-- ============================================================
-- member_job_exclusion_rules (20260914000000)
-- ============================================================
DROP POLICY IF EXISTS "select_own_exclusion_rules" ON public.member_job_exclusion_rules;
CREATE POLICY "select_own_exclusion_rules"
  ON public.member_job_exclusion_rules FOR SELECT
  TO authenticated
  USING (
    (select auth.uid()) = member_id
    OR (select auth.uid()) IN (
      SELECT strategist_id FROM public.strategist_assignments
      WHERE strategist_assignments.member_id = member_job_exclusion_rules.member_id
      AND strategist_assignments.is_active = true
    )
  );

DROP POLICY IF EXISTS "insert_own_exclusion_rules" ON public.member_job_exclusion_rules;
CREATE POLICY "insert_own_exclusion_rules"
  ON public.member_job_exclusion_rules FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = member_id);

DROP POLICY IF EXISTS "delete_own_exclusion_rules" ON public.member_job_exclusion_rules;
CREATE POLICY "delete_own_exclusion_rules"
  ON public.member_job_exclusion_rules FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = member_id);

-- ============================================================
-- member_feedback -- insert_own_feedback only (the one OE 2.0-touched
-- policy on this pre-existing table; every other member_feedback
-- policy predates OE 2.0 and is out of scope here)
-- ============================================================
DROP POLICY IF EXISTS "insert_own_feedback" ON public.member_feedback;
CREATE POLICY "insert_own_feedback"
  ON public.member_feedback FOR INSERT
  TO authenticated
  WITH CHECK (
    (select auth.uid()) = member_id
    AND (
      job_match_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.job_matches
        WHERE job_matches.id = member_feedback.job_match_id
        AND job_matches.member_id = (select auth.uid())
      )
    )
  );

-- ============================================================
-- market_intelligence_snapshots (20260912000000)
-- ============================================================
DROP POLICY IF EXISTS "admin_strategist_read_market_intelligence" ON public.market_intelligence_snapshots;
CREATE POLICY "admin_strategist_read_market_intelligence"
  ON public.market_intelligence_snapshots FOR SELECT
  TO authenticated
  USING (
    (select auth.uid()) IN (SELECT id FROM auth.users WHERE raw_app_meta_data->>'role' = 'admin')
    OR (select auth.uid()) IN (
      SELECT strategist_id FROM public.strategist_assignments
      WHERE strategist_assignments.is_active = true
    )
  );

-- ============================================================
-- match_digest_log (20260916000000)
-- ============================================================
DROP POLICY IF EXISTS "select_own_digest_log" ON public.match_digest_log;
CREATE POLICY "select_own_digest_log"
  ON public.match_digest_log FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = member_id);
