/*
# Opportunity Engine 2.0 Phase 7 -- market_intelligence_snapshots

## STATUS: PREPARED FOR REVIEW. NOT APPLIED.
Per explicit instruction, this migration has NOT been run against any
database (production or otherwise) from this session. It is committed
here, following the exact same "prepared, not applied" precedent as
20260911000000_scraped_jobs_dedup.sql, so it can be reviewed and then
applied deliberately as a separate, explicit step by whoever owns that
deploy action.

## Overview
A new, fully aggregate, anonymized table -- no member data of any kind.
Populated by `scripts/computeMarketIntelligence.ts`, which calls the
already-tested, pure `computeMarketIntelligenceSnapshots()`
(src/lib/opportunityEngine/marketIntelligence.ts) over `scraped_jobs`
and upserts the result here. One row per (role_bucket, location_bucket)
pair -- upserted (not appended) on every run, so `computed_at` reflects
each bucket's last-refreshed time and the table never grows unbounded.
The approved plan did not ask for historical trend retention, so this
keeps the simplest shape that satisfies today's "you keep missing X"
market-signal goal (YAGNI) -- a time-series variant can be added later
behind its own reviewed decision if a specific feature needs trend
lines, without having to migrate this table's existing rows.

## Privacy
No `member_id` column exists on this table at all -- by design, not by
omission. Every row is derived exclusively from public job-posting
fields already visible in `scraped_jobs` (title/location/salary_text/
description), never from Career Vault, Forward DNA, resume, or any
other member-scoped table. `role_bucket`/`location_bucket` are the
normalized title/location text already computed by Phase 1's
`normalizeJob()`; `top_skills` are already-public dictionary-matched
keywords pulled from public postings, not anything a member typed.

## RLS
Per the approved plan: admin/strategist-readable only, no member-facing
exposure in v1 (that would be a new, separately-reviewed decision).
There's no existing generic "is this user any kind of strategist"
role check to reuse (every current strategist RLS policy in this
schema is scoped through `strategist_assignments`'s per-member join,
which doesn't apply here since this table has no member_id to join on)
-- so "is a strategist" is expressed as "has ever been assigned at
least one member," reusing the existing `strategist_assignments` table
rather than inventing a new role column/convention. Admin check reuses
the exact `raw_app_meta_data->>'role' = 'admin'` convention already
established in 20260802172349_phase3_membership_system.sql. Writes are
service-role only (the compute script), matching `scraped_jobs`/
`job_matches`'s existing write policy shape -- no authenticated-user
write path at all.
*/

CREATE TABLE IF NOT EXISTS public.market_intelligence_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_bucket text NOT NULL,
  location_bucket text NOT NULL,
  sample_size integer NOT NULL,
  median_salary_min integer,
  median_salary_max integer,
  top_skills jsonb NOT NULL DEFAULT '[]'::jsonb,
  computed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role_bucket, location_bucket)
);

ALTER TABLE public.market_intelligence_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_strategist_read_market_intelligence" ON public.market_intelligence_snapshots;
CREATE POLICY "admin_strategist_read_market_intelligence"
  ON public.market_intelligence_snapshots FOR SELECT
  TO authenticated
  USING (
    auth.uid() IN (SELECT id FROM auth.users WHERE raw_app_meta_data->>'role' = 'admin')
    OR auth.uid() IN (SELECT strategist_id FROM public.strategist_assignments)
  );

-- No authenticated-user write policy at all -- only the service-role
-- key (used by scripts/computeMarketIntelligence.ts, same pattern as
-- syncFreshFitScores.ts writing job_matches) can insert/update/delete,
-- via Supabase's implicit service-role RLS bypass.
