# Opportunity Engine 2.0 — Migration Manifest & Review Doc

**Status as of this update:** migrations 1–6 below have been applied
to the **non-production** Supabase project ("Freshly Forward",
`szwfxfitrmvqbdvcbgrf`), per external validation. **Production
(`bolt-native-database-69540068`) has NOT been touched and is not
touched by anything in this document.** A second batch of
non-prod-hardening migrations (7–11, added after Supabase's Security
and Performance Advisors ran against non-prod) is documented at the
bottom of this file, also prepared-only / not yet applied anywhere.
Every migration in both batches is committed to
`opportunity-engine-2-phase0` only. `origin/main` has not been touched
by this project at any point.

This is a plain summary for review — no application code changes
accompany any of these; only new forward SQL migrations, tests, and
two non-prod-only tooling scripts. Apply order matches the order
listed (each depends only on objects that already exist before it).

---

## 1. `20260911000000_scraped_jobs_dedup.sql` — Phase 1 (Dedup)

**Adds:** two nullable columns on the existing `scraped_jobs` table.
- `normalized_key` (text) — cached dedup key, always re-derivable from
  title/company/location.
- `canonical_job_id` (uuid, self-referencing FK, `ON DELETE SET NULL`)
  — null means "this row is canonical"; non-null points at the
  canonical duplicate.

**RLS change:** none. Existing `scraped_jobs` policies (authenticated
read-all, service-role-only write) already cover new columns.

**Risk:** low. Purely additive/nullable, no existing query reads either
column yet.

---

## 2. `20260912000000_market_intelligence_snapshots.sql` — Phase 7 (Market Intelligence)

**Adds:** new table `market_intelligence_snapshots` — fully anonymized,
aggregate role/location salary + top-skills buckets, no `member_id`
column at all. One row per `(role_bucket, location_bucket)`, upserted.

**RLS:** admin (via `raw_app_meta_data->>'role'='admin'`) or any
currently-active strategist (`strategist_assignments.is_active=true`)
can SELECT. No authenticated-user write policy — service-role only.

**Hardened during the Final Security Gate:** the strategist check
originally didn't filter `is_active=true`, so a fully deactivated
strategist would have kept indefinite read access. Fixed in place
before this migration was ever applied.

**Outstanding note for whoever builds a consumer UI on this table:**
`sample_size` exists specifically so a future admin/strategist view can
suppress or flag buckets below a minimum count (e.g. <5) — small-sample
salary medians risk re-identifying a specific real posting. No UI reads
this table yet, so this is dormant, not urgent, but must not be skipped
when one is built.

**Risk:** low. No member data, read-only consumers only, write is
service-role only.

---

## 3. `20260913000000_scraped_jobs_stale_detection.sql` — Phase 8 (Stale Detection)

**Adds:** two columns on `scraped_jobs`.
- `last_seen_at` (timestamptz, nullable) — bumped only on a healthy
  scrape run that re-confirms a job is still listed.
- `missed_run_count` (integer, default 0) — consecutive healthy-run
  misses; only crosses to `is_active=false` at 3.

**RLS change:** none needed — same reasoning as #1.

**Risk:** low. Degrades safely pre-apply (the read that depends on
these columns fails, is caught, logged, no-ops — the old 45-day
staleness sweep remains the backstop).

---

## 4. `20260914000000_member_feedback_and_exclusion_rules.sql` — Phase 9 (Feedback & Exclusion)

**Adds:**
- New table `member_job_exclusion_rules` (member_id, rule_type IN
  ('company','title_keyword','industry'), value; unique per
  member+type+value). RLS: member owns their own rows (select/insert/
  delete — deliberately **no** UPDATE policy, rules are added/removed
  whole, never edited in place); active-assigned strategists read-only.
- New nullable column `member_feedback.job_match_id` (FK to
  `job_matches`, `ON DELETE CASCADE`) — lets a member's dismissal
  reason reference a raw (not-yet-promoted) match, reusing the
  existing Phase 4 `member_feedback` table instead of a new one.

