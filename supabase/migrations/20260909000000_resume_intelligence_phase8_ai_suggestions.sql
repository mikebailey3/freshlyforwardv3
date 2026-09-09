-- Resume Intelligence Phase 8 — AI provider boundary: grounded content
-- suggestions, explicit review/acceptance.
--
-- Additive only -- no existing column/table/policy is altered. This
-- mirrors resume_field_proposals' propose/review shape (Phase 2) and
-- reuses its two existing enums (resume_suggestion_status,
-- resume_confirmation_decision) rather than inventing parallel ones.
--
-- `evidence_reference` is nullable (matches ResumeContentSuggestion in
-- src/types/resume.ts: "Null only for a purely stylistic suggestion with
-- no factual content"), but every suggestion that DOES carry factual
-- content must have a non-null evidence_reference that the application
-- layer (validateGroundedProposal.ts) verifies resolves to real evidence
-- BEFORE a row is ever inserted here -- this table trusts the
-- application layer for that check; it does not re-implement grounding
-- verification in SQL.
--
-- No AI/LLM call is wired to write this table yet (no NullResumeAIContentProvider
-- caller exists in production) -- this migration ships the durable
-- persistence shape ahead of that, exactly the same "ship the boundary,
-- then swap in a real implementation" sequencing already used everywhere
-- else in Resume Intelligence.

CREATE TABLE IF NOT EXISTS resume_content_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  resume_version_id uuid NOT NULL REFERENCES resume_versions(id) ON DELETE CASCADE,

  target_field text NOT NULL,
  proposed_text text NOT NULL,
  -- Traceable to a literal source: a Career Vault career_wins.original_statement
  -- excerpt, or a literal substring of the member's own canonical Profile
  -- content. Never an invented example. See validateGroundedProposal.ts.
  evidence_reference text,

  -- Same propose/review split as resume_field_proposals, reusing its enums.
  status resume_suggestion_status NOT NULL DEFAULT 'pending',
  decision resume_confirmation_decision,
  decision_edited_value text,
  decided_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT resume_content_suggestions_decision_requires_reviewed CHECK (
    (status = 'pending' AND decision IS NULL AND decided_at IS NULL)
    OR (status = 'reviewed' AND decision IS NOT NULL AND decided_at IS NOT NULL)
  ),
  CONSTRAINT resume_content_suggestions_edited_value_only_when_relevant CHECK (
    decision_edited_value IS NULL OR decision IN ('accept_edited_canonical', 'use_as_resume_specific_only')
  )
);

CREATE INDEX IF NOT EXISTS resume_content_suggestions_resume_version_id_idx ON resume_content_suggestions(resume_version_id);
CREATE INDEX IF NOT EXISTS resume_content_suggestions_user_id_idx ON resume_content_suggestions(user_id);

ALTER TABLE resume_content_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_resume_content_suggestions" ON resume_content_suggestions;
CREATE POLICY "select_own_resume_content_suggestions"
  ON resume_content_suggestions FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR auth.uid() IN (
      SELECT strategist_id FROM strategist_assignments
      WHERE strategist_assignments.member_id = resume_content_suggestions.user_id
      AND strategist_assignments.is_active = true
    )
  );

DROP POLICY IF EXISTS "insert_own_resume_content_suggestions" ON resume_content_suggestions;
CREATE POLICY "insert_own_resume_content_suggestions"
  ON resume_content_suggestions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_resume_content_suggestions" ON resume_content_suggestions;
CREATE POLICY "update_own_resume_content_suggestions"
  ON resume_content_suggestions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_resume_content_suggestions" ON resume_content_suggestions;
CREATE POLICY "delete_own_resume_content_suggestions"
  ON resume_content_suggestions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
