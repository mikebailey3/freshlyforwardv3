/*
# Resume Intelligence Phase 2/3 — Persistence Foundation

## Status: AUTHORED, NOT APPLIED
This migration is written to document the persistence design and is
intentionally NOT run against any live Supabase project. This file exists
so the schema is reviewed and locked before it is ever wired up against a
real database (local/branch environment for integration testing first,
never production from this design turn).

## Revision history
- 2026-09-07 (Phase 2): initial authoring -- `resume_versions` lineage
  columns, Master uniqueness, `resume_entries` (employment/source_index
  discriminator), `resume_field_proposals`.
- 2026-09-07 (Phase 3): revised in place (not layered as a second
  migration, since nothing here has ever been applied) once stable
  canonical entry ids existed for employment/education/certifications
  (src/lib/profile/entryIds.ts): `resume_entries` collapses to a single
  `canonical_entry_id` + `skill_value` discriminator (§ "resume_entries
  discriminator/reference design" below); added `resume_import_attempts`
  and `resume_field_proposals.import_attempt_id`/`superseded_at` to make
  retry/supersession explicit rather than timestamp-inferred (§ "Design
  note: import attempts & retry/supersession"); documented the member-only
  canonical-confirmation authorization boundary already implied by the
  Phase 2 RLS (§ "Design note: confirmation authorization").

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
6. `resume_import_attempts` (Phase 3) -- one row per scan/import
   execution, explicit `resume_field_proposals.import_attempt_id`
   lineage, and `superseded_at` for retry/supersession (see design note
   below).

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

## Design note: resume_entries discriminator/reference design (revised, Phase 3)
Phase 3 introduced `src/lib/profile/entryIds.ts`: a domain-neutral,
additive backfill (existing ids never regenerated, only missing ones
assigned) that gives `member_profiles.employment_history`, `.education`,
and `.certifications` entries a durable string `id`. With that in place,
`resume_entries` no longer needs the Phase 2 `employment_entry_id` /
`source_index`-by-kind split -- every non-skill kind now references its
source entry the same way:

  employment/education/certification -> `canonical_entry_id text`
  skill                               -> `skill_value text` (a skill's
                                          identity is its own string value;
                                          member_profiles.skills is a
                                          flat string[] with no per-entry
                                          object at all, so there is
                                          nothing else to reference)

**`canonical_entry_id`/`skill_value` are still not, and cannot be, a
REFERENCES / foreign key.** Postgres cannot enforce a foreign key into an
individual element of a jsonb array no matter what identity scheme that
element carries -- this is unchanged from Phase 2 and is not a gap this
migration can close. What changed is *reliability*, not *enforceability*:
a Phase 2 `employment_entry_id` might not exist yet (backfill was
opportunistic, driven only by a Forward DNA page load); after Phase 3's
save-path-audited, always-assign-on-first-touch backfill, every entry a
member has interacted with since has one. **Because the database still
cannot check this, application/service code MUST verify the referenced
canonical entry actually exists for that member before creating or
updating a `resume_entries` row** -- see `createMasterResume.ts`'s
validation step, which is the actual enforcement boundary here, not this
schema.

A single `entry_kind`-discriminated table (kept) versus one narrow table
per content type (rejected) were both reconsidered under the same
reasoning as Phase 2: splitting the table would not gain any enforcement
Postgres can't already provide, since the real constraint is
`member_profiles` storing these as jsonb arrays rather than normalized
rows -- unchanged by which shape `resume_entries` itself takes.

The `resume_entries_identity_by_kind` check constraint enforces that every
row uses exactly the identity column appropriate to its `entry_kind` and
never both or neither.

## Design note: import attempts & retry/supersession (Phase 3)
`resume_import_attempts` is one row per scan/import execution --
`member_documents` -> `resume_import_attempts` -> `resume_field_proposals`.
A re-scan is always an explicit member action, never automatic. On retry:
1. a new `resume_import_attempts` row is created for the same
   `source_document_id`;
2. the new field-mapping pass's proposals are inserted with
   `import_attempt_id` pointing at that new row;
3. still-`pending` proposals from the prior attempt(s) on the same
   document are marked `superseded_at = now()` -- never deleted, so the
   audit trail survives;
4. any proposal already `status = 'reviewed'` from a prior attempt is left
   completely untouched -- `resume_field_proposals_supersede_only_when_pending`
   makes this a schema-enforced invariant, not just an application
   convention;
5. nothing here ever re-applies a canonical write on its own -- a retry
   only ever creates new *proposals*; a canonical `member_profiles` write
   still requires a fresh, explicit member decision through the
   confirmation layer, exactly as on a first import.
Generation/supersession is keyed by `import_attempt_id`, never inferred
from `created_at` -- two attempts started in the same instant (unlikely
but not impossible) would be ambiguous under timestamp-only inference.

## Design note: confirmation authorization (member-only canonical decisions)
Resume Intelligence Phase 3 requires that only the member themself can
turn a proposal into a canonical `member_profiles` write --
`accept_as_canonical` / `accept_edited_canonical` must never be
performable by an assisting strategist on the member's behalf, absent an
explicit product decision to allow it (none exists as of Phase 3). Two
independent layers already enforce this, verified by direct read-only
inspection of the live schema (2026-09-07), not assumed:
1. `resume_field_proposals`'s own `update_own_resume_field_proposals`
   policy (unchanged by this revision) is `USING (auth.uid() = user_id)`
   with no strategist branch at all -- a strategist's session cannot move
   a proposal's `status`/`decision` regardless of assignment, full stop.
2. Even if it somehow could, `member_profiles`'s live UPDATE policies
   (`update_own_profile`: `auth.uid() = user_id`; `admin_update_all_profiles`:
   admin-only) also have no strategist branch -- so the canonical write
   `applyConfirmedProposals()` ultimately issues is independently blocked
   at the actual target table too. A strategist's assistance is therefore
   necessarily limited to what the SELECT policies above already allow:
   viewing `resume_import_attempts` and `resume_field_proposals` for an
   assigned member. `resume_entries` (which never touches
   `member_profiles`, only which existing entries a resume version
   selects) intentionally keeps the more permissive `FOR ALL`
   member-or-strategist shape already established for `resume_versions`
   itself in the Phase 4 schema -- curating a resume's contents is not a
   canonical-fact decision.

## Security
RLS enabled on all three new/revised tables, mirroring `resume_versions`'
existing member-or-assigned-strategist SELECT shape, with the
member-only-write exception for canonical decisions documented above.
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
  -- chosen by entry_kind. Neither is a REFERENCES / foreign key -- see
  -- "resume_entries discriminator/reference design" note above.
  canonical_entry_id text,
  skill_value text,

  included boolean NOT NULL DEFAULT true,
  -- Explicit per-version ordering. Nullable-but-conventionally-set rather
  -- than relying on row insertion order, which Postgres never guarantees
  -- on SELECT.
  sort_order integer,
  -- Snapshot of the member_profiles description at the time this row was
  -- created, retained alongside override_description so nothing in
  -- member_profiles is ever silently rewritten (mirrors Career Vault's
  -- "never rewrite original_statement" rule). NULL for kinds without a
  -- free-text description (certification, skill).
  original_description text,
  override_description text,

  created_at timestamptz DEFAULT now(),

  CONSTRAINT resume_entries_identity_by_kind CHECK (
    (entry_kind IN ('employment', 'education', 'certification') AND canonical_entry_id IS NOT NULL AND skill_value IS NULL)
    OR (entry_kind = 'skill' AND canonical_entry_id IS NULL AND skill_value IS NOT NULL)
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
-- RESUME_IMPORT_ATTEMPTS: one row per scan/import execution (Phase 3)
-- ============================================================

CREATE TABLE IF NOT EXISTS resume_import_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_document_id uuid NOT NULL REFERENCES member_documents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'succeeded', 'partial', 'unsupported_format', 'extraction_failed', 'no_content_found')
  ),
  error_message text,
  proposal_count integer NOT NULL DEFAULT 0,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS resume_import_attempts_source_document_id_idx ON resume_import_attempts(source_document_id);
CREATE INDEX IF NOT EXISTS resume_import_attempts_user_id_idx ON resume_import_attempts(user_id);

ALTER TABLE resume_import_attempts ENABLE ROW LEVEL SECURITY;

-- View-only for an assisting strategist (per the Phase 3 authorization
-- rule -- see "Design note: confirmation authorization" below): a
-- strategist may see that an import happened and what its outcome was,
-- but attempts are only ever created/updated by the member's own
-- import-triggering action in Phase 3, so INSERT/UPDATE stay member-only.
DROP POLICY IF EXISTS "select_own_resume_import_attempts" ON resume_import_attempts;
CREATE POLICY "select_own_resume_import_attempts"
  ON resume_import_attempts FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR auth.uid() IN (
      SELECT strategist_id FROM strategist_assignments
      WHERE strategist_assignments.member_id = resume_import_attempts.user_id
      AND strategist_assignments.is_active = true
    )
  );

DROP POLICY IF EXISTS "insert_own_resume_import_attempts" ON resume_import_attempts;
CREATE POLICY "insert_own_resume_import_attempts"
  ON resume_import_attempts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_resume_import_attempts" ON resume_import_attempts;
CREATE POLICY "update_own_resume_import_attempts"
  ON resume_import_attempts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

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
  -- Phase 3: the scan/import execution that produced this proposal. Drives
  -- retry/supersession by attempt identity rather than inferring
  -- "generations" from created_at timestamps -- see "Design note: import
  -- attempts & retry/supersession" below.
  import_attempt_id uuid NOT NULL REFERENCES resume_import_attempts(id) ON DELETE CASCADE,
  -- Phase 3: set when a later import attempt on the same source document
  -- supersedes this still-pending proposal. NULL for the current
  -- generation. A `reviewed` proposal is never superseded -- a retry only
  -- ever touches proposals still `pending`.
  superseded_at timestamptz,
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
  ),
  -- A reviewed proposal represents a real member decision and is never
  -- retroactively superseded by a later retry -- only a still-pending
  -- proposal can be.
  CONSTRAINT resume_field_proposals_supersede_only_when_pending CHECK (
    superseded_at IS NULL OR status = 'pending'
  )
);

CREATE INDEX IF NOT EXISTS resume_field_proposals_source_document_id_idx ON resume_field_proposals(source_document_id);
CREATE INDEX IF NOT EXISTS resume_field_proposals_resume_version_id_idx ON resume_field_proposals(resume_version_id);
CREATE INDEX IF NOT EXISTS resume_field_proposals_user_id_idx ON resume_field_proposals(user_id);
CREATE INDEX IF NOT EXISTS resume_field_proposals_import_attempt_id_idx ON resume_field_proposals(import_attempt_id);

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
