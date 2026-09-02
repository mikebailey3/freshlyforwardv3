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
-- Privilege model: this function is intentionally SECURITY INVOKER (the
-- default -- no SECURITY DEFINER clause). It never reads or writes
-- anything beyond the NEW/OLD row already supplied by the trigger
-- mechanism for the statement in progress, so it needs no privilege
-- beyond whatever the invoking statement already has; granting it
-- definer-level elevation would violate least privilege for no benefit.
-- Trigger firing itself does not depend on EXECUTE privilege or on
-- DEFINER/INVOKER -- Postgres invokes trigger functions directly via the
-- trigger catalog, bypassing the ACL check that gates an explicit SQL
-- call, and it fires for every statement against this table regardless
-- of RLS/BYPASSRLS status. auth.jwt() reads the request-scoped JWT-claims
-- GUC set by PostgREST for the actual calling session; that is unaffected
-- by SECURITY DEFINER/INVOKER either way, so the trust check below
-- behaves identically under both models -- INVOKER is strictly safer here
-- with no functional trade-off. auth.jwt()/auth.role() are always called
-- schema-qualified in this function, so search_path cannot be hijacked to
-- shadow them; SET search_path = public is kept anyway as cheap,
-- convention-matching defense-in-depth.
--
-- This is a forward-only migration. Do NOT apply it here -- it must be
-- reviewed and pushed through the normal Supabase deploy process.

CREATE OR REPLACE FUNCTION protect_member_profiles_privileged_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_is_trusted boolean;
BEGIN
  -- auth.jwt() ->> 'role' reads the top-level `role` claim carried by the
  -- service-role key's own JWT (distinct from auth.role(), a legacy
  -- Supabase helper still used in an earlier historical migration in this
  -- repo -- left untouched there, since historical migrations aren't
  -- edited). app_metadata is used for the admin check, never
  -- user_metadata, since user_metadata is end-user-writable and would let
  -- a member grant themselves admin.
  v_is_trusted := (auth.jwt() ->> 'role') = 'service_role'
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
