/*
# OE 2.0 Hardening -- foreign key covering indexes

## STATUS: PREPARED FOR REVIEW. NOT APPLIED TO PRODUCTION.
Forward migration only. Postgres does not automatically index the
referencing side of a foreign key (only the referenced primary key is
indexed) -- Supabase's Performance Advisor flagged several OE-related
FKs with no covering index. Reviewed each candidate against actual
query/use patterns in this codebase; created only the ones with a real
read or referential-integrity benefit, per explicit instruction to
avoid pointless indexing.

## Reviewed and added

- `member_feedback.job_match_id` (nullable FK to `job_matches.id`,
  `ON DELETE CASCADE`) -- added by 20260914000000. Used by the new
  `insert_own_feedback` ownership check (EXISTS lookup is on
  `job_matches.id`, already PK-indexed) but a plain index on this
  column is still needed for: (a) efficient `ON DELETE CASCADE`
  processing when a `job_matches` row is deleted, and (b) any future
  "all feedback for this match" read. Partial (`WHERE job_match_id IS
  NOT NULL`) since this column is optional and most `member_feedback`
  rows predate/don't reference a raw match at all.

- `scraped_jobs.canonical_job_id` (nullable self-FK,
  `ON DELETE SET NULL`) -- added by 20260911000000. A
  `normalized_key` partial index already exists for the canonical-row
  lookup direction; this adds the reverse-lookup index ("find every
  duplicate of canonical job X") and speeds up the FK's own
  `ON DELETE SET NULL` action. Partial (`WHERE canonical_job_id IS NOT
  NULL`) for the same reason as above -- canonical (non-duplicate) rows
  are the majority and never populate this column.

- `job_matches.scraped_job_id` (`NOT NULL` FK, `ON DELETE CASCADE`) --
  present since the original 20260821000000 migration but never
  indexed on its own (existing indexes are `(member_id, ...)` composite
  and don't help a `scraped_job_id`-only lookup). Needed for efficient
  `ON DELETE CASCADE` when a `scraped_jobs` row is deleted, and for any
  "which members matched this posting" query.

- `job_matches.promoted_opportunity_id` (nullable FK,
  `ON DELETE SET NULL`) -- used directly by
  `selectDigestCandidates`'s `promoted_opportunity_id IS NULL` filter
  (src/lib/notifications/digestCandidates.ts) and by the strategist
  promote flow. Partial (`WHERE promoted_opportunity_id IS NOT NULL`)
  since the overwhelming majority of matches are never promoted --
  indexing only the promoted subset keeps the index small while still
  covering the FK's `ON DELETE SET NULL` action and any "which match
  led to this opportunity" reverse lookup.

## Deliberately NOT added
No index was added for anything outside this exact OE 2.0-scoped list
(e.g. `strategist_assignments` FKs, `opportunities` FKs) even though
the advisor may have also flagged those -- pre-existing tables, out of
scope for this task, listed separately in the final report as
technical debt.
*/

CREATE INDEX IF NOT EXISTS idx_member_feedback_job_match_id
  ON public.member_feedback(job_match_id)
  WHERE job_match_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_scraped_jobs_canonical_job_id
  ON public.scraped_jobs(canonical_job_id)
  WHERE canonical_job_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_job_matches_scraped_job_id
  ON public.job_matches(scraped_job_id);

CREATE INDEX IF NOT EXISTS idx_job_matches_promoted_opportunity_id
  ON public.job_matches(promoted_opportunity_id)
  WHERE promoted_opportunity_id IS NOT NULL;
