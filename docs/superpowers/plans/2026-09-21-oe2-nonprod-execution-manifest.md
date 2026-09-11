# OE 2.0 Non-Prod Execution Manifest

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

## Round 1 results (migrations 1-11) -- COMPLETE

All 11 migrations applied to `szwfxfitrmvqbdvcbgrf`. Production
untouched. Advisor re-run clean for every OE-targeted finding. Live
testing: every assertion passed **except one** -- see "Validated
defect" below, now fixed forward-only by migration 12. Fixtures ran
transactionally and were rolled back; no leftover test users/data.

**Validated defect:** `admin_strategist_read_market_intelligence`'s
admin branch queried `auth.users` directly
(`auth.uid() IN (SELECT id FROM auth.users WHERE
raw_app_meta_data->>'role' = 'admin')`), which raised SQLSTATE 42501
(`permission denied for table users`) because `authenticated` has no
`SELECT` on `auth.users` in this project. **Not** fixed by granting
that access (would over-expose `auth.users`) -- fixed instead by
switching to the `auth.jwt()` `app_metadata` claim, which needs no
table access at all. Full reasoning in migration 12 and in the main
manifest doc's item 12.

---

## Round 2 -- Step 1: Apply the one new migration

```
1. 20260922000000_fix_market_intelligence_admin_jwt_claim.sql
```

This is the only unapplied migration remaining. It supersedes (via a
new forward migration, not an edit) only the `admin_strategist_read_
market_intelligence` policy body from migration 9; everything else
already applied in round 1 is untouched.

## Round 2 -- Step 2: Re-run Supabase's advisors against non-prod

Run both the **Security Advisor** and **Performance Advisor** again.
Expected outcome:

- The `market_intelligence_snapshots` admin-policy finding (if the
  advisor ever surfaced one) is gone.
- No new findings anywhere else -- this migration touches exactly one
  policy on one table.
- Every round-1 clean result still holds.

## Round 2 -- Step 3: Create the fixture

```
npm run fixtures:oe2-security -- --create
```

Requires `VITE_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, pointed
at `szwfxfitrmvqbdvcbgrf` -- the script refuses to run against anything
else. Copy the printed **run tag** for Step 4.

Creates: Member A, Member B, Strategist S (assigned to Member A only),
**Admin Q** (`app_metadata.role = 'admin'` -- new this round, needed to
automate the market-intelligence admin assertion), two scraped jobs,
one `job_matches` row each for A and B, one `opportunities` row for A,
one `match_digest_log` row each for A and B, and **one
`market_intelligence_snapshots` row** (new this round -- no
`member_id` column exists on that table at all, so this introduces no
member-data-exposure risk).

## Round 2 -- Step 4: Run the live security test suite

```
npm run test:oe2-security -- <run-tag-from-step-3>
```

Requires `VITE_SUPABASE_ANON_KEY` in addition to Step 3's env vars.
**Expected: every assertion below prints `PASS`.** Everything from
round 1 is included again (regression check) plus four new
`market_intelligence_snapshots` assertions.

### Expected security assertions (grouped)

**Cross-member isolation (run both A->B and B->A):**
- Actor cannot `SELECT` the other member's `job_match`
- Actor cannot `UPDATE` the other member's `job_match` row
- Actor cannot read the other member's `match_digest_log`
- Actor calling `get_job_match_snapshot()` for the other's match returns nothing

**Digest-log ownership:**
- Member A CAN read own digest log
- Member B CAN read own digest log

**`market_intelligence_snapshots` (NEW this round -- the validated-defect fix):**
- Admin CAN read `market_intelligence_snapshots`
- Active strategist CAN read `market_intelligence_snapshots`
- Ordinary member (Member A) cannot read `market_intelligence_snapshots`
- Anonymous cannot read `market_intelligence_snapshots` (both a
  wildcard select and a select filtered to the real seeded row's id)

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

If **any** assertion prints `FAIL`, stop and investigate before
proceeding to Step 5 -- do not clean up the fixture yet, it's needed to
reproduce the failure.

## Round 2 -- Step 5: Clean up

```
npm run fixtures:oe2-security -- --cleanup <run-tag-from-step-3>
```

Deletes the four fixture auth users (cascades their `job_matches`/
`strategist_assignments`/`opportunities`/`match_digest_log` rows), both
fixture `scraped_jobs` rows, and the fixture
`market_intelligence_snapshots` row. Never runs automatically -- must
be invoked deliberately.

## Only after this round also passes clean

Proceed to a **separate, explicitly authorized** production migration
review. This document does not authorize, and its author did not
perform, any production action.
