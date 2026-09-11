# Opportunity Engine 2.0 — Migration Manifest & Review Doc

**Status as of this document: nothing below has been applied to any
database (production, staging, or otherwise). Every migration listed
here is committed to `opportunity-engine-2-phase0` only. `origin/main`
has not been touched by this project at any point.**

This is a plain summary for review — no code changes, no database
changes. Apply order matches the order listed (each depends only on
tables that already exist before it).

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
