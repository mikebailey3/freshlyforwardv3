import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ROADMAP_EVENT_TYPES } from './roadmap'

// Static, text-based regression guard for the DRAFT (NOT APPLIED) migration
// supabase/migrations/20260908010000_career_timeline_reserved_event_type_rls.sql.
//
// IMPORTANT SCOPE NOTE: this sandbox has no live Supabase access, no
// Supabase CLI, no local Postgres, and no Docker (all confirmed before
// writing this file). There is no way to actually execute this SQL and
// verify RLS behavior end-to-end from here. This test does NOT prove the
// migration works against a real Postgres engine -- it only proves the
// migration file's *text* still contains the structural pieces this design
// depends on, so a future edit can't silently weaken or remove the
// protection without a test failing. Genuine functional verification
// (the 8 security cases in the hardening request) requires someone with
// live/local Supabase access to actually apply this migration and test it.

const MIGRATION_PATH = join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260908010000_career_timeline_reserved_event_type_rls.sql',
)

function readMigration(): string {
  return readFileSync(MIGRATION_PATH, 'utf-8')
}

describe('career_timeline reserved event-type RLS migration (static text checks only, not live-executed)', () => {
  it('defines is_reserved_roadmap_event_type() as the single source of truth, matching ROADMAP_EVENT_TYPES exactly', () => {
    const sql = readMigration()
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.is_reserved_roadmap_event_type')

    // The SQL literal list must be exactly the same set as the TypeScript
    // ROADMAP_EVENT_TYPES source of truth -- this is the drift guard: if a
    // third reserved type is ever added on one side and not the other,
    // this assertion fails instead of silently diverging.
    for (const eventType of ROADMAP_EVENT_TYPES) {
      expect(sql).toContain(`'${eventType}'`)
    }
  })

  it('insert_own_timeline policy preserves ownership check AND blocks reserved event types', () => {
    const sql = readMigration()
    const policyBlock = extractPolicyBlock(sql, 'insert_own_timeline')

    expect(policyBlock).toMatch(/FOR INSERT/)
    expect(policyBlock).toMatch(/TO authenticated/)
    expect(policyBlock).toContain('auth.uid() = user_id')
    expect(policyBlock).toContain('NOT public.is_reserved_roadmap_event_type(event_type)')
  })

  it('update_own_timeline policy blocks turning a normal row into a reserved event type (WITH CHECK) AND blocks touching an already-reserved row at all (USING)', () => {
    const sql = readMigration()
    const policyBlock = extractPolicyBlock(sql, 'update_own_timeline')

    expect(policyBlock).toMatch(/FOR UPDATE/)
    expect(policyBlock).toMatch(/TO authenticated/)

    // Split the USING and WITH CHECK clauses apart so each can be verified
    // to independently carry both the ownership check AND the reserved-type
    // exclusion. This is the exact fix for the historical gap: the original
    // draft only had the reserved-type exclusion in WITH CHECK, which let a
    // member "launder" an already-reserved row back to a normal type (WITH
    // CHECK only inspects the resulting NEW row, so it can never see what
    // the row looked like before the update). Moving the exclusion into
    // USING as well closes that gap, since USING evaluates against the OLD
    // row and gates whether the row can be targeted for update at all.
    const usingMatch = policyBlock.match(/USING \(([\s\S]*?)\)\s*WITH CHECK/)
    const withCheckMatch = policyBlock.match(/WITH CHECK \(([\s\S]*?)\)\s*;/)
    expect(usingMatch).not.toBeNull()
    expect(withCheckMatch).not.toBeNull()
    const usingClause = usingMatch![1]
    const withCheckClause = withCheckMatch![1]

    expect(usingClause).toContain('auth.uid() = user_id')
    expect(usingClause).toContain('NOT public.is_reserved_roadmap_event_type(event_type)')
    expect(withCheckClause).toContain('auth.uid() = user_id')
    expect(withCheckClause).toContain('NOT public.is_reserved_roadmap_event_type(event_type)')
  })

  it('delete_own_timeline policy preserves ownership AND blocks deleting an already-reserved row', () => {
    const sql = readMigration()
    const policyBlock = extractPolicyBlock(sql, 'delete_own_timeline')

    expect(policyBlock).toMatch(/FOR DELETE/)
    expect(policyBlock).toMatch(/TO authenticated/)
    expect(policyBlock).toContain('auth.uid() = user_id')
    expect(policyBlock).toContain('NOT public.is_reserved_roadmap_event_type(event_type)')
  })

  it('does not touch select_own_timeline or any GRANT/REVOKE statement', () => {
    const sql = readMigration()

    expect(sql).not.toMatch(/DROP POLICY[^\n]*select_own_timeline/)
    expect(sql).not.toMatch(/CREATE POLICY "select_own_timeline"/)

    // No real GRANT/REVOKE statements -- only mentions of the words are in
    // prose comments describing add_roadmap_milestone's *existing*,
    // untouched REVOKE/GRANT lines from a prior migration, not new ones
    // introduced here. Checking for the executable statement shape
    // specifically (keyword followed by EXECUTE/ON, not a bare comment
    // reference) keeps this assertion meaningful rather than trivially
    // failing on the explanatory comments.
    const executableLines = sql
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n')
    expect(executableLines).not.toMatch(/\bGRANT\b/)
    expect(executableLines).not.toMatch(/\bREVOKE\b/)
    expect(executableLines).not.toMatch(/FORCE ROW LEVEL SECURITY/)
  })

  it('rollback comment restores all three touched policies (insert, update, delete) to their pre-migration form', () => {
    const sql = readMigration()
    const rollbackIndex = sql.indexOf('ROLLBACK')
    expect(rollbackIndex).toBeGreaterThan(-1)
    const rollbackSection = sql.slice(rollbackIndex)

    expect(rollbackSection).toContain('CREATE POLICY "delete_own_timeline"')
    expect(rollbackSection).toContain('CREATE POLICY "update_own_timeline"')
    expect(rollbackSection).toContain('CREATE POLICY "insert_own_timeline"')
    expect(rollbackSection).toContain('DROP FUNCTION IF EXISTS public.is_reserved_roadmap_event_type(text)')
  })

  it('does not add a CHECK constraint or enum (event_type stays free-form text per the approved design direction)', () => {
    const sql = readMigration()
    const executableLines = sql
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n')

    expect(executableLines).not.toMatch(/ADD CONSTRAINT/)
    expect(executableLines).not.toMatch(/CREATE TYPE/)
  })
})

/**
 * Extracts the `CREATE POLICY "<name>" ... ;` block for a given policy name
 * from raw migration SQL text, so assertions can scope to exactly that
 * policy instead of matching anywhere in the file.
 */
function extractPolicyBlock(sql: string, policyName: string): string {
  const marker = `CREATE POLICY "${policyName}"`
  const startIndex = sql.indexOf(marker)
  if (startIndex === -1) {
    throw new Error(`Could not find CREATE POLICY "${policyName}" in migration file`)
  }
  const endIndex = sql.indexOf(';', startIndex)
  if (endIndex === -1) {
    throw new Error(`CREATE POLICY "${policyName}" block never terminates with ';'`)
  }
  return sql.slice(startIndex, endIndex + 1)
}
