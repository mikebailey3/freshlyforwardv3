-- FreshlyForward security hardening
-- Scope: strategist assignment escalation, overbroad strategist reads,
-- SECURITY DEFINER execution surface, and cross-user feature checks.
-- This migration documents changes already applied directly to the live
-- production database; it is being persisted here for version-control
-- parity and does NOT need to be (and should not be) re-run against
-- Supabase.

-- 1) Strategist assignments: only admins may directly mutate assignments.
-- Legitimate member enrollment continues through the SECURITY DEFINER
-- enroll_member_with_random_strategist() function, which performs its own
-- self-or-admin authorization check.
DROP POLICY IF EXISTS "insert_assignments_strategist" ON public.strategist_assignments;
DROP POLICY IF EXISTS "update_own_assignments" ON public.strategist_assignments;
DROP POLICY IF EXISTS "delete_own_assignments" ON public.strategist_assignments;

DROP POLICY IF EXISTS "insert_assignments_admin" ON public.strategist_assignments;
CREATE POLICY "insert_assignments_admin"
  ON public.strategist_assignments FOR INSERT
  TO authenticated
  WITH CHECK (((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'));

DROP POLICY IF EXISTS "update_assignments_admin" ON public.strategist_assignments;
CREATE POLICY "update_assignments_admin"
  ON public.strategist_assignments FOR UPDATE
  TO authenticated
  USING (((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'))
  WITH CHECK (((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'));

DROP POLICY IF EXISTS "delete_assignments_admin" ON public.strategist_assignments;
CREATE POLICY "delete_assignments_admin"
  ON public.strategist_assignments FOR DELETE
  TO authenticated
  USING (((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'));

-- 2) founding_member_feedback: an active strategist may only read feedback
-- for members actually assigned to that strategist.
DROP POLICY IF EXISTS "select_own_founding_feedback" ON public.founding_member_feedback;
CREATE POLICY "select_own_founding_feedback"
  ON public.founding_member_feedback FOR SELECT
  TO authenticated
  USING (
    auth.uid() = member_id
    OR EXISTS (
      SELECT 1 FROM public.strategist_assignments sa
      WHERE sa.member_id = founding_member_feedback.member_id
        AND sa.strategist_id = auth.uid()
        AND sa.is_active = true
    )
    OR ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  );

-- 3) report_approvals: correlate strategist visibility to the report member.
DROP POLICY IF EXISTS "select_report_approvals" ON public.report_approvals;
CREATE POLICY "select_report_approvals"
  ON public.report_approvals FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.friday_reports fr
      WHERE fr.id = report_approvals.report_id
        AND (
          fr.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.strategist_assignments sa
            WHERE sa.member_id = fr.user_id
              AND sa.strategist_id = auth.uid()
              AND sa.is_active = true
          )
          OR ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
        )
    )
  );

-- 4) has_feature_access: preserve authenticated app usage but prevent
-- checking arbitrary users' entitlements. Admin/service_role remain allowed.
CREATE OR REPLACE FUNCTION public.has_feature_access(p_user_id uuid, p_feature_key text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_id uuid;
  v_subscription_status text;
  v_has_access boolean := false;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND (auth.jwt() -> 'app_metadata' ->> 'role') IS DISTINCT FROM 'admin'
     AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Not authorized to check feature access for this user';
  END IF;

  SELECT mp.plan_id, mp.subscription_status
  INTO v_plan_id, v_subscription_status
  FROM public.member_profiles mp
  WHERE mp.user_id = p_user_id;

  IF v_plan_id IS NULL THEN
    RETURN false;
  END IF;

  IF v_subscription_status NOT IN ('active', 'trialing', 'past_due') THEN
    RETURN false;
  END IF;

  SELECT EXISTS(
    SELECT 1
    FROM public.plan_features pf
    JOIN public.features f ON f.id = pf.feature_id
    WHERE pf.plan_id = v_plan_id
      AND f.feature_key = p_feature_key
      AND pf.is_enabled = true
  ) INTO v_has_access;

  RETURN v_has_access;
END;
$$;

-- 5) SECURITY DEFINER execution privileges.
-- Remove implicit/public + anonymous access everywhere it is unnecessary.
REVOKE EXECUTE ON FUNCTION public.admin_assign_strategist(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_members() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_strategists() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.enroll_member_with_random_strategist(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_strategist() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_feature_access(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.send_friday_report(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_application_interview_date(uuid, timestamptz) FROM PUBLIC, anon;

-- award_badge is internal-only; triggers/owner can still execute it.
REVOKE EXECUTE ON FUNCTION public.award_badge(uuid, text) FROM PUBLIC, anon, authenticated;

-- Trigger helpers should not be directly callable over the API.
REVOKE EXECUTE ON FUNCTION public.sync_application_badges() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_membership_badges() FROM PUBLIC, anon, authenticated;

-- Explicitly retain only the authenticated RPCs the client legitimately uses.
GRANT EXECUTE ON FUNCTION public.admin_assign_strategist(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_members() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_strategists() TO authenticated;
GRANT EXECUTE ON FUNCTION public.enroll_member_with_random_strategist(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_strategist() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_feature_access(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_friday_report(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_application_interview_date(uuid, timestamptz) TO authenticated;

-- 6) Safe search_path on application-owned trigger helpers flagged by advisor.
ALTER FUNCTION public.set_updated_at() SET search_path = public;
ALTER FUNCTION public.update_linkedin_profiles_updated_at() SET search_path = public;
