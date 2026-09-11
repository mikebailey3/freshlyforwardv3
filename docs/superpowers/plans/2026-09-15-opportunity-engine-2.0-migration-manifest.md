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

**Finding:** `member_dismiss_own_job_matches` and
`strategist_promote_job_matches` (both `FOR UPDATE`) checked row
*ownership* only — never *which columns* changed. As currently live:
- A member could PATCH their own `job_matches` row via a direct API
  call and change `fresh_fit_score`, `matched_skills`, `score_breakdown`,
  or `promoted_opportunity_id` — not just `dismissed_at` (the only
  field the app's own `dismissJobMatch()` ever sends).
- An assigned strategist could likewise change any column on a match
  belonging to one of their members — not just `promoted_opportunity_id`.

Not a data leak (SELECT visibility is unchanged) — an integrity/
self-escalation gap: a member could inflate their own displayed score
or fabricate evidence shown to themselves; either actor could forge a
`promoted_opportunity_id`.

**Fix:** both policies' `WITH CHECK` now require every column other
than the one each actor is meant to touch to stay unchanged from the
current row, via a small `STABLE` (deliberately **not**
`SECURITY DEFINER` — see the migration's own comment on why that would
itself be a new IDOR through PostgREST's auto-RPC exposure) helper
function.

**Verified before writing this fix:** grepped `src/` — `dismissJobMatch()`
only ever sends `{ dismissed_at }`; the strategist promote path only
ever sends `{ promoted_opportunity_id }`. Zero functional impact on
existing behavior; only a direct, out-of-band API call touching any
other column would now be rejected.

**Risk:** the fix itself is low-risk (pure tightening, matches verified
current usage). The **decision of whether/when to apply it** is
higher-stakes purely because it touches a table that may already have
real traffic — recommend applying this one specifically in a
staging/non-prod environment first and confirming the two known write
paths (member dismiss, strategist promote) still work end-to-end
before promoting to production.

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
   staging first, verify dismiss + promote flows, then production.

## Not in this manifest

Phase 10 (Alerts & Digests) has no migration yet — it's blocked on an
explicit provider choice (Resend/SendGrid/etc.) before any code or
schema is written, per the plan's own gate.
