# OE 2.0 Batch 2 -- Non-Prod Execution Manifest

**Purpose:** a precise, standalone checklist for a separate, controlled
execution step against the non-production Supabase project ("Freshly
Forward", `szwfxfitrmvqbdvcbgrf`) only. Nothing in this document has
been executed by the agent that wrote it -- no live Supabase
credentials exist in that sandbox. **Do not point any of this at
production (`bolt-native-database-69540068`).**

See `2026-09-15-opportunity-engine-2.0-migration-manifest.md` for full
reasoning behind every item below; this document is deliberately just
the checklist.

---

## Step 1 -- Apply the five migrations, in this exact order

```
1. 20260917000000_harden_get_job_match_snapshot.sql
2. 20260918000000_job_matches_column_security_and_rls_perf.sql
3. 20260919000000_oe_rls_performance_auth_uid.sql
4. 20260920000000_oe_fk_indexes.sql
5. 20260921000000_oe_table_grants_hardening.sql
```

(No hard ordering dependency exists between these five -- see the
manifest doc's "Ordering, idempotence, dependencies..." section -- but
apply in this order for a clean, matching audit trail against this
checklist.)

## Step 2 -- Re-run Supabase's advisors against non-prod

Run both the **Security Advisor** and **Performance Advisor** in the
Supabase dashboard for `szwfxfitrmvqbdvcbgrf`. Expected outcome:

- No new OE-related **security** errors.
- The `get_job_match_snapshot` mutable-search-path warning is gone.
- No OE table shows a missing-RLS warning.
- No OE table/function shows an overly-broad-grant warning.
- Performance warnings for the 5 OE-scoped `auth.uid()` policy objects
  (`job_matches`, `member_job_exclusion_rules`, `member_feedback`'s one
  OE policy, `market_intelligence_snapshots`, `match_digest_log`) are
  gone.
- Any **other** (non-OE) advisor warning may remain -- that is
  pre-existing technical debt, explicitly out of scope (see the
  manifest doc's "Pre-existing technical debt" list).

## Step 3 -- Create the fixture

```
npm run fixtures:oe2-security -- --create
```

Requires `VITE_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the
environment, pointed at `szwfxfitrmvqbdvcbgrf` -- the script refuses to
run against anything else. Copy the printed **run tag** for Step 4.

Creates: Member A, Member B, Strategist S (assigned to Member A only),
two scraped jobs, one `job_matches` row each for A and B, one
`opportunities` row for A, and one `match_digest_log` row each for A
and B.

## Step 4 -- Run the live security test suite

```
npm run test:oe2-security -- <run-tag-from-step-3>
```

Requires `VITE_SUPABASE_ANON_KEY` in addition to the Step 3 env vars.
**Expected: every assertion below prints `PASS`.**

### Expected security assertions (grouped)

**Cross-member isolation (run both A->B and B->A):**
- Actor cannot `SELECT` the other member's `job_match`
- Actor cannot `UPDATE` the other member's `job_match` row
- Actor cannot read the other member's `match_digest_log`
- Actor calling `get_job_match_snapshot()` for the other's match returns nothing

**Digest-log ownership:**
- Member A CAN read own digest log
- Member B CAN read own digest log

**Feedback ownership (`member_feedback.job_match_id`):**
- Member A CAN insert feedback with `job_match_id IS NULL`
- Member A CAN insert feedback referencing their own match
- Member A cannot insert feedback referencing Member B's match

**Exclusion-rule ownership (`member_job_exclusion_rules`):**
- Member A CAN insert their own exclusion rule
- Member A cannot insert a rule for Member B
- Member B cannot delete Member A's rule
- Member A CAN delete their own rule

**Member dismiss-only behavior (Member A against their own match):**
- CAN `SELECT` own match
- Cannot update: `fresh_fit_score`, `score_breakdown`, `matched_skills`,
  `missing_skills`, `computed_at`, `engine_version`, `member_id`,
  `scraped_job_id`, `promoted_opportunity_id` (no self-promote)
- Calling `get_job_match_snapshot()` for own match returns the row
- CAN dismiss own match (`dismissed_at` set)

**Strategist promote-only behavior (Strategist S against Member A's match):**
- CAN `SELECT` assigned Member A's match
- Cannot update: `fresh_fit_score`, `score_breakdown`, `matched_skills`,
  `missing_skills`, `computed_at`, `engine_version`, `member_id`,
  `scraped_job_id`
- CAN promote (sets `promoted_opportunity_id` to a real value)
- Cannot access or update Member B's match (not assigned)

**Anonymous denial:**
- Cannot read `job_matches`, `member_feedback`,
  `member_job_exclusion_rules`, `match_digest_log`,
  `market_intelligence_snapshots`
- Cannot call `get_job_match_snapshot()` RPC to expose any row

**Admin (not automated -- manual only):** the script prints a note
explaining that admin visibility must be checked by hand: promote a
throwaway non-prod user to `raw_app_meta_data.role = 'admin'`, sign in
as them, confirm they can read `market_intelligence_snapshots` and
nothing else beyond their own assignments.

If **any** assertion prints `FAIL`, stop and investigate before
proceeding to Step 5 -- do not clean up the fixture yet, it's needed to
reproduce the failure.

## Step 5 -- Clean up

```
npm run fixtures:oe2-security -- --cleanup <run-tag-from-step-3>
```

Deletes the three fixture auth users (cascades their `job_matches`/
`strategist_assignments`/`opportunities`/`match_digest_log` rows) and
both fixture `scraped_jobs` rows. Never runs automatically -- must be
invoked deliberately.

## Only after all five steps pass clean

Proceed to a **separate, explicitly authorized** production migration
review. This document does not authorize, and its author did not
perform, any production action.