**Hardened during the Final Security Gate:** the original
`insert_own_feedback` policy on `member_feedback` (from the older,
separately-applied Phase 4 migration) only checked
`auth.uid()=member_id` — it never verified an optional `job_match_id`
actually belongs to a `job_matches` row owned by that same member. No
data leak (SELECT stays scoped by member/strategist), but a real
cross-member reference/integrity gap. This migration now re-creates
`insert_own_feedback` with an added ownership `EXISTS` check.

**Risk:** low-medium. New table follows the schema's standard
ownership pattern exactly. The feedback-policy re-creation touches an
existing table's policy, but only tightens it — narrower is always
backward compatible for legitimate writes (verified: application code
never sends a mismatched `job_match_id`).

---

## 5. `20260915000000_harden_job_matches_update_policies.sql` — Final Security Gate

**Highest-priority item in this manifest — please review first.**

Unlike everything else above, this modifies policies on `job_matches`,
a table created in `20260821000000_opportunity_engine.sql` — **long
before** this project's "prepared, not applied" convention began. That
earlier migration was very likely already applied to your real schema
in an earlier session. This environment has no live database
connection, so that could not be verified here.

### Exact risk

`member_dismiss_own_job_matches` and `strategist_promote_job_matches`
(both `FOR UPDATE`) check row **ownership** only — Postgres RLS is
row-level, not column-level, so neither policy restricts *which
columns* an authorized update may change. As currently live:

| Actor | Intended to touch | Can actually touch (as written) |
|---|---|---|
| Member | `dismissed_at` only | Any column, including `fresh_fit_score`, `matched_skills`, `missing_skills`, `score_breakdown`, `promoted_opportunity_id` |
| Strategist | `promoted_opportunity_id` only | Any column, including `fresh_fit_score`, `matched_skills`, `missing_skills`, `score_breakdown`, `dismissed_at` |

**Severity: integrity / self-escalation, not a data leak.** The SELECT
policy is unaffected and unchanged — nobody gains visibility into rows
they couldn't already see. The exposure is that a member could inflate
their own displayed `fresh_fit_score`, fabricate `score_breakdown`
evidence shown to themselves, or forge a `promoted_opportunity_id`
(effectively self-promoting a match without strategist involvement); a
strategist could similarly alter a match's score/evidence outside the
normal scoring pipeline, or clear another actor's dismissal. Exploiting
this requires a direct, out-of-band API call (e.g. a hand-crafted
PostgREST PATCH) — no UI path in this app currently sends any column
other than the intended one (verified by grep across `src/` before
writing the fix below: `dismissJobMatch()` only ever sends
`{ dismissed_at }`; the strategist promote action only ever sends
`{ promoted_opportunity_id }`).

### Proposed SQL

Full file already committed and ready for review at
`supabase/migrations/20260915000000_harden_job_matches_update_policies.sql`.
Summary of what it does:

1. Adds a `STABLE` (deliberately **not** `SECURITY DEFINER`) helper
   `public.get_job_match_snapshot(match_id uuid) RETURNS public.job_matches`
   that fetches the current stored row once per policy evaluation, so
   the check reads as a column comparison rather than repeated inline
   subqueries.
   - **Why not `SECURITY DEFINER`:** PostgREST auto-exposes every
     `public`-schema function an authenticated role can execute as a
     directly callable RPC endpoint. A `SECURITY DEFINER` version would
     bypass RLS entirely and become a *new, worse* IDOR — any
     authenticated user could call it directly to read any match's
     full row. Running as invoker means the helper's SELECT is subject
     to the same RLS the policy itself already relies on, so it adds no
     new exposure whether called from within the policy or directly.
2. Recreates `member_dismiss_own_job_matches`'s `WITH CHECK` to require
   `auth.uid() = member_id` (unchanged) **and** every column other than
   `dismissed_at` to equal the snapshot's value.
3. Recreates `strategist_promote_job_matches`'s `WITH CHECK` to require
   the existing active-assignment check (unchanged) **and** every
   column other than `promoted_opportunity_id` to equal the snapshot's
   value.

### Rollback considerations

- **To roll back:** re-run the original (unrestricted) `CREATE POLICY`
  statements from `20260821000000_opportunity_engine.sql` for both
  `member_dismiss_own_job_matches` and `strategist_promote_job_matches`
  (`DROP POLICY IF EXISTS` + recreate without the added `WITH CHECK`
  column comparisons), then optionally `DROP FUNCTION
  public.get_job_match_snapshot(uuid);` if nothing else has come to
  depend on it.
