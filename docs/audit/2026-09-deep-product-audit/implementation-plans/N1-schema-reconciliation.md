# Implementation Plan — N1: Schema Reconciliation & Migration-State Verification

**Status:** PLANNED — not started. **Owner:** ChatGPT (Supabase/Database Lead) — exclusively, per
charter rule 9. **Collaborators:** John Carter (architecture review of results), Ethan Cole
(security confirmation), Nina Patel (test strategy for closing the gap going forward), Olivia Grant
(manifest verification).

**This plan does not authorize anyone to apply, alter, or execute any migration.** It is a
verification runbook only. Every step below is read-only.

## 1. Why this exists

`07-migration-reconciliation.md` established that **0 of 46 migrations** in `supabase/migrations/`
can be confirmed as production-applied from repo evidence alone, and that **46 of 46** need live
verification. Roughly half the migration files carry an explicit `NOT APPLIED` / `REVIEW-ONLY DRAFT`
header; the other half have no such header — but per the owner's explicit instruction, **absence of
a "not applied" comment is not proof of application either.** Comments and doc claims in either
direction are repo *intent*, not verified live state. This plan exists to close that gap safely.

## 2. Hard rules (non-negotiable, carried from the owner's instructions)

1. Do **not** apply, run, reorder, or edit any migration file as part of this work.
2. Do **not** infer live state from migration-file comments or docs alone — verify against the
   actual database.
3. Explicitly separate, in the output, "migration exists in the repo" from "verified as applied to
   the live database." These are different facts and must never be merged into one status.
4. No production write of any kind. No `supabase db push`. No `supabase migration up`. No manual
   `ALTER`/`CREATE` statements against production.
5. If ANY verification step reveals evidence of database corruption, unauthorized modification, or
   an irreversible condition, STOP immediately and escalate to the owner — do not attempt a fix as
   part of this task.

## 3. Safe, read-only verification runbook

All of these are read operations. None of them apply a migration.

### Step 1 — Compare local migration history against the remote tracking table
```
supabase migration list --linked
```
This is the Supabase CLI's own read-only comparison between `supabase/migrations/*.sql` and the
`supabase_migrations.schema_migrations` table on the linked project. It reports each migration as
applied-locally / applied-remotely / neither — a direct, authoritative, non-inferred answer. Run
this against the **production** project ref, not a non-production/staging project, since the OE
execution manifests already establish non-prod state for migrations 1–12 and that is not being
treated as production evidence.

### Step 2 — Direct read query as a fallback/cross-check
If CLI access to the linked project is unavailable, the same fact can be read directly:
```sql
SELECT version, name, statements IS NOT NULL AS has_statements
FROM supabase_migrations.schema_migrations
ORDER BY version;
```
Compare the returned `version` values against the 46 filenames in `supabase/migrations/`. A
migration whose version is **absent** from this table has not been applied through the Supabase
migration system, regardless of what its file header says.

### Step 3 — Object-level confirmation for the high-priority set (below)
For each high-priority migration, confirm the specific object it claims to create/alter actually
exists with the expected shape, using `information_schema` / `pg_catalog` — this catches the edge
case where a migration was applied outside the tracked migration flow (e.g. run by hand in the SQL
editor and never recorded):
```sql
-- Table/column existence
SELECT table_name, column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = '<table>';

-- RLS policy inventory
SELECT polname, tablename, cmd, qual FROM pg_policies
WHERE schemaname = 'public' AND tablename = '<table>';

-- Function / RPC existence and search_path pinning
SELECT proname, prosecdef, proconfig FROM pg_proc
WHERE proname = '<function_name>';
```

### Step 4 — Run the Supabase Security Advisor and Performance Advisor
Per the existing charter handoff flow, run both advisors now (read-only) rather than waiting for a
future migration event. Advisor findings that match the concerns already documented in
`20260902021400_harden_rls_and_security_definer_access.sql` and the OE hardening series are strong
independent corroboration of whether that hardening is actually live.

### Step 5 — Produce the ledger
For every migration, record exactly three facts, kept visually distinct so they can never be
conflated:
- **Repo status** (what the file/docs claim — already captured in `07-migration-reconciliation.md`)
- **Verified remote status** (from Steps 1–3: applied / not applied / applied-but-drifted)
- **Action needed** (none / apply via normal forward-only process / investigate drift)

## 4. Priority order for verification

Verify in this order — security-sensitive and runtime-critical first, as instructed:

**Tier 1 — Security-sensitive (verify first, highest risk if silently missing):**
| Migration | Why it's Tier 1 |
|---|---|
| `20260902021400_harden_rls_and_security_definer_access.sql` | RLS/SECURITY DEFINER hardening across strategist/admin surfaces |
| `20260902040000_protect_member_profiles_privileged_fields.sql` | Prevents member self-escalation of plan/status/strategist flags |
| `20260909020000_forward_profiles_public_view.sql` | Public profile privacy allow-list — a live privacy control, not just a feature |
| `20260908010000_career_timeline_reserved_event_type_rls.sql` | Prevents ordinary users from inserting/mutating reserved roadmap event types |
| `20260914000000_member_feedback_and_exclusion_rules.sql` | OE member-control + feedback security surface |
| `20260915000000_harden_job_matches_update_policies.sql` | Self-flagged in its own header as the highest-priority OE security item — prevents score/snapshot self-escalation |
| `20260917000000_harden_get_job_match_snapshot.sql` | Pins `search_path`, revokes PUBLIC/anon EXECUTE on a helper RPC |
| `20260918000000_job_matches_column_security_and_rls_perf.sql` | Closes a `computed_at` mutability gap |
| `20260919000000_oe_rls_performance_auth_uid.sql` | RLS correctness/perf across 4 OE tables |
| `20260921000000_oe_table_grants_hardening.sql` | Defense-in-depth table grants beyond RLS alone |
| `20260922000000_fix_market_intelligence_admin_jwt_claim.sql` | Fixes an admin-read defect (SQLSTATE 42501 per non-prod manifest) |
| `20260923000000_fix_market_intelligence_admin_jwt_initplan_lint.sql` | Syntax follow-up to the above |

**Tier 2 — Runtime-critical foundation (if missing, core product is broken, but low security risk):**
| Migration | Why it's Tier 2 |
|---|---|
| `20260802172349_phase3_membership_system.sql` | Root of the entire member stack |
| `20260802180911_phase4_operational_engine.sql` | Root of applications/opportunities/CRM stack |
| `20260821000000_opportunity_engine.sql` | Root of the entire Opportunity Engine |
| `20260831000000_forward_dna.sql` | Root of Forward DNA / Forward Score evidence |
| `20260907120000_resume_intelligence_phase2_foundation.sql` | Whole Resume Intelligence stack depends on it; explicitly headed "AUTHORED, NOT APPLIED" in repo |
| `20260908000000_career_vault.sql` | Root of Career Vault |
| `20260912000000_market_intelligence_snapshots.sql` | OE analytics/strategist surface |

**Tier 3 — Everything else** (badges, blog, LinkedIn optimizer, calendar/interview scheduling
hotfixes, dedup/stale-detection columns, digest log) — verify after Tiers 1–2, using the same
Step 1–3 method. Full list and per-file detail already in `07-migration-reconciliation.md`.

## 5. App code depending on possibly-unverified schema (already inventoried)

`07-migration-reconciliation.md` lists the exact consuming files for every migration in its
"whether application code currently depends on it" column — that inventory is the input to this
step, not duplicated here. The headline: **every Tier 1 and Tier 2 migration has confirmed,
named application-code consumers.** None of this is speculative or dead code being needlessly
verified — real member/strategist-facing paths depend on every item in the priority list above.

## 6. Deliverable

ChatGPT produces an updated version of `07-migration-reconciliation.md` (or a new dated companion
doc — ChatGPT's call) with the "Evidence of actual database state" column replaced by real,
verified answers for at least all of Tier 1 and Tier 2, and a clear list of any migration found to
be genuinely missing that needs to go through the **normal forward-only migration process**
(review → security review → Olivia's manifest verification → ChatGPT executes in non-prod →
advisors → production, per the existing charter handoff flow) — as a **separate**, explicitly
owner-approved follow-up action, not as part of this verification task.

## 7. Acceptance criteria

- [ ] Every Tier 1 migration has a verified remote status (not a repo-comment inference)
- [ ] Every Tier 2 migration has a verified remote status
- [ ] Any drift found (repo says applied, remote says not, or vice versa) is explicitly logged, not
      silently resolved
- [ ] No migration was applied, altered, or executed as part of this task
- [ ] Security Advisor and Performance Advisor were run and their output cross-referenced against
      the Tier 1 list
- [ ] The reconciliation doc is updated to distinguish "repo status" from "verified remote status"
      as two separate columns, permanently, so this ambiguity cannot recur silently in the future
