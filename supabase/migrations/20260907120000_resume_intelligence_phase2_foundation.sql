/*
# Resume Intelligence Phase 2 — Persistence Foundation

## Status: AUTHORED, NOT APPLIED
This migration is written to document the Phase 2 persistence design and is
intentionally NOT run against any live Supabase project as part of Phase 2.
No `resume_field_proposals` or `resume_entries` row is written by any
Phase 2 application code -- `applyConfirmedProposals()` writes only to the
existing `member_profiles` table. This file exists so the schema is
reviewed and locked before Phase 3 wires it up.

## Overview
Additive-only evolution of the existing `resume_versions` concept (from
20260802180911_phase4_operational_engine.sql), per the locked Phase 2
architecture:
- `member_profiles` remains the sole canonical career-truth store.
- `member_documents` remains general upload intake; a resume upload becomes
  a parsing *source*, tracked here by `member_documents.id`, never a second
  upload system.
- `resume_versions` (Master + tailored) and `applications.resume_version_id`
  keep their existing identity -- no columns are renamed or removed.
- No full employment/education/certification/skills array is ever
  duplicated into these new tables. `resume_entries` references source
  entries in `member_profiles`; it does not copy them.

## New in this migration
1. Three new nullable columns on `resume_versions`: Master lineage
   (`derived_from_resume_version_id`), target-opportunity linkage
   (`target_opportunity_id`), and upload provenance
   (`source_document_id`).
2. A partial unique index enforcing at most one active Master per member.
3. `set_master_resume_version()` -- the atomic swap RPC (see design note
   below).
4. `resume_entries` -- per-version entry selection/override, referencing
   `member_profiles` array entries by kind-appropriate identity (see design
   note below). No content is duplicated; only `included` and an optional
   resume-specific `override_description` are stored per entry.
5. `resume_field_proposals` -- structured parsing proposals: destination
   (discriminated union, matching `ProposalDestination` in
   src/types/resume.ts), structured provenance (matching
   `ResumeFieldProvenance`), confidence, and the exact member decision
   (matching `ConfirmationDecision`). `status` and `decision` are modeled
   as separate columns per the Phase 2 persistence clarification: `reject`
   and `keep_existing_canonical` are both `status = 'reviewed'` but
   different `decision` values, so later analytics can tell *why* a
   proposal was not applied.

## Design note: one-active-Master partial unique index
`resume_versions` already has `is_master boolean` (unused as a uniqueness
constraint until now) and `is_archived boolean`. This migration adds:

  CREATE UNIQUE INDEX resume_versions_one_active_master_per_member
    ON resume_versions (member_id) WHERE is_master AND NOT is_archived;

An archived Master does not count, so a member can retire an old Master
without first clearing its flag. This is new constraint surface for this
codebase's schema; the first Phase 3 read/write path that touches
`is_master` should exercise this index against a local Supabase instance
before going further.

## Design note: atomic Master swap
A partial unique index is checked immediately, not deferred -- there is no
`DEFERRABLE` option for a `WHERE`-qualified unique index in Postgres. Two
separate `UPDATE` statements (clear old Master, then set new Master) would
therefore violate the index on the first statement. The resolved strategy
is a single `UPDATE` statement that sets `is_master` for every affected row
of one member in one command:

  UPDATE resume_versions
  SET is_master = (id = p_new_master_id), updated_at = now()
  WHERE member_id = v_member_id AND NOT is_archived
    AND (is_master OR id = p_new_master_id);

Because this is one SQL command, Postgres computes every affected row's new
tuple before checking the unique index, so swapping which single row has
`is_master = true` never observes a transient two-Master or zero-Master
state. This is wrapped in `set_master_resume_version()`, a
`SECURITY DEFINER` RPC, rather than left for application code to reconstruct
as two calls.

## Design note: resume_entries discriminator/reference design
`member_profiles.employment_history` entries carry a stable string `id`
(backfilled by `ensureEmploymentEntryIdsForUser`, see
src/lib/forwardDna/employmentEntryIds.ts) -- `resume_entries` references
those by `employment_entry_id`. `education`, `certifications`, and `skills`
entries have NO stable id today (see `EducationEntry` / `CertificationEntry`
in src/types/index.ts) -- for those three kinds this migration references
entries by `source_index`, the entry's position in its array at the time
the `resume_entries` row was created.

This positional reference is a known, documented limitation: if a member
edits or reorders `member_profiles.education` (etc.) after a
`resume_entries` row referencing it was created, that row can silently
point at the wrong entry. This is acceptable for Phase 2 because no
application code writes `resume_entries` rows yet -- there is no UI for
per-version entry selection. It must be revisited before any Phase 3 UI
writes through this table, most likely by extending `EducationEntry` /
`CertificationEntry` / the skills array with a stable id, mirroring the
existing employment-entry-id pattern, rather than continuing with
positional references.

The `resume_entries_identity_by_kind` check constraint enforces that every
row uses exactly the identity column appropriate to its `entry_kind` and
never both or neither.

## Security
RLS enabled on both new tables, mirroring `resume_versions`' existing
member-or-assigned-strategist policy shape.
*/

