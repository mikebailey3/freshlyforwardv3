-- Protect member_profiles privileged columns from member self-escalation
--
-- Vulnerability: RLS on member_profiles lets a member UPDATE their own row
-- ("update_own_profile"-style policy keyed on auth.uid() = user_id), but
-- nothing at the column level stops that same member from including
-- system-controlled fields in the update payload -- plan_id,
-- subscription_status, stripe_customer_id, stripe_subscription_id,
-- is_strategist, is_lifetime_founding, is_alumni, account_status,
-- account_status_reason, account_status_changed_at. A member could grant
-- themselves a paid plan, mark themselves an active strategist, forge a
-- lifetime-founding/alumni badge, or clear an admin-applied suspension --
-- all client-side, with no server-side check today.
--
-- Why a trigger, not column GRANT/REVOKE: Supabase admins and ordinary
-- members share the same `authenticated` Postgres role. "Admin" is only a
-- JWT claim (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin') checked
-- inside RLS/functions -- there is no separate database role to scope a
-- column-level REVOKE to. A REVOKE broad enough to stop members would also
-- stop admins performing the exact same UPDATE through the same role. A
-- BEFORE trigger that inspects the JWT claim (or service_role, for the
-- Stripe/admin edge functions) is the only enforcement point that can tell
-- the two apart.
--
-- Columns protected (forced back to their pre-write value on UPDATE, or to
-- the same default the column itself would already apply on INSERT):
--   plan_id, subscription_status, stripe_customer_id, stripe_subscription_id,
--   is_strategist, is_lifetime_founding, is_alumni, account_status,
--   account_status_reason, account_status_changed_at.
--
-- Ordering note: this is a BEFORE trigger, so it normalizes NEW before the
-- row is ever written and before trg_sync_membership_badges (an AFTER
-- trigger defined in 20260818010000_badge_system.sql) runs. Postgres always
-- finishes all BEFORE triggers for a row (which is what produces the final
-- NEW) before firing any AFTER trigger, so a non-trusted actor's forged
-- plan_id/is_lifetime_founding/is_alumni values are already reverted by the
-- time sync_membership_badges reads NEW -- no fraudulent badge can be
-- triggered via these columns. trg_sync_membership_badges and
-- sync_membership_badges() are unmodified by this migration.
--
-- Legacy `status` and `search_readiness_score` columns are explicitly out
-- of scope for this change and are left untouched.
--
-- This is a forward-only migration. Do NOT apply it here -- it must be
-- reviewed and pushed through the normal Supabase deploy process.

CREATE OR REPLACE FUNCTION protect_member_profiles_privileged_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_trusted boolean;
BEGIN
  v_is_trusted := auth.role() = 'service_role'
               OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin';

  IF NOT v_is_trusted THEN
    IF TG_OP = 'INSERT' THEN
      NEW.plan_id := NULL;
      NEW.subscription_status := 'none';
      NEW.stripe_customer_id := NULL;
      NEW.stripe_subscription_id := NULL;
      NEW.is_strategist := false;
      NEW.is_lifetime_founding := false;
      NEW.is_alumni := false;
      NEW.account_status := 'active';
      NEW.account_status_reason := NULL;
      NEW.account_status_changed_at := NULL;
    ELSIF TG_OP = 'UPDATE' THEN
      NEW.plan_id := OLD.plan_id;
      NEW.subscription_status := OLD.subscription_status;
      NEW.stripe_customer_id := OLD.stripe_customer_id;
      NEW.stripe_subscription_id := OLD.stripe_subscription_id;
      NEW.is_strategist := OLD.is_strategist;
      NEW.is_lifetime_founding := OLD.is_lifetime_founding;
      NEW.is_alumni := OLD.is_alumni;
      NEW.account_status := OLD.account_status;
      NEW.account_status_reason := OLD.account_status_reason;
      NEW.account_status_changed_at := OLD.account_status_changed_at;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_member_profiles_privileged_fields ON member_profiles;
CREATE TRIGGER trg_protect_member_profiles_privileged_fields
  BEFORE INSERT OR UPDATE
  ON member_profiles
  FOR EACH ROW
  EXECUTE FUNCTION protect_member_profiles_privileged_fields();

-- Trigger helper should not be directly callable over the API, matching
-- the convention already applied to sync_membership_badges() and
-- sync_application_badges() in 20260902021400_harden_rls_and_security_definer_access.sql.
REVOKE EXECUTE ON FUNCTION public.protect_member_profiles_privileged_fields() FROM PUBLIC, anon, authenticated;
