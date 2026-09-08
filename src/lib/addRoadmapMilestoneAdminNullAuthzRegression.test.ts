import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// Regression coverage for the add_roadmap_milestone NULL-swallows-
// authorization-check bug, hotfixed live and brought into the repo via
// supabase/migrations/20260908020000_fix_add_roadmap_milestone_admin_null.sql
// (a forward-only fix -- the original 20260907000000 migration is never
// edited).
//
// Two independent layers, since this sandbox has no live Supabase/Postgres
// access (confirmed elsewhere in this repo's other migration tests) and so
// cannot execute the real PL/pgSQL function:
//
//   1. A pure-TypeScript simulation of Postgres's three-valued logic (NULL
//      is a distinct third truth value, not the same as false) and
//      PL/pgSQL's "NULL IF-condition is treated as false" rule, applied to
//      both the OLD buggy predicate and the NEW fixed predicate. This
//      proves the *logic* of the fix is sound, and documents exactly why
//      the bug existed, as an executable spec rather than just prose.
//   2. A static text check that the actual migration file contains the
//      exact COALESCE(...) fix, so a future edit can't silently reintroduce
//      the unguarded comparison without a test failing.
//
// Neither layer proves the live-deployed function behaves this way --
// that was confirmed by the live smoke test already run by whoever
// deployed the hotfix (member-to-self allowed, member-to-different-member
// rejected, admin-to-different-member allowed, smoke rows rolled back).

type SqlBoolean = boolean | null

/** Postgres's three-valued OR: TRUE if any operand is TRUE; else NULL if
 * any operand is NULL; else FALSE. This is the crux of the bug -- ordinary
 * boolean OR would treat NULL as falsy, but SQL does not. */
function sqlOr(...values: SqlBoolean[]): SqlBoolean {
  if (values.some((v) => v === true)) return true
  if (values.some((v) => v === null)) return null
  return false
}

function sqlNot(value: SqlBoolean): SqlBoolean {
  return value === null ? null : !value
}

/** PL/pgSQL's `IF <cond> THEN ... END IF`: a NULL condition is treated as
 * FALSE (the branch is skipped), per PostgreSQL's own documented behavior. */
function plpgsqlIfBranchTaken(condition: SqlBoolean): boolean {
  return condition === true
}

/** The OLD, buggy predicate: `(auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'`.
 * NULL whenever the caller's JWT has no app_metadata.role claim at all --
 * i.e. every ordinary member, the default/common case. */
function oldCallerIsAdminPredicate(role: string | null): SqlBoolean {
  if (role === null) return null
  return role === 'admin'
}

/** The NEW, fixed predicate: `COALESCE((...) = 'admin', false)`. */
function newCallerIsAdminPredicate(role: string | null): boolean {
  return oldCallerIsAdminPredicate(role) === true
}

/** Simulates the exact authorization check:
 *   IF NOT (auth.uid() = p_member_id OR v_is_assigned_strategist OR v_caller_is_admin)
 *     THEN RAISE EXCEPTION ... END IF;
 * Returns true if the exception fires (caller rejected). */
function wouldReject(
  callerIsSelf: boolean,
  isAssignedStrategist: boolean,
  callerIsAdmin: SqlBoolean,
): boolean {
  const authorized = sqlOr(callerIsSelf, isAssignedStrategist, callerIsAdmin)
  return plpgsqlIfBranchTaken(sqlNot(authorized))
}