-- ============================================================
-- RESUME_VERSIONS: additive columns + Master uniqueness
-- ============================================================

ALTER TABLE resume_versions
  ADD COLUMN IF NOT EXISTS derived_from_resume_version_id uuid REFERENCES resume_versions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS target_opportunity_id uuid REFERENCES opportunities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_document_id uuid REFERENCES member_documents(id) ON DELETE SET NULL;

COMMENT ON COLUMN resume_versions.derived_from_resume_version_id IS
  'NULL for the Master Resume. Set for a tailored version, preserving lineage back to the Master it was derived from.';
COMMENT ON COLUMN resume_versions.target_opportunity_id IS
  'Opportunity this tailored version targets, if any. NULL for the Master Resume.';
COMMENT ON COLUMN resume_versions.source_document_id IS
  'The member_documents upload this version originated from, if it was created by parsing an uploaded resume rather than authored directly.';

DROP INDEX IF EXISTS resume_versions_one_active_master_per_member;
CREATE UNIQUE INDEX resume_versions_one_active_master_per_member
  ON resume_versions (member_id)
  WHERE is_master AND NOT is_archived;

CREATE OR REPLACE FUNCTION set_master_resume_version(p_new_master_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_id uuid;
BEGIN
  SELECT member_id INTO v_member_id
  FROM resume_versions
  WHERE id = p_new_master_id AND NOT is_archived;

  IF v_member_id IS NULL THEN
    RAISE EXCEPTION 'resume_versions row % not found or archived', p_new_master_id;
  END IF;

  IF v_member_id <> auth.uid() THEN
    RAISE EXCEPTION 'not authorized to modify this resume version';
  END IF;

  -- Single statement: every affected row's new is_master value is computed
  -- before the partial unique index is checked, so this never observes a
  -- transient two-Master or zero-Master state. See design note above.
  UPDATE resume_versions
  SET is_master = (id = p_new_master_id), updated_at = now()
  WHERE member_id = v_member_id AND NOT is_archived
    AND (is_master OR id = p_new_master_id);
END;
$$;

-- ============================================================
-- RESUME_ENTRIES: per-version entry selection + resume-specific overrides
-- ============================================================

DO $$ BEGIN
  CREATE TYPE resume_entry_kind AS ENUM ('employment', 'education', 'certification', 'skill');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS resume_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resume_version_id uuid NOT NULL REFERENCES resume_versions(id) ON DELETE CASCADE,
  entry_kind resume_entry_kind NOT NULL,

  -- Exactly one of these two identifies the source member_profiles entry,
  -- chosen by entry_kind. See "resume_entries discriminator/reference
  -- design" note above.
  employment_entry_id text,
  source_index integer,

  included boolean NOT NULL DEFAULT true,
  -- Snapshot of the member_profiles description at the time this row was
  -- created, retained alongside override_description so nothing in
  -- member_profiles is ever silently rewritten (mirrors Career Vault's
  -- "never rewrite original_statement" rule). NULL for kinds without a
  -- free-text description (certification, skill).
  original_description text,
  override_description text,

  created_at timestamptz DEFAULT now(),

  CONSTRAINT resume_entries_identity_by_kind CHECK (
    (entry_kind = 'employment' AND employment_entry_id IS NOT NULL AND source_index IS NULL)
    OR (entry_kind <> 'employment' AND employment_entry_id IS NULL AND source_index IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS resume_entries_resume_version_id_idx ON resume_entries(resume_version_id);

ALTER TABLE resume_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_resume_entries" ON resume_entries;
CREATE POLICY "select_own_resume_entries"
  ON resume_entries FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM resume_versions rv
      WHERE rv.id = resume_entries.resume_version_id
      AND (
        rv.member_id = auth.uid()
        OR auth.uid() IN (
          SELECT strategist_id FROM strategist_assignments
          WHERE strategist_assignments.member_id = rv.member_id
          AND strategist_assignments.is_active = true
        )
      )
    )
  );

DROP POLICY IF EXISTS "modify_own_resume_entries" ON resume_entries;
CREATE POLICY "modify_own_resume_entries"
  ON resume_entries FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM resume_versions rv
      WHERE rv.id = resume_entries.resume_version_id
      AND (
        rv.member_id = auth.uid()
        OR auth.uid() IN (
          SELECT strategist_id FROM strategist_assignments
          WHERE strategist_assignments.member_id = rv.member_id
          AND strategist_assignments.is_active = true
        )
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM resume_versions rv
      WHERE rv.id = resume_entries.resume_version_id
      AND (
        rv.member_id = auth.uid()
        OR auth.uid() IN (
          SELECT strategist_id FROM strategist_assignments
          WHERE strategist_assignments.member_id = rv.member_id
          AND strategist_assignments.is_active = true
        )
      )
    )
  );

