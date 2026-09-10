/*
# Opportunity Engine 2.0 Phase 1 -- scraped_jobs normalization/dedup columns

## STATUS: PREPARED FOR REVIEW. NOT APPLIED.
Per explicit instruction, this migration has NOT been run against any
database (production `bolt-native-database-69540068` or otherwise). It
is committed here so it can be reviewed, then applied deliberately as a
separate, explicit step -- not bundled into this Phase 1 code change.
`scripts/scrapeCompanies.ts`'s new `reportLikelyDuplicates()` step does
NOT depend on these columns existing yet (it only reads existing
columns and logs a dry-run report) -- current production behavior is
unaffected either way until this migration is deliberately applied.

## Overview
Adds two nullable, purely additive columns to the existing
`scraped_jobs` table (created in 20260821000000_opportunity_engine.sql)
to support OE 2.0 Phase 1 exact-match job deduplication
(`src/lib/opportunityEngine/jobDeduplication.ts`):

- `normalized_key` (text, nullable) -- the deterministic dedup key
  produced by `normalizeJobKey()` (title + company + city, lowercase,
  legal-suffix/punctuation-stripped). Not a new source of truth: always
  re-derivable from `title`/`company`/`location` on the same row: if
  the normalization logic ever changes, this column is a cache of that
  derivation, safely recomputable/backfillable, never authoritative on
  its own.
- `canonical_job_id` (uuid, nullable, self-referencing FK) -- NULL means
  "this row is the canonical listing members/strategists see." A
  non-null value points at the canonical row this one duplicates.
  Deliberately `ON DELETE SET NULL` (not CASCADE): deleting a canonical
  row must never cascade-delete what were its duplicates -- they simply
  become un-deduplicated (safe, reversible) rather than disappearing.

## No behavior change until wired in
No existing query reads either column yet. Both are additive/nullable,
so every existing row and every existing read/write path (scoring,
matching, member submission, admin/strategist views) is completely
unaffected by this migration on its own. The follow-up step (writing
real values into these columns and having
`scripts/syncFreshFitScores.ts` skip `canonical_job_id IS NOT NULL`
rows) is intentionally a separate, later change -- not bundled here.

## RLS
No RLS change. `scraped_jobs`'s existing policies (any authenticated
read, service-role-only write) already cover these two new columns --
Postgres/PostgREST column-level access follows the table's row-level
policies, not per-column policies, and neither new column carries any
new sensitivity (both are derived, non-PII scheduling/dedup metadata).
*/

ALTER TABLE public.scraped_jobs
  ADD COLUMN IF NOT EXISTS normalized_key text,
  ADD COLUMN IF NOT EXISTS canonical_job_id uuid REFERENCES public.scraped_jobs(id) ON DELETE SET NULL;

-- Partial index: only canonical rows (canonical_job_id IS NULL) need a
-- fast normalized_key lookup at insert time (jobDeduplication.ts's
-- findDuplicateCandidate compares a new job's key against the current
-- canonical set only, never against already-marked duplicates).
CREATE INDEX IF NOT EXISTS idx_scraped_jobs_normalized_key
  ON public.scraped_jobs(normalized_key)
  WHERE canonical_job_id IS NULL;
