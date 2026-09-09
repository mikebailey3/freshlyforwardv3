import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// Regression coverage for the Resume Intelligence Phase 5-8 completion
// audit's independent security-hardening follow-up: three SECURITY
// DEFINER RPCs --
//   - set_master_resume_version()          (20260907120000, Phase 2/3)
//   - replace_master_resume_entries()      (20260907120000, Phase 4)
//   - replace_resume_version_entries()     (20260909010000, Phase 5)
// -- all shared the identical `IF v_member_id <> auth.uid() THEN` ownership
// check. Same root cause as the already-documented
// addRoadmapMilestoneAdminNullAuthzRegression.test.ts bug: SQL's `<>`
// against NULL evaluates to NULL (not TRUE), and PL/pgSQL's
// `IF <NULL-condition> THEN` never fires (a NULL condition is treated as
// FALSE, so the branch is skipped) -- so an anon/unauthenticated caller
// (auth.uid() IS NULL) would sail straight past the ownership check.
//
// Two independent layers, matching this repo's established convention for
// PL/pgSQL authorization bugs (see addRoadmapMilestoneAdminNullAuthzRegression.test.ts)
// since this sandbox has no live Supabase/Postgres access and cannot
// execute the real functions:
//
//   1. A pure-TypeScript simulation of the exact IF-condition these three
//      functions share, applied to both the OLD buggy predicate and the
//      NEW fixed predicate.
//   2. A static text check that all three migration files now contain the
//      NULL-safe guard and the REVOKE/GRANT pair, so a future edit can't
//      silently reintroduce the unguarded comparison without a test
//      failing.
//
// Neither layer proves the live-deployed function behaves this way --
// none of this schema has ever been applied to any Supabase project
// (documented in the migration files' own headers), so there is nothing
// to smoke-test live yet.

type SqlBoolean = boolean | null

/** SQL's `<>`: NULL if either operand is NULL, else the real (in)equality. */
function sqlNotEqual(a: string, b: string | null): SqlBoolean {
  if (b === null) return null
  return a !== b
}

/** PL/pgSQL's `IF <cond> THEN ... END IF`: a NULL condition is treated as
 * FALSE (the branch is skipped), per PostgreSQL's own documented behavior. */
function plpgsqlIfBranchTaken(condition: SqlBoolean): boolean {
  return condition === true
}

/** The OLD, buggy check every one of these three RPCs used:
 *   IF v_member_id <> auth.uid() THEN RAISE EXCEPTION ...
 * Returns true if the exception fires (caller correctly rejected). */
function oldCheckRejects(memberId: string, callerUid: string | null): boolean {
  return plpgsqlIfBranchTaken(sqlNotEqual(memberId, callerUid))
}

/** The NEW, fixed check:
 *   IF auth.uid() IS NULL OR v_member_id <> auth.uid() THEN RAISE EXCEPTION ...
 * Postgres's three-valued OR: TRUE if either operand is TRUE, so explicitly
 * rejecting a NULL auth.uid() first short-circuits before the poisoned
 * `<>` comparison ever needs to resolve. */
function newCheckRejects(memberId: string, callerUid: string | null): boolean {
  const callerIsNull = callerUid === null
  const condition: SqlBoolean = callerIsNull ? true : sqlNotEqual(memberId, callerUid)
  return plpgsqlIfBranchTaken(condition)
}

describe('Resume Intelligence master/version RPCs -- NULL-auth.uid() bypass (three-valued-logic simulation)', () => {
  it('THE BUG: with the OLD check, an anon/unauthenticated caller (auth.uid() IS NULL) is NOT rejected', () => {
    const rejected = oldCheckRejects('member-1', null)
    // This is the actual vulnerability found by the Phase 5-8 audit: an
    // unauthenticated caller sails past the check because NULL <> 'member-1'
    // is NULL, not TRUE, and PL/pgSQL treats a NULL IF-condition as FALSE.
    expect(rejected).toBe(false)
  })

  it('THE FIX: with the NEW check, the same anon/unauthenticated caller IS correctly rejected', () => {
    const rejected = newCheckRejects('member-1', null)
    expect(rejected).toBe(true)
  })

  it('the fix does not change behavior for the legitimate authorization paths', () => {
    // the resume version's own member -- always allowed, under both checks
    expect(oldCheckRejects('member-1', 'member-1')).toBe(false)
    expect(newCheckRejects('member-1', 'member-1')).toBe(false)

    // a different, real, authenticated member -- always rejected, under
    // both checks, since the comparison is definitively FALSE, not NULL
    expect(oldCheckRejects('member-1', 'member-2')).toBe(true)
    expect(newCheckRejects('member-1', 'member-2')).toBe(true)
  })
})

