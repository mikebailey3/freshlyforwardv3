/*
# Opportunity Engine 2.0 Phase 10 -- match_digest_log

## STATUS: PREPARED FOR REVIEW. NOT APPLIED. Per explicit instruction,
NO migration in this batch (including this one) has been applied to
any database this session -- see
docs/superpowers/plans/2026-09-15-opportunity-engine-2.0-migration-manifest.md
for the full reviewed manifest.

## Overview
Records which `job_matches` rows have already been included in a
member's digest, so `src/lib/notifications/digestCandidates.ts`'s
duplicate suppression has something durable to check against run over
run. One row per digest actually sent (or, while running with the
`NoOpNotificationProvider`, per digest the pipeline *would* have sent --
see that provider's own docs on why it must never be pointed at real
member data on a real schedule for exactly this reason: it would create
real log rows for emails nobody received).

`match_ids` is a plain `uuid[]` rather than a join table
(`match_digest_log_items` with one row per match) -- YAGNI: nothing in
this plan needs to query "which digests included match X" in reverse,
only "which match ids has this member already been sent" per member,
which an array column answers directly. A normalized join table can
replace this later without touching any other table if that need ever
arises.

## No behavior change until applied
`scripts/sendDigests.ts` degrades safely without this table: the bulk
SELECT of prior log rows fails, is caught, logged, and treated as "no
prior digests for anyone" (which under `isDigestDue`'s own null-means-
always-due rule just means everyone is due, same posture as a brand
first run) -- and the INSERT after a successful send also fails/logs
without crashing the run, meaning duplicate suppression simply doesn't
persist across runs until this migration lands (a member could be sent
the same match twice) -- which is exactly why this script must not be
pointed at a real provider on a real schedule before this migration is
reviewed and applied.

## RLS
Member can SELECT their own log rows only (foundation for a possible
future "email history" UI -- not built yet, YAGNI, but the read policy
costs nothing to include now and avoids a second migration later for
something this low-risk). No authenticated INSERT/UPDATE/DELETE policy
at all -- only the service-role key (used by scripts/sendDigests.ts,
same pattern as every other OE 2.0 script) can write. No strategist
read policy -- a member's own alert/digest history is not currently
part of any strategist-facing surface, unlike job_matches/opportunities;
one can be added later as its own reviewed decision if that changes.
*/

CREATE TABLE IF NOT EXISTS public.match_digest_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sent_at timestamptz NOT NULL DEFAULT now(),
  match_ids uuid[] NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_match_digest_log_member ON public.match_digest_log(member_id, sent_at DESC);

ALTER TABLE public.match_digest_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_digest_log" ON public.match_digest_log;
CREATE POLICY "select_own_digest_log"
  ON public.match_digest_log FOR SELECT
  TO authenticated
  USING (auth.uid() = member_id);

-- No authenticated-user write policy at all -- only the service-role
-- key can insert, matching scraped_jobs/job_matches/market_intelligence_snapshots'
-- existing write-policy shape.
