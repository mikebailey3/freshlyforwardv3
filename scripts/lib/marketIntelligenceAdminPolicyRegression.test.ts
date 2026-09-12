import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * OE 2.0 Hardening -- regression coverage for the
 * market_intelligence_snapshots admin check, which went through two
 * forward-only fixes after live non-prod testing:
 *
 * 1. 20260922000000_fix_market_intelligence_admin_jwt_claim.sql --
 *    fixed the validated SQLSTATE 42501 defect (the admin branch
 *    queried auth.users directly, which `authenticated` has no SELECT
 *    on) by switching to the auth.jwt() app_metadata claim.
 * 2. 20260923000000_fix_market_intelligence_admin_jwt_initplan_lint.sql --
 *    pure syntax fix for a remaining Performance Advisor
 *    `auth_rls_initplan` finding: re-parenthesized so only the
 *    `auth.jwt()` call itself is wrapped in `(select ...)`, matching
 *    Supabase's recognized InitPlan shape, with zero behavior change.
 *
 * This file tracks whichever migration is CURRENTLY authoritative for
 * this policy (20260923000000, as of this update) -- same convention
 * as jobMatchesPolicyRegression.test.ts, which tracks the latest
 * migration governing the job_matches policies rather than a
 * since-superseded intermediate one. Neither 20260922000000 nor any
 * other already-applied migration is edited by this update.
 *
 * Live RLS enforcement itself cannot be unit-tested with a mock (see
 * scripts/runOe2SecurityTests.ts for the real, live-database version
 * of this coverage -- the four market_intelligence_snapshots
 * assertions, validated green in Round 2 non-prod testing). What CAN
 * be verified locally, cheaply, and on every CI run without any
 * database at all is that the migration file itself still uses the
 * JWT-claim fix, in its InitPlan-optimized form, and never regresses
 * back to querying auth.users directly.
 */

const MIGRATION_PATH = join(__dirname, '..', '..', 'supabase', 'migrations', '20260923000000_fix_market_intelligence_admin_jwt_initplan_lint.sql')
const migrationSql = readFileSync(MIGRATION_PATH, 'utf-8')

function extractPolicyBody(policyName: string): string {
  const start = migrationSql.indexOf(`CREATE POLICY "${policyName}"`)
  if (start === -1) throw new Error(`Policy ${policyName} not found in migration file -- has it been renamed or removed?`)
  return migrationSql.slice(start)
}

describe('20260923000000_fix_market_intelligence_admin_jwt_initplan_lint.sql -- admin policy regression guard', () => {
  it('admin_strategist_read_market_intelligence uses the InitPlan-optimized (select auth.jwt()) form', () => {
    const body = extractPolicyBody('admin_strategist_read_market_intelligence')
    expect(body).toContain(`((select auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'`)
  })

  it('never wraps the whole jsonb-extraction chain in the subquery -- the exact shape the advisor re-flagged', () => {
    const body = extractPolicyBody('admin_strategist_read_market_intelligence')
    expect(body).not.toMatch(/\(select auth\.jwt\(\) -> 'app_metadata' ->> 'role'\)/)
  })

  it('still keys off app_metadata, never user_metadata', () => {
    const body = extractPolicyBody('admin_strategist_read_market_intelligence')
    expect(body).toContain('app_metadata')
    expect(body).not.toContain('user_metadata')
  })

  it('never queries auth.users -- the exact class of bug the prior fix addressed', () => {
    const body = extractPolicyBody('admin_strategist_read_market_intelligence')
    expect(body).not.toMatch(/FROM\s+auth\.users/i)
  })

  it('does not grant authenticated SELECT on auth.users anywhere in this file', () => {
    expect(migrationSql).not.toMatch(/GRANT\s+SELECT\s+ON\s+(TABLE\s+)?auth\.users/i)
  })

  it('preserves the active-strategist-assignment OR branch unchanged', () => {
    const body = extractPolicyBody('admin_strategist_read_market_intelligence')
    expect(body).toContain('SELECT strategist_id FROM public.strategist_assignments')
    expect(body).toContain('strategist_assignments.is_active = true')
  })

  it('is still scoped TO authenticated only', () => {
    const body = extractPolicyBody('admin_strategist_read_market_intelligence')
    expect(body).toMatch(/TO\s+authenticated/)
  })
})