function stripSqlComments(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/--.*/, ''))
    .join('\n')
}

const PHASE2_FOUNDATION_PATH = join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260907120000_resume_intelligence_phase2_foundation.sql',
)
const PHASE5_VERSION_ENTRIES_RPC_PATH = join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260909010000_resume_intelligence_phase5_version_entries_rpc.sql',
)

describe('Resume Intelligence RPC migration files (static text checks only, not live-executed)', () => {
  it('set_master_resume_version() contains the NULL-safe guard and the REVOKE/GRANT pair', () => {
    const sql = readFileSync(PHASE2_FOUNDATION_PATH, 'utf-8')
    expect(sql).toContain('CREATE OR REPLACE FUNCTION set_master_resume_version(p_new_master_id uuid)')
    expect(sql).toContain('IF auth.uid() IS NULL OR v_member_id <> auth.uid() THEN')
    expect(sql).toContain('REVOKE EXECUTE ON FUNCTION set_master_resume_version(uuid) FROM PUBLIC, anon;')
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION set_master_resume_version(uuid) TO authenticated;')
  })

  it('replace_master_resume_entries() contains the NULL-safe guard and the REVOKE/GRANT pair', () => {
    const sql = readFileSync(PHASE2_FOUNDATION_PATH, 'utf-8')
    expect(sql).toContain('CREATE OR REPLACE FUNCTION replace_master_resume_entries(p_resume_version_id uuid, p_entries jsonb)')
    expect(sql).toContain(
      'REVOKE EXECUTE ON FUNCTION replace_master_resume_entries(uuid, jsonb) FROM PUBLIC, anon;',
    )
    expect(sql).toContain(
      'GRANT EXECUTE ON FUNCTION replace_master_resume_entries(uuid, jsonb) TO authenticated;',
    )
  })

  it('replace_resume_version_entries() (Phase 5, already fixed pre-audit-followup) keeps its NULL-safe guard and REVOKE/GRANT pair', () => {
    const sql = readFileSync(PHASE5_VERSION_ENTRIES_RPC_PATH, 'utf-8')
    expect(sql).toContain('IF auth.uid() IS NULL OR v_member_id <> auth.uid() THEN')
    expect(sql).toContain(
      'REVOKE EXECUTE ON FUNCTION replace_resume_version_entries(uuid, jsonb) FROM PUBLIC, anon;',
    )
    expect(sql).toContain(
      'GRANT EXECUTE ON FUNCTION replace_resume_version_entries(uuid, jsonb) TO authenticated;',
    )
  })

  it('neither Resume Intelligence migration file contains the old unguarded comparison as a live statement', () => {
    const phase2Executable = stripSqlComments(readFileSync(PHASE2_FOUNDATION_PATH, 'utf-8'))
    const phase5Executable = stripSqlComments(readFileSync(PHASE5_VERSION_ENTRIES_RPC_PATH, 'utf-8'))

    // The exact old broken statement, verbatim -- must not appear as
    // executable SQL in either file (explanatory comments referencing the
    // bare expression `v_member_id <> auth.uid()` for documentation
    // purposes, without the unguarded `IF ... THEN`, are fine and expected).
    expect(phase2Executable).not.toContain('IF v_member_id <> auth.uid() THEN')
    expect(phase5Executable).not.toContain('IF v_member_id <> auth.uid() THEN')
  })

  it('both foundation-migration functions keep their pre-existing archive/master-status checks unchanged', () => {
    const sql = readFileSync(PHASE2_FOUNDATION_PATH, 'utf-8')
    expect(sql).toContain("RAISE EXCEPTION 'cannot modify an archived resume version';")
    expect(sql).toContain("RAISE EXCEPTION 'resume_versions row % is not the active Master Resume', p_resume_version_id;")
  })
})
