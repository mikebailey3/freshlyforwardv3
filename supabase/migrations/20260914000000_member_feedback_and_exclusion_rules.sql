/*
# Opportunity Engine 2.0 Phase 9 -- Member Feedback & Exclusion Rules

## STATUS: PREPARED FOR REVIEW. NOT APPLIED.
Per explicit instruction, this migration has NOT been run against any
database (production or otherwise) from this session. It is committed
here, following the exact same "prepared, not applied" precedent as
every prior OE 2.0 migration in this manifest, so it can be reviewed
and then applied deliberately as a separate, explicit step.

## Overview
Two independent, additive schema changes:

### 1. member_job_exclusion_rules (new table)
Persistent "don't show me this again" rules, exactly as specified in
the approved plan. `rule_type` is constrained to a small closed set via
CHECK; `value` is free text (a company name, a title keyword, or an
industry term). UNIQUE(member_id, rule_type, value) so re-adding the
same rule is a safe no-op, not a duplicate row.

### 2. member_feedback.job_match_id (new column on an EXISTING table)
`member_feedback` already exists (20260802180911_phase4_operational_engine.sql)
with nullable `opportunity_id`/`application_id` FKs and a free-text
`feedback_type` + `comment` -- but neither existing FK can reference a
raw `job_matches` row, and most dismissals happen long before a match is
ever promoted to an `opportunity`. This column is the "deferred
dismissal_reason" concept referenced in this project's own prior
session notes -- on inspection, reusing the ALREADY-EXISTING, already
schema-flexible `member_feedback` table (see src/lib/opportunityEngine/dismissalReasons.ts
for the canonical reason taxonomy enforced in application code, not the
database) is the correct DRY fix, not a brand-new bespoke
`dismissal_reason` column bolted directly onto `job_matches` itself.
Nullable, ON DELETE CASCADE -- a member's feedback about a match that's
since been deleted has nothing meaningful left to reference.

## RLS
member_job_exclusion_rules: member owns their own rows (select/insert/
delete); assigned strategists read-only -- the exact same
`strategist_assignments`-scoped pattern used by every other
member-scoped table in this schema (member_feedback included), no new
pattern invented. member_feedback's existing select/insert/delete
policies already scope by `member_id` and require no change for the new
nullable column.

## No behavior change until applied
Both changes are additive/nullable, and every call site that depends on
them degrades safely in the meantime:
- `getExclusionRules()` (src/lib/opportunityEngine/exclusionRules.ts)
  catches the SELECT failure, logs it, and returns `[]` -- scoring and
  ranking behave identically to today until this lands.
- `dismissJobMatch()`'s optional reason/comment write to
  `member_feedback` is caught and logged without blocking or reverting
  the dismissal itself -- the member's dismiss action always succeeds
  either way.
*/

CREATE TABLE IF NOT EXISTS public.member_job_exclusion_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rule_type text NOT NULL CHECK (rule_type IN ('company', 'title_keyword', 'industry')),
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_id, rule_type, value)
);

ALTER TABLE public.member_job_exclusion_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_exclusion_rules" ON public.member_job_exclusion_rules;
CREATE POLICY "select_own_exclusion_rules"
  ON public.member_job_exclusion_rules FOR SELECT
  TO authenticated
  USING (
    auth.uid() = member_id
    OR auth.uid() IN (
      SELECT strategist_id FROM public.strategist_assignments
      WHERE strategist_assignments.member_id = member_job_exclusion_rules.member_id
      AND strategist_assignments.is_active = true
    )
  );

DROP POLICY IF EXISTS "insert_own_exclusion_rules" ON public.member_job_exclusion_rules;
CREATE POLICY "insert_own_exclusion_rules"
  ON public.member_job_exclusion_rules FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = member_id);

DROP POLICY IF EXISTS "delete_own_exclusion_rules" ON public.member_job_exclusion_rules;
CREATE POLICY "delete_own_exclusion_rules"
  ON public.member_job_exclusion_rules FOR DELETE
  TO authenticated
  USING (auth.uid() = member_id);

ALTER TABLE public.member_feedback
  ADD COLUMN IF NOT EXISTS job_match_id uuid REFERENCES public.job_matches(id) ON DELETE CASCADE;

-- Security Gate finding (fixed pre-apply): the ORIGINAL insert_own_feedback
-- policy (20260802180911_phase4_operational_engine.sql) only ever
-- verified auth.uid() = member_id -- it never verified that an optional
-- job_match_id (the column just added above) actually belongs to a
-- job_matches row owned by that same member. Without this, a member
-- could attribute feedback to themselves while pointing job_match_id at
-- a job_matches row belonging to a DIFFERENT member. This never leaked
-- data (member_feedback's SELECT policy still scopes strictly by
-- member_id/strategist assignment), but it was a real cross-member
-- reference/data-integrity gap. Re-created here (not edited in place in
-- the original Phase 4 file -- that migration may already be applied
-- elsewhere, and migrations are never edited after the fact, only
-- superseded) with the added ownership check.
DROP POLICY IF EXISTS "insert_own_feedback" ON public.member_feedback;
CREATE POLICY "insert_own_feedback"
  ON public.member_feedback FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = member_id
    AND (
      job_match_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.job_matches
        WHERE job_matches.id = member_feedback.job_match_id
        AND job_matches.member_id = auth.uid()
      )
    )
  );
