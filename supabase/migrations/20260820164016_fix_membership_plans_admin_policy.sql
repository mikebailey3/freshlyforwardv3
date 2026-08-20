-- The admin_write_membership_plans policy queries auth.users to check the
-- admin role. The authenticated role lacks SELECT on auth.users, so any
-- authenticated (non-admin) query on membership_plans fails with
-- "permission denied for table users" before the public_read policy can
-- return rows. Replace the auth.users subquery with a JWT check that
-- doesn't require table access.

DROP POLICY IF EXISTS "admin_write_membership_plans" ON public.membership_plans;

CREATE POLICY "admin_write_membership_plans"
  ON public.membership_plans
  FOR ALL
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text = 'admin'::text)
  WITH CHECK ((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text = 'admin'::text);
