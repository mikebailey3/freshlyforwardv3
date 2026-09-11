import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * OE 2.0 Hardening -- regression coverage for the validated
 * market_intelligence_snapshots admin-check defect found during live
 * non-prod RLS testing (auth.users SELECT permission denied for
 * `authenticated`), fixed forward-only by
 * 20260922000000_fix_market_intelligence_admin_jwt_claim.sql.
 *
 * Live RLS enforcement itself cannot be unit-tested with a mock (see
 * scripts/runOe2SecurityTests.ts for the real, live-database version
 * of this coverage -- the four market_intelligence_snapshots
 * assertions). What CAN be verified locally, cheaply, and on every CI
 * run without any database at all is that the migration file itself
 * still uses the JWT-claim fix and never regresses back to querying
 * auth.users directly.
 */

const MIGRATION_PATH = join(__dirname, '..', '..', 'supabase', 'migrations', '20260922000000_fix_market_intelligence_admin_jwt_claim.sql')
const migrationSql = readFileSync(MIGRATION_PATH, 'utf-8')

function extractPolicyBody(policyName: string): string {
  const start = migrationSql.indexOf(`CREATE POLICY "${policyName}"`)
  if (start === -1) throw new Error(`Policy ${policyName} not found in migration file -- has it been renamed or removed?`)
  return migrationSql.slice(start)
}

describe('20260922000000_fix_market_intelligence_admin_jwt_claim.sql -- auth.users regression guard', () => {
  it('admin_strategist_read_market_intelligence uses the auth.jwt() app_metadata claim, not a table lookup', () => {
    const body = extractPolicyBody('admin_strategist_read_market_intelligence')
    expect(body).toContain(`(select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'`)
  })

  it('never queries auth.users -- the exact class of bug this migration exists to fix', () => {
    const body = extractPolicyBody('admin_strategist_read_market_intelligence')
    expect(body).not.toMatch(/FROM\s+auth\.users/i)
  })

  it('does not grant authenticated SELECT on auth.users anywhere in this file -- the explicitly rejected alternative fix', () => {
    expect(migrationSql).not.toMatch(/GRANT\s+SELECT\s+ON\s+(TABLE\s+)?auth\.users/i)
  })

  it('preserves the active-strategist-assignment OR branch unchanged', () => {
    const body = extractPolicyBody('admin_strategist_read_market_intelligence')
    expect(body).toContain('SELECT strategist_id FROM public.strategist_assignments')
    expect(body).toContain('strategist_assignments.is_active = true')
  })
})