-- ============================================================
-- RESUME_FIELD_PROPOSALS: parsing proposals, provenance, member decision
-- ============================================================

DO $$ BEGIN
  CREATE TYPE resume_proposal_destination_kind AS ENUM ('canonical-profile', 'canonical-profile-array', 'resume-specific');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE resume_proposal_confidence AS ENUM ('high', 'medium', 'low');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE resume_confirmation_decision AS ENUM (
    'reject', 'accept_as_canonical', 'accept_edited_canonical',
    'keep_existing_canonical', 'use_as_resume_specific_only'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE resume_suggestion_status AS ENUM ('pending', 'reviewed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS resume_field_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  source_document_id uuid NOT NULL REFERENCES member_documents(id) ON DELETE CASCADE,
  -- NULL until a resume_versions row exists for this parsing pass -- a
  -- proposal can be reviewed and applied to member_profiles before any
  -- resume version is created from the uploaded document.
  resume_version_id uuid REFERENCES resume_versions(id) ON DELETE SET NULL,

  -- Destination: flattened discriminated union, matching ProposalDestination
  -- in src/types/resume.ts. No separate isCanonical flag -- canonical-ness
  -- is always derived from destination_kind (see isCanonicalDestination()),
  -- exactly as in the TypeScript layer (correction #2).
  destination_kind resume_proposal_destination_kind NOT NULL,
  destination_field text NOT NULL,
  -- Only set when destination_kind = 'canonical-profile-array': 'append' or an integer-as-text index.
  destination_array_index text,

  candidate_value text NOT NULL,
  proposed_action text NOT NULL CHECK (proposed_action IN ('create', 'update', 'no-op-already-present')),
  confidence resume_proposal_confidence NOT NULL,

  -- Structured provenance, matching ResumeFieldProvenance in src/types/resume.ts.
  -- provenance_source_excerpt must always be a literal substring of the
  -- referenced block(s) -- enforced in application code (anti-fabrication
  -- tests), not by this schema.
  provenance_section_kind text NOT NULL,
  provenance_block_orders integer[] NOT NULL,
  provenance_source_excerpt text NOT NULL,
  provenance_page integer,
  provenance_matched_rule text NOT NULL,

  -- Workflow status kept separate from the member's actual decision, per
  -- the Phase 2 persistence clarification: reject and keep_existing_canonical
  -- are both status = 'reviewed' but different, distinguishable decisions.
  status resume_suggestion_status NOT NULL DEFAULT 'pending',
  decision resume_confirmation_decision,
  decision_edited_value text,
  decided_at timestamptz,

  created_at timestamptz DEFAULT now(),

  CONSTRAINT resume_field_proposals_decision_requires_reviewed CHECK (
    (status = 'pending' AND decision IS NULL AND decided_at IS NULL)
    OR (status = 'reviewed' AND decision IS NOT NULL AND decided_at IS NOT NULL)
  ),
  CONSTRAINT resume_field_proposals_edited_value_only_when_relevant CHECK (
    decision_edited_value IS NULL OR decision IN ('accept_edited_canonical', 'use_as_resume_specific_only')
  )
);

CREATE INDEX IF NOT EXISTS resume_field_proposals_source_document_id_idx ON resume_field_proposals(source_document_id);
CREATE INDEX IF NOT EXISTS resume_field_proposals_resume_version_id_idx ON resume_field_proposals(resume_version_id);
CREATE INDEX IF NOT EXISTS resume_field_proposals_user_id_idx ON resume_field_proposals(user_id);

ALTER TABLE resume_field_proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_resume_field_proposals" ON resume_field_proposals;
CREATE POLICY "select_own_resume_field_proposals"
  ON resume_field_proposals FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR auth.uid() IN (
      SELECT strategist_id FROM strategist_assignments
      WHERE strategist_assignments.member_id = resume_field_proposals.user_id
      AND strategist_assignments.is_active = true
    )
  );

DROP POLICY IF EXISTS "insert_own_resume_field_proposals" ON resume_field_proposals;
CREATE POLICY "insert_own_resume_field_proposals"
  ON resume_field_proposals FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_resume_field_proposals" ON resume_field_proposals;
CREATE POLICY "update_own_resume_field_proposals"
  ON resume_field_proposals FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_resume_field_proposals" ON resume_field_proposals;
CREATE POLICY "delete_own_resume_field_proposals"
  ON resume_field_proposals FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
