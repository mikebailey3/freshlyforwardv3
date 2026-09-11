/*
# OE 2.0 Hardening -- explicit table-level grants (defense in depth, not RLS-only)

## STATUS: PREPARED FOR REVIEW. NOT APPLIED TO PRODUCTION.
Forward migration only, scoped to the three tables OE 2.0 introduced:
`market_intelligence_snapshots`, `member_job_exclusion_rules`,
`match_digest_log`. No other table is touched.

## Why this is needed even though RLS already restricts row access
Supabase projects configure `ALTER DEFAULT PRIVILEGES` on the `public`
schema so that newly created tables automatically receive broad
grants (historically `SELECT`/`INSERT`/`UPDATE`/`DELETE`) for `anon`,
`authenticated`, and `service_role` -- relying on RLS, not the GRANT
system, to do the real access control. When RLS is enabled and a given
command (say, `UPDATE`) has zero matching policies for a role, Postgres
already denies that command outright for that role regardless of the
table-level GRANT -- so today's actual behavior is already correct.
This migration does not change any functional behavior; it removes
reliance on "RLS's default-deny for un-policied commands" as the ONLY
layer, per explicit instruction not to rely on RLS alone. If a future
change ever adds a stray permissive policy, or RLS is ever accidentally
disabled on one of these tables, the underlying GRANT is the second,
independent layer that still blocks the unintended command.

This migration is written as an unconditional `REVOKE ALL` followed by
an explicit minimal `GRANT`, rather than a partial `REVOKE` of assumed
extra privileges -- so the end state is correct and idempotent
regardless of exactly what this specific non-prod project's current
default-privilege configuration happens to be (safe to re-run; a
`REVOKE` of a privilege that was never granted is a no-op in Postgres,
not an error).

`service_role` is deliberately never touched here -- every OE 2.0
write-side script (`computeMarketIntelligence.ts`, `sendDigests.ts`,
the exclusion-rules client calls) depends on Supabase's existing
service-role bypass/full-access pattern already used by every other OE
2.0 table (`scraped_jobs`, `job_matches`); changing that is outside
this migration's minimal, table-grant-only scope.

## Resulting privileges

| Table | anon | authenticated | service_role |
|---|---|---|---|
| `market_intelligence_snapshots` | none | `SELECT` only (bounded further by RLS to admin/active-strategist rows) | unchanged (full, for the compute script) |
| `member_job_exclusion_rules` | none | `SELECT`, `INSERT`, `DELETE` (no `UPDATE` -- matches the table having no UPDATE policy at all; re-adding a rule is an insert-or-ignore, never an edit) | unchanged (full) |
| `match_digest_log` | none | `SELECT` only (bounded further by RLS to the caller's own `member_id`) | unchanged (full, for `scripts/sendDigests.ts`) |
*/

REVOKE ALL ON public.market_intelligence_snapshots FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.market_intelligence_snapshots TO authenticated;

REVOKE ALL ON public.member_job_exclusion_rules FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.member_job_exclusion_rules TO authenticated;

REVOKE ALL ON public.match_digest_log FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.match_digest_log TO authenticated;
