import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * OE 2.0 Hardening -- regression coverage for the computed_at gap found
 * during this project's own re-audit of the hardened job_matches UPDATE
 * policies (20260915000000 -> superseded, without editing history, by
 * 20260918000000_job_matches_column_security_and_rls_perf.sql).
 *
 * RLS itself cannot be unit-tested with a mock (see
 * scripts/runOe2SecurityTests.ts for the real, live-database version of
 * this coverage). What CAN be verified locally, cheaply, and on every
 * CI run without any database at all is that the migration file itself
 * still contains the exact column-equality guard for every column
 * neither actor should be able to touch -- so a future hand-edit that
 * accidentally drops one (exactly the class of bug this migration was
 * written to fix) fails the test suite immediately, long before it ever
 * reaches a real database.
 */

const MIGRATION_PATH = join(__dirname, '..', '..', 'supabase', 'migrations', '20260918000000_job_matches_column_security_and_rls_perf.sql')
const migrationSql = readFileSync(MIGRATION_PATH, 'utf-8')

function extractPolicyBody(policyName: string): string {
  const start = migrationSql.indexOf(`CREATE POLICY "${policyName}"`)
  if (start === -1) throw new Error(`Policy ${policyName} not found in migration file -- has it been renamed or removed?`)
  // Each policy statement in this file ends at the next blank-line-preceded
  // "DROP POLICY" or end of file -- slicing to the next occurrence (or EOF)
  // is sufficient since there are exactly three CREATE POLICY statements,
  // always in the same relative order, in this file.
  const nextDrop = migrationSql.indexOf('DROP POLICY', start + 1)
  return migrationSql.slice(start, nextDrop === -1 ? undefined : nextDrop)
}

describe('20260918000000_job_matches_column_security_and_rls_perf.sql -- computed_at regression guard', () => {
  const guardedColumns = [
    'member_id', 'scraped_job_id', 'fresh_fit_score', 'matched_skills',
    'missing_skills', 'score_breakdown', 'computed_at', 'engine_version',
  ]

  it('member_dismiss_own_job_matches guards every column except dismissed_at, including computed_at', () => {
    const body = extractPolicyBody('member_dismiss_own_job_matches')
    for (const column of guardedColumns) {
      expect(body, `expected ${column} to be compared against the snapshot`).toContain(`${column} = (public.get_job_match_snapshot(id)).${column}`)
    }
    expect(body).toContain('promoted_opportunity_id IS NOT DISTINCT FROM (public.get_job_match_snapshot(id)).promoted_opportunity_id')
    // dismissed_at is the one column this policy must NOT compare -- it's the actor's own allowed field.
    expect(body).not.toMatch(/dismissed_at = \(public\.get_job_match_snapshot\(id\)\)\.dismissed_at/)
  })

  it('strategist_promote_job_matches guards every column except promoted_opportunity_id, including computed_at', () => {
    const body = extractPolicyBody('strategist_promote_job_matches')
    for (const column of guardedColumns) {
      expect(body, `expected ${column} to be compared against the snapshot`).toContain(`${column} = (public.get_job_match_snapshot(id)).${column}`)
    }
    expect(body).toContain('dismissed_at IS NOT DISTINCT FROM (public.get_job_match_snapshot(id)).dismissed_at')
    // promoted_opportunity_id is the one column this policy must NOT compare -- it's the actor's own allowed field.
    expect(body).not.toMatch(/promoted_opportunity_id = \(public\.get_job_match_snapshot\(id\)\)\.promoted_opportunity_id/)
  })

  it('both policies use (select auth.uid()) rather than bare auth.uid() -- the RLS performance fix bundled in the same migration', () => {
    const memberBody = extractPolicyBody('member_dismiss_own_job_matches')
    const strategistBody = extractPolicyBody('strategist_promote_job_matches')
    for (const body of [memberBody, strategistBody]) {
      const totalAuthUidCalls = (body.match(/auth\.uid\(\)/g) ?? []).length
      const wrappedAuthUidCalls = (body.match(/\(select auth\.uid\(\)\)/g) ?? []).length
      expect(totalAuthUidCalls).toBeGreaterThan(0)
      expect(wrappedAuthUidCalls, 'every auth.uid() call must be wrapped in (select ...) -- an unwrapped occurrence means the perf fix regressed').toBe(totalAuthUidCalls)
    }
  })
})