describe('add_roadmap_milestone NULL-admin authorization bug (three-valued-logic simulation)', () => {
  it('THE BUG: with the OLD predicate, an ordinary member (no role claim) acting on a DIFFERENT member is NOT rejected', () => {
    const oldPredicateResult = oldCallerIsAdminPredicate(null) // no app_metadata.role at all
    expect(oldPredicateResult).toBeNull() // NULL, not false -- this is the root cause

    const rejected = wouldReject(false, false, oldPredicateResult)
    // This is the actual historical vulnerability: an unauthorized caller
    // was NOT rejected, because NULL poisoned the OR chain and PL/pgSQL
    // treats a NULL IF-condition as false (branch skipped).
    expect(rejected).toBe(false)
  })

  it('THE FIX: with the NEW predicate, the same ordinary member acting on a DIFFERENT member IS correctly rejected', () => {
    const newPredicateResult = newCallerIsAdminPredicate(null)
    expect(newPredicateResult).toBe(false) // COALESCE forces false, never null

    const rejected = wouldReject(false, false, newPredicateResult)
    expect(rejected).toBe(true)
  })

  it('the fix does not change behavior for the three legitimate authorization paths', () => {
    // member acting on themself -- always allowed, regardless of predicate
    expect(wouldReject(true, false, newCallerIsAdminPredicate(null))).toBe(false)
    expect(wouldReject(true, false, oldCallerIsAdminPredicate(null))).toBe(false)

    // assigned strategist acting on their member -- always allowed
    expect(wouldReject(false, true, newCallerIsAdminPredicate(null))).toBe(false)
    expect(wouldReject(false, true, oldCallerIsAdminPredicate(null))).toBe(false)

    // real admin (role IS 'admin') acting on any member -- always allowed,
    // identically under both predicates, since the comparison is TRUE, not NULL
    expect(wouldReject(false, false, newCallerIsAdminPredicate('admin'))).toBe(false)
    expect(wouldReject(false, false, oldCallerIsAdminPredicate('admin'))).toBe(false)

    // non-admin role claim (e.g. 'member') acting on someone else -- rejected
    // under both predicates, since the comparison is definitively FALSE, not NULL
    expect(wouldReject(false, false, newCallerIsAdminPredicate('member'))).toBe(true)
    expect(wouldReject(false, false, oldCallerIsAdminPredicate('member'))).toBe(true)
  })
})

function stripSqlComments(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/--.*/, ''))
    .join('\n')
}

const MIGRATION_PATH = join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260908020000_fix_add_roadmap_milestone_admin_null.sql',
)
const ORIGINAL_RPC_MIGRATION_PATH = join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260907000000_add_roadmap_milestone_rpc.sql',
)

describe('add_roadmap_milestone hotfix migration file (static text checks only, not live-executed)', () => {
  it('contains the null-safe COALESCE admin predicate, not the original unguarded comparison', () => {
    const sql = readFileSync(MIGRATION_PATH, 'utf-8')
    expect(sql).toContain(
      "v_caller_is_admin boolean := COALESCE((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);",
    )

    // Scoped to executable SQL only -- the migration's own header comment
    // deliberately quotes the OLD unguarded line verbatim as part of its
    // root-cause writeup, which is legitimate documentation, not a real
    // reintroduction of the bug. Only the actual DECLARE statement matters.
    const executableSql = stripSqlComments(sql)
    expect(executableSql).not.toContain(
      "v_caller_is_admin boolean := (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin';",
    )
  })

  it('does not edit the already-applied original RPC migration', () => {
    const originalSql = readFileSync(ORIGINAL_RPC_MIGRATION_PATH, 'utf-8')
    // The original migration must still contain its own (now-superseded
    // live, but historically-accurate) unguarded predicate untouched --
    // this repo's convention is forward-only fixes, never editing an
    // already-applied migration file.
    expect(originalSql).toContain(
      "v_caller_is_admin boolean := (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin';",
    )
  })

  it('preserves SECURITY DEFINER, safe search_path, and the existing REVOKE/GRANT scope', () => {
    const sql = readFileSync(MIGRATION_PATH, 'utf-8')
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.add_roadmap_milestone')
    expect(sql).toContain('SECURITY DEFINER')
    expect(sql).toContain("SET search_path = ''")
    expect(sql).toContain(
      'REVOKE ALL ON FUNCTION public.add_roadmap_milestone(uuid, text, text, timestamptz, text) FROM PUBLIC, anon;',
    )
    expect(sql).toContain(
      'GRANT EXECUTE ON FUNCTION public.add_roadmap_milestone(uuid, text, text, timestamptz, text) TO authenticated;',
    )
  })

  it('preserves the three-way authorization check structure and idempotency upsert-or-fetch logic', () => {
    const sql = readFileSync(MIGRATION_PATH, 'utf-8')
    expect(sql).toContain('auth.uid() = p_member_id')
    expect(sql).toContain('v_is_assigned_strategist')
    expect(sql).toContain("RAISE EXCEPTION 'Not authorized to add a roadmap milestone for this member'")
    expect(sql).toContain('ON CONFLICT (user_id, (metadata->>\'idempotency_key\'))')
    expect(sql).toContain('DO NOTHING')
  })
})
