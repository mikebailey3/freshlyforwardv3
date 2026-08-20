ALTER TABLE member_profiles ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active';
ALTER TABLE member_profiles ADD COLUMN IF NOT EXISTS account_status_reason text;
ALTER TABLE member_profiles ADD COLUMN IF NOT EXISTS account_status_changed_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'member_profiles_account_status_check'
  ) THEN
    ALTER TABLE member_profiles
      ADD CONSTRAINT member_profiles_account_status_check
      CHECK (account_status IN ('active', 'suspended', 'banned'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_member_profiles_account_status ON member_profiles(account_status);

DROP POLICY IF EXISTS "admin_select_all_profiles" ON member_profiles;
CREATE POLICY "admin_select_all_profiles"
  ON member_profiles FOR SELECT
  TO authenticated
  USING (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin');

DROP POLICY IF EXISTS "admin_update_all_profiles" ON member_profiles;
CREATE POLICY "admin_update_all_profiles"
  ON member_profiles FOR UPDATE
  TO authenticated
  USING (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin');

DROP POLICY IF EXISTS "strategist_select_assigned_profiles" ON member_profiles;
CREATE POLICY "strategist_select_assigned_profiles"
  ON member_profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM strategist_assignments sa
      WHERE sa.member_id = member_profiles.user_id
        AND sa.strategist_id = auth.uid()
        AND sa.is_active = true
    )
  );

CREATE OR REPLACE FUNCTION admin_list_members()
RETURNS TABLE (
  user_id uuid,
  email text,
  full_name text,
  headline text,
  plan_id uuid,
  plan_name text,
  subscription_status text,
  account_status text,
  account_status_reason text,
  onboarding_completed boolean,
  search_readiness_score integer,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (auth.jwt() -> 'app_metadata' ->> 'role') IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN QUERY
  SELECT
    mp.user_id,
    au.email::text,
    mp.full_name,
    mp.headline,
    mp.plan_id,
    plans.name,
    mp.subscription_status,
    mp.account_status,
    mp.account_status_reason,
    mp.onboarding_completed,
    mp.search_readiness_score,
    mp.created_at
  FROM member_profiles mp
  JOIN auth.users au ON au.id = mp.user_id
  LEFT JOIN membership_plans plans ON plans.id = mp.plan_id
  ORDER BY mp.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_list_members() TO authenticated;