/*
# Opportunity Engine 2.0 Phase 8 -- scraped_jobs stale/closed-role detection

## STATUS: PREPARED FOR REVIEW. NOT APPLIED.
Per explicit instruction, this migration has NOT been run against any
database (production or otherwise) from this session. It is committed
here, following the exact same "prepared, not applied" precedent as
20260911000000_scraped_jobs_dedup.sql and
20260912000000_market_intelligence_snapshots.sql, so it can be reviewed
and then applied deliberately as a separate, explicit step.

## Overview
Two nullable/defaulted additive columns supporting conservative
stale/closed-role detection (see scripts/jobSources/liveness.ts for the
pure, fully-tested logic; scripts/scrapeCompanies.ts::deactivateGoneJobs
for the caller):

- `last_seen_at` (timestamptz, nullable) -- bumped to now() only when a
  HEALTHY scrape run re-confirms a job is still present in its source
  feed. Deliberately a NEW, separate column rather than reusing the
  existing `scraped_at` -- `scraped_at` is bumped on every upsert and is
  also read by `ranking.ts` as a posting-freshness fallback signal; this
  new column keeps "is this job still alive in its source" completely
  separate from that existing freshness heuristic so neither can corrupt
  the other.
- `missed_run_count` (integer, NOT NULL DEFAULT 0) -- consecutive count
  of HEALTHY runs that did NOT see this job. Reset to 0 the instant the
  job is seen again. `is_active` only flips to false once this reaches
  `MAX_CONSECUTIVE_MISSES` (3, scripts/jobSources/liveness.ts) -- never
  on a single miss. Crucially, a run only increments this count at all
  when that run's fetch was itself judged healthy
  (`isHealthyFetchResult`) -- a genuine fetch error (thrown exception) or
  a suspiciously-empty/degraded result (a provider returning 200 OK with
  a truncated/empty body, a pagination bug, a temporary feed outage) is
  never trusted as evidence a job closed, so a real source outage can
  never mass-close valid, still-open roles.

## Backfill
Both columns default safely for every existing row: NULL `last_seen_at`
(no fabricated history -- "we don't know when this was last confirmed"
is the honest state for pre-existing rows) and 0 `missed_run_count`
(the safe assumption -- "not currently missing" -- until a real,
healthy run says otherwise).

## No behavior change until applied
`scrapeCompanies.ts::deactivateGoneJobs` already targets these columns.
Until this migration is applied, that step degrades safely: the SELECT
that reads `last_seen_at`/`missed_run_count` fails against the current,
unmigrated schema, is caught, logged, and the function returns without
touching any row -- the exact same defensive shape already used
throughout this script (see e.g. `deactivateStaleJobs`'s existing error
handling). Scraping, upserting, and FreshFit scoring are all completely
unaffected either way. The existing 45-day global staleness sweep
(`deactivateStaleJobs`, unchanged by this phase) remains the interim
backstop for genuinely abandoned postings until this migration lands.

## RLS
No RLS change. `scraped_jobs`'s existing policies (any authenticated
read, service-role-only write) already cover these two new columns --
neither carries any new sensitivity (both are derived scheduling
metadata about a public job posting, never member data).
*/

ALTER TABLE public.scraped_jobs
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS missed_run_count integer NOT NULL DEFAULT 0;
