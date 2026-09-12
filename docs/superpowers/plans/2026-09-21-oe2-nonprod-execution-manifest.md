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

All 11 migrations applied. Advisor re-run clean for every OE-targeted
finding. Live testing found one validated defect (`market_intelligence_
snapshots`' admin check queried `auth.users` directly -- `authenticated`
has no `SELECT` there), fixed by migration 12.

## Round 2 results (migration 12) -- COMPLETE

Migration 12 applied. Functionally green: the SQLSTATE 42501 defect is
fixed, and every live RLS/security assertion passed, including all
four new `market_intelligence_snapshots` admin/strategist/member/anon
checks. One `auth_rls_initplan` Performance Advisor finding remained on
this same policy -- a pure syntax issue (the InitPlan wrapping shape),
not a behavior defect -- fixed by migration 13.

---

## Round 3 -- Step 1: Apply the one new migration

```
1. 20260923000000_fix_market_intelligence_admin_jwt_initplan_lint.sql
```

This is the only unapplied migration remaining. Pure re-parenthesization
of the admin branch's JWT-claim expression -- no behavior change.
Policy before (migration 12, currently live): `(select auth.jwt() ->
'app_metadata' ->> 'role') = 'admin'`. Policy after (this migration):
`((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'`.

## Round 3 -- Step 2: Re-run Supabase's Performance Advisor

Expected outcome:

- The `auth_rls_initplan` finding on `admin_strategist_read_market_
  intelligence` is gone.
- No new findings anywhere -- this migration touches exactly one
  policy's parenthesization, nothing else.
- Every prior clean/green result still holds.

## Round 3 -- Step 3: Create the fixture

```
npm run fixtures:oe2-security -- --create
```

Requires `VITE_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, pointed
at `szwfxfitrmvqbdvcbgrf`. Copy the printed **run tag** for Step 4.
Fixture set is unchanged from round 2 (Member A, Member B, Strategist
S, Admin Q, two scraped jobs, matches, opportunity, digest-log rows,
one market-intelligence row).

## Round 3 -- Step 4: Run the live security test suite

```
npm run test:oe2-security -- <run-tag-from-step-3>
```

**This is a pure regression check** -- since migration 13 changes no
behavior, every assertion that passed in round 2 (including all four
`market_intelligence_snapshots` checks) is expected to pass again,
identically. No new assertions were added for this round.

If **any** assertion prints `FAIL`, stop and investigate before
proceeding to Step 5 -- a behavior change here would mean the
re-parenthesization was not actually behavior-neutral, which would be
unexpected and worth flagging immediately.

## Round 3 -- Step 5: Clean up

```
npm run fixtures:oe2-security -- --cleanup <run-tag-from-step-3>
```

## Only after this round also passes clean

Proceed to a **separate, explicitly authorized** production migration
review. This document does not authorize, and its author did not
perform, any production action.