- **Rollback risk is low:** this migration only replaces two policies
  and adds one pure helper function — no column, table, or data change
  of any kind, so rolling back cannot lose or corrupt data.
- **Forward-compatibility risk if you *don't* roll back but later add a
  legitimate new use case** (e.g. a future feature that legitimately
  needs a member or strategist to update a different column via a
  direct UPDATE): that new column must be explicitly added to the
  relevant policy's allow-list in a follow-up migration, or it will be
  silently rejected. This is the correct default (deny-by-default is
  safer than allow-by-default) but is a real thing to remember before
  building anything that updates `job_matches` outside the two existing
  paths.

### Validation steps (before promoting beyond staging)

1. Apply to a staging/non-prod database first — never production first.
2. As a real member account, dismiss a match through the normal UI
   flow; confirm it still succeeds and `dismissed_at` updates.
3. As a real strategist account, promote a match through the normal UI
   flow; confirm it still succeeds and `promoted_opportunity_id`
   updates.
4. Attempt a direct PATCH (e.g. via `curl` with a member's JWT) to
   `job_matches` changing `fresh_fit_score` on a row that member owns;
   confirm it is now rejected (`42501`/RLS violation) where it
   previously would have silently succeeded.
5. Repeat step 4 for a strategist attempting to change a column other
   than `promoted_opportunity_id` on an assigned member's match.
6. Run the full test suite once more against staging-equivalent mocks
   (already green locally: see bottom of this document) and confirm no
   regression in `opportunityEngine.test.ts`'s dismiss/promote coverage.
7. Only after 2–6 pass, apply to production.

---

## 6. `20260916000000_match_digest_log.sql` — Phase 10 (Alerts & Digests)

**Adds:** new table `match_digest_log` (`member_id`, `sent_at`,
`match_ids uuid[]`) — one row per digest actually sent, recording which
matches it contained so `src/lib/notifications/digestCandidates.ts` can
suppress sending the same match twice across runs.

**RLS:** member can SELECT their own rows only (foundation for a
possible future "email history" UI — not built, YAGNI, but costs
nothing to include now). No authenticated write policy at all —
service-role only (`scripts/sendDigests.ts`), matching every other OE
2.0 write-side table in this manifest.

**Risk:** low. No member-facing write surface, no cross-member
references, straightforward append-only log semantics.

**Important operational note:** this table's *presence* alone does not
mean real emails will go out. `scripts/sendDigests.ts` currently uses
`NoOpNotificationProvider` (logs instead of sending) because **no
email provider has been chosen, purchased, or configured** — that
remains a separate, explicitly deferred decision. Applying this
migration only unlocks durable duplicate-suppression for when a real
provider is eventually wired in; it does not, by itself, cause any
email to be sent to any member.

---

## Post-hoc audit: match_digest_log against the Final Gate's own checklist

The original Final Security Gate review (which produced item 5 above)
ran before `match_digest_log` existed, but its own checklist explicitly
named that table as something to verify once built ("New tables' RLS
... verify no anon access, correct strategist-assignment scoping, no
IDOR on member-owned rows" and "Digest email ... verify the digest
can't leak one member's match data to another"). Closing that loop now
that the table exists:

- **No anon access:** RLS is enabled and the only policy
  (`select_own_digest_log`) is scoped `TO authenticated`. No `anon`
  policy exists on this table at all.
- **Strategist-assignment scoping:** N/A by design — no strategist read
  policy was added. A member's own digest-send history isn't currently
  part of any strategist-facing surface (unlike `job_matches`/
  `opportunities`), so there is nothing to scope; adding strategist
  visibility later would be its own reviewed decision, not an oversight
  here.
- **No IDOR on member-owned rows:** the sole policy requires
  `auth.uid() = member_id`; there is no authenticated INSERT/UPDATE/
  DELETE policy at all (service-role only), so no write-side IDOR
  surface exists either.
- **No cross-member leakage in the digest pipeline itself:**
  `scripts/sendDigests.ts` groups `job_matches` and `match_digest_log`
  rows by `member_id` before ever calling `planWeeklyDigest`, so each
  member's plan is built exclusively from that same member's own
  matches and own prior log entries — there is no code path where one
  member's data can end up in another member's payload.

**Result: passes.** No new follow-up migration needed for this table.

---

# Batch 2 -- Post-Non-Prod-Validation Hardening (migrations 7-11)

Triggered by Supabase's Security and Performance Advisors running
against the non-prod project after migrations 1-6 above were applied
there. All five migrations below are **prepared only -- not applied to
any database, including non-prod.** Each file's own header comment has
the full reasoning; this section is a summary index.

## 7. `20260917000000_harden_get_job_match_snapshot.sql`

Fixes the Security Advisor's mutable-search-path finding on
`public.get_job_match_snapshot()`: `ALTER FUNCTION ... SET search_path
= ''` (metadata-only, no redefinition, no policy changes needed --
the function already fully-qualified its one table reference). Stays
`SECURITY INVOKER` (never converted to `DEFINER`).

Also addresses RPC exposure: revokes `EXECUTE` from `PUBLIC` and `anon`
(neither has any legitimate reason to call this helper, and `anon`
never satisfies either policy that uses it). `authenticated` **must**
keep `EXECUTE` -- verified by reasoning through Postgres's privilege
model that RLS policies are evaluated as the querying role, so revoking
it would break dismiss/promote for every real user. The residual risk
of `authenticated` being able to call this RPC directly is provably
bounded: the function is `SECURITY INVOKER` + `STABLE`, so calling it
directly returns exactly what the existing `select_own_job_matches` RLS
policy would already allow via a normal table read -- zero new
exposure. Full reasoning, including why `SECURITY DEFINER` was
considered and rejected, is in the migration file.

**Risk: low.** No behavior change for any real application code path.

## 8. `20260918000000_job_matches_column_security_and_rls_perf.sql`

Two things bundled because both touch the same two policies:

1. **Closes a gap found during this review's own re-audit:**
   `computed_at` was missing from both hardened policies' "everything
   else must stay unchanged" column list (migration 5 in Batch 1).
   Re-checked the *complete* current column set (including
   `engine_version`, added by a separate later migration) and confirmed
   this was the only gap -- every other nullable column
   (`dismissed_at`, `promoted_opportunity_id`) already used
   `IS NOT DISTINCT FROM` correctly; no other column is nullable.
2. **RLS performance pass** for all three `job_matches` policies
   (`select_own_job_matches`, `member_dismiss_own_job_matches`,
   `strategist_promote_job_matches`): every `auth.uid()` call rewritten
   to `(select auth.uid())` per Supabase's Performance Advisor and its
   own documented fix. Pure performance change -- `auth.uid()` is
   `STABLE`, so the rewritten expression is logically identical for
   every input.

**Risk: low-medium.** This is the third generation of these two
UPDATE policies and, like the first hardening pass, touches a table
that may carry real (non-prod) data by the time this is reviewed --
same staging-first recommendation applies as migration 5.

## 9. `20260919000000_oe_rls_performance_auth_uid.sql`

Same `auth.uid()` -> `(select auth.uid())` performance rewrite, scoped
to the four remaining OE-related policy objects:
`member_job_exclusion_rules` (all three policies),
`member_feedback.insert_own_feedback` (the one OE-touched policy on
that pre-existing table), `market_intelligence_snapshots`, and
`match_digest_log`. Explicitly NOT a repo-wide RLS refactor -- every
other policy in the schema is untouched.

**Risk: low.** Pure performance change, no authorization behavior
difference.

## 10. `20260920000000_oe_fk_indexes.sql`

Adds four covering indexes for FK columns the Performance Advisor
flagged, reviewed individually rather than added blindly:
`member_feedback.job_match_id`, `scraped_jobs.canonical_job_id`,
`job_matches.scraped_job_id`, `job_matches.promoted_opportunity_id`.
The latter two are partial indexes (`WHERE ... IS NOT NULL`) since both
are majority-null in normal operation. No index was added for any
non-OE-scoped FK the advisor may have also flagged.

**Risk: low.** Additive, non-blocking (`CREATE INDEX IF NOT EXISTS`,
no `CONCURRENTLY` needed given non-prod's current 0-row tables --
**note for whoever applies this to a table with real data later:**
consider `CREATE INDEX CONCURRENTLY` instead to avoid a write lock on a
populated table).

## 11. `20260921000000_oe_table_grants_hardening.sql`

Explicit `REVOKE ALL` + minimal `GRANT` (not relying on RLS alone, per
explicit instruction) for the three tables OE 2.0 introduced:
`market_intelligence_snapshots` (authenticated: `SELECT` only),
`member_job_exclusion_rules` (authenticated: `SELECT`/`INSERT`/`DELETE`,
no `UPDATE`), `match_digest_log` (authenticated: `SELECT` only). `anon`
gets nothing on any of the three. `service_role` is deliberately never
touched -- every OE 2.0 write-side script depends on its existing
full-access pattern.

**Risk: low.** Written as unconditional revoke-then-grant so the
result is correct regardless of this project's exact starting
default-privilege configuration; a `REVOKE` of a privilege that was
never granted is a safe no-op in Postgres.

## Reviewed with no new migration needed

- **`job_matches` self-promotion / multi-policy interaction:** verified
  Postgres's multi-permissive-policy OR semantics -- if a user somehow
  satisfied *both* `member_dismiss_own_job_matches` and
  `strategist_promote_job_matches`'s `USING` clauses simultaneously
  (only possible if `strategist_assignments` ever let someone be their
  own assigned strategist, a pre-existing Phase 3 membership-system
  question entirely outside OE 2.0's schema), attempting to change both
  `dismissed_at` and `promoted_opportunity_id` in the same statement
  would still fail both policies' `WITH CHECK` and be rejected. No OE
  2.0 loophole exists here; flagged as a pre-existing-system observation
  only, not fixed (out of scope, per instruction not to touch
  `strategist_assignments`).
- **Stale-detection schema (`last_seen_at`/`missed_run_count`):**
  re-confirmed nullable/`DEFAULT 0` respectively, no trigger of any
  kind exists on `scraped_jobs` -- the conservative 3-miss logic lives
  entirely in `scripts/jobSources/liveness.ts` application code, never
  the database. No migration needed.
- **Dedup schema (`normalized_key`/`canonical_job_id`):** re-confirmed
  `canonical_job_id`'s FK is `ON DELETE SET NULL`, never `CASCADE` --
  deleting a canonical job cannot cascade-delete its duplicates. The
  missing reverse-lookup index was added in migration 10 above.
- **RLS enabled + role/metadata hygiene across every OE table
  (`scraped_jobs`, `job_matches`, `market_intelligence_snapshots`,
  `member_job_exclusion_rules`, `match_digest_log`):** all five have
  `ENABLE ROW LEVEL SECURITY`; every policy targets `TO authenticated`
  explicitly (no bare/PUBLIC policies); no OE 2.0 policy uses
  `auth.role()` (a legacy pattern that does exist elsewhere in this
  repo, pre-dating OE 2.0 -- see "pre-existing technical debt" below);
  admin checks use `raw_app_meta_data` exclusively, never the
  user-editable `raw_user_meta_data`.

## Pre-existing technical debt (NOT touched by this task, listed per instruction)

- `auth.role()` usage in `20260902021400_harden_rls_and_security_definer_access.sql`
  and `20260902040000_protect_member_profiles_privileged_fields.sql`
  (member_profiles hardening, predates OE 2.0).
- Any `SECURITY DEFINER` view/RPC elsewhere in the schema (e.g. a
  `public_forward_profiles`-style view, if one exists) -- not reviewed
  here, outside OE 2.0's scope, and OE 2.0 has no dependency on it.
- Any repo-wide `auth.uid()` performance pattern outside the five OE
  2.0 objects in migrations 8-9 above.
- Any historically-unindexed FK outside the four OE 2.0 columns in
  migration 10.

## Non-prod security test tooling (new, not executed in this session)

- `scripts/createOe2SecurityFixtures.ts` (`npm run fixtures:oe2-security
  -- --create` / `-- --cleanup <tag>`) -- creates/tears down Member A,
  Member B, Strategist S (assigned to A only), one scraped job, one
  match each for A and B, and one opportunity for A. Hard-refuses to
  run against anything but the known non-prod project ref. Never
  auto-cleans up.
- `scripts/runOe2SecurityTests.ts` (`npm run test:oe2-security --
  <tag>`) -- signs in as each fixture actor for real and runs the exact
  scenarios in the Final Report's "Security Tests" section as live
  queries against a real database, since RLS cannot be meaningfully
  unit-tested with a mocked client.

**Neither script was executed in this session** -- this sandbox has no
live Supabase credentials for `szwfxfitrmvqbdvcbgrf`. They are ready to
run by whoever has that access; see the Final Report for exactly what
that run would validate.

## Updated suggested apply order (both batches)

1-6. Unchanged from Batch 1 above (already applied to non-prod).
7. `20260917000000_harden_get_job_match_snapshot.sql`
8. `20260918000000_job_matches_column_security_and_rls_perf.sql`
9. `20260919000000_oe_rls_performance_auth_uid.sql`
10. `20260920000000_oe_fk_indexes.sql`
11. `20260921000000_oe_table_grants_hardening.sql`

Recommended non-prod validation loop before any production
consideration: apply 7-11 to non-prod -> re-run Supabase's Security +
Performance Advisors there -> run
`fixtures:oe2-security -- --create` -> `test:oe2-security -- <tag>` ->
`fixtures:oe2-security -- --cleanup <tag>`.

## Also reviewed, no action needed

- **`skill_transferability_map`** — mentioned in the OE 2.0 plan's own
  security checklist as a thing to check "if built." Confirmed via
  `grep` that it was never actually built in any phase (zero references
  outside the plan document itself). Checklist item not applicable.
- **`member_job_exclusion_rules`** has no UPDATE policy at all, so the
  same "any column can change" bug class from #5 above structurally
  cannot occur there.
- A related functional bug (not a security issue) was caught and fixed
  in the same pass: `addExclusionRule()`'s upsert lacked
  `ignoreDuplicates: true`, so re-adding an existing rule would have
  hit Postgres' `ON CONFLICT DO UPDATE` path — which requires UPDATE
  privilege that table deliberately doesn't grant. Fixed to
  `ON CONFLICT DO NOTHING` (`ignoreDuplicates: true`), which needs no
  UPDATE grant and matches the intended "re-adding is a safe no-op"
  behavior.

---

## Suggested apply order

1. `20260911000000_scraped_jobs_dedup.sql`
2. `20260912000000_market_intelligence_snapshots.sql`
3. `20260913000000_scraped_jobs_stale_detection.sql`
4. `20260914000000_member_feedback_and_exclusion_rules.sql`
5. `20260915000000_harden_job_matches_update_policies.sql` — apply to
   staging first, verify dismiss + promote flows (see validation steps
   above), then production.
6. `20260916000000_match_digest_log.sql` — safe any time; unlocks
   durable duplicate-suppression for Phase 10 but sends no email by
   itself.

## Phase 10 status (Alerts & Digests)

The provider-neutral architecture is now built and tested —
eligibility, digest candidate selection/duplicate-suppression, payload
construction, and scheduling all live under `src/lib/notifications/`,
composed by `scripts/sendDigests.ts` (`npm run send:digests`). It
reuses the **existing** `communication_preferences` table
(`email_notifications` / `weekly_digest` / `immediate_alerts`) for
preferences — no new preference schema was needed.

**Still explicitly deferred, per your instruction:** no email provider
(Resend, SendGrid, or otherwise) has been selected, purchased, or
configured. `scripts/sendDigests.ts` runs today against
`NoOpNotificationProvider`, which logs what it would send and never
makes a network call — this validates the entire pipeline end-to-end
without any provider account existing. Swapping in a real provider
later is a single line in that script (see its own header comment) and
requires no changes anywhere else in `src/lib/notifications/`.

No new GitHub Actions scheduled workflow has been added either —
scheduling *cadence* per member is already enforced in code
(`isDigestDue`), so a workflow is only useful once there's a real
provider to actually deliver something; adding one now would just be a
cron job that logs to CI output on a timer, which is not worth the
repo-secret/scheduling review overhead until provider selection
happens.
