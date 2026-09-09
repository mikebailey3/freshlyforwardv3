-- Resume Intelligence Phase 5 completion — generic resume-version entries
-- write path.
--
-- Gap found during live-integration wiring: `replace_master_resume_entries()`
-- (Phase 2/4) hard-refuses any version where `is_master = false`. That
-- was correct for Phase 4's Master-only workflow, but it means a
-- derived/tailored resume version (Phase 5/6) has NO write path at all
-- for its own entry selection/ordering/override text -- exactly the kind
-- of "individual components, not a cohesive experience" gap the Phase
-- 5-8 completion review called out.
--
-- Additive only: does not touch `replace_master_resume_entries()` or any
-- existing caller of it (Phase 4's `updateMasterResumeEntries.ts` is
-- untouched and keeps its Master-only guarantee). This is a new,
-- separate RPC for the general case: any of the member's own,
-- non-archived resume versions (Master OR derived) -- the presentation
-- layer is allowed to hold its own included/order/override choices
-- regardless of which version it is (locked: "Resume Version =
-- presentation/version layer").

CREATE OR REPLACE FUNCTION replace_resume_version_entries(p_resume_version_id uuid, p_entries jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_id uuid;
  v_is_archived boolean;
BEGIN
  SELECT member_id, is_archived
    INTO v_member_id, v_is_archived
  FROM resume_versions
  WHERE id = p_resume_version_id;

  IF v_member_id IS NULL THEN
    RAISE EXCEPTION 'resume_versions row % not found', p_resume_version_id;
  END IF;

  -- NULL-safe: `v_member_id <> auth.uid()` alone is NULL (not TRUE) when
  -- auth.uid() is NULL (an anon/unauthenticated caller), and PL/pgSQL's
  -- `IF NULL THEN` never raises -- that would silently let an
  -- unauthenticated caller sail past this check entirely. Found and
  -- fixed during the Phase 5-8 completion audit; explicitly rejecting a
  -- NULL auth.uid() first closes it.
  IF auth.uid() IS NULL OR v_member_id <> auth.uid() THEN
    RAISE EXCEPTION 'not authorized to modify this resume version';
  END IF;

  IF v_is_archived THEN
    RAISE EXCEPTION 'cannot modify an archived resume version';
  END IF;

  DELETE FROM resume_entries WHERE resume_version_id = p_resume_version_id;

  INSERT INTO resume_entries (resume_version_id, entry_kind, canonical_entry_id, skill_value, included, sort_order, override_description)
  SELECT
    p_resume_version_id,
    (x.entry_kind)::resume_entry_kind,
    x.canonical_entry_id,
    x.skill_value,
    x.included,
    x.sort_order,
    x.override_description
  FROM jsonb_to_recordset(p_entries) AS x(
    entry_kind text,
    canonical_entry_id text,
    skill_value text,
    included boolean,
    sort_order integer,
    override_description text
  );
END;
$$;

-- Phase 5-8 completion audit: match the repo's established SECURITY
-- DEFINER hardening convention (see
-- 20260902021400_harden_rls_and_security_definer_access.sql) rather than
-- relying on Postgres's default PUBLIC-execute grant. Belt-and-suspenders
-- alongside the NULL-safe auth.uid() check above -- an anon/unauthenticated
-- caller should never even be able to reach this function to begin with.
REVOKE EXECUTE ON FUNCTION replace_resume_version_entries(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION replace_resume_version_entries(uuid, jsonb) TO authenticated;
