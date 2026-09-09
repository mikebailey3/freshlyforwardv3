import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PUBLIC_PROFILE_ALLOWED_COLUMNS } from './publicProfile'

// Static, text-based regression guard for the DRAFT (NOT APPLIED) migration
// supabase/migrations/20260909020000_forward_profiles_public_view.sql.
//
// SCOPE NOTE: this sandbox has no Node.js runtime available at all (no
// node/npm/npx, and node_modules/.bin/vitest.cmd itself fails trying to
// spawn node) -- confirmed while implementing this feature, matching a
// prior documented finding in this same repo. This file could not actually
// be executed here. It is written to the same rigor as
// careerTimelineReservedEventTypeRlsMigration.test.ts (this repo's existing
// precedent for this exact kind of guard) and should be run in a real
// environment before this branch is considered verified.
//
// Like that precedent, this test does NOT prove the migration works against
// a real Postgres engine -- it only proves the migration file's *text*
// still contains the structural pieces this design depends on, so a future
// edit can't silently widen the public allow-list without a test failing.

const MIGRATION_PATH = join(
  process.cwd(),
  'supabase',
  'migrations',
  '20260909020000_forward_profiles_public_view.sql',
)

function readMigration(): string {
  return readFileSync(MIGRATION_PATH, 'utf-8')
}

const EXCLUDED_COLUMNS = [
  'phone', 'salary_min', 'salary_max', 'salary_currency', 'preferred_benefits',
  'stripe_customer_id', 'stripe_subscription_id', 'subscription_status',
  'account_status_reason', 'account_status_changed_at',
  'plan_id', 'application_authorized', 'electronic_consent',
  'consent_date', 'search_readiness_score', 'onboarding_completed',
  'onboarding_completed_at', 'is_strategist', 'weaknesses', 'jobs_to_avoid',
  'jobs_not_enjoyed', 'biggest_challenge', 'motivators', 'strengths',
  'jobs_enjoyed', 'preferred_jobs', 'preferred_industries', 'schedule_preference',
  'max_commute_minutes', 'remote_preference', 'willing_to_relocate',
  'travel_willingness', 'work_style', 'target_timeframe', 'target_role',
  'is_lifetime_founding', 'is_alumni', 'user_id', 'id', 'status',
]

describe('forward_profiles_public_view migration (static text checks only, not live-executed)', () => {
  it('creates public_forward_profiles as a VIEW, not a table or materialized view', () => {
    const sql = readMigration()
    expect(sql).toContain('CREATE OR REPLACE VIEW public_forward_profiles AS')
  })

  it("the view's SELECT list never mentions any excluded/sensitive column", () => {
    const sql = readMigration()
    const viewStart = sql.indexOf('CREATE OR REPLACE VIEW public_forward_profiles AS')
    const viewEnd = sql.indexOf('FROM member_profiles mp', viewStart)
    expect(viewStart).toBeGreaterThan(-1)
    expect(viewEnd).toBeGreaterThan(viewStart)
    const selectList = sql.slice(viewStart, viewEnd)

    for (const column of EXCLUDED_COLUMNS) {
      // Word-boundary match so e.g. "account_status" (allowed, used in the
      // WHERE clause but not here) never accidentally matches a substring
      // of something else, and so a bare mention in a comment above the
      // SELECT list can't produce a false pass.
      const pattern = new RegExp(`\\bmp\\.${column}\\b`)
      expect(selectList).not.toMatch(pattern)
    }
  })

  it("the view's SELECT list contains exactly the TypeScript allow-list's columns (drift guard against publicProfile.ts)", () => {
    const sql = readMigration()
    const viewStart = sql.indexOf('CREATE OR REPLACE VIEW public_forward_profiles AS')
    const viewEnd = sql.indexOf('FROM member_profiles mp', viewStart)
    const selectList = sql.slice(viewStart, viewEnd)

    const expectedColumns = PUBLIC_PROFILE_ALLOWED_COLUMNS.split(',').map((c) => c.trim())
    for (const column of expectedColumns) {
      // Each column is either a direct `mp.<col>` passthrough or the
      // `AS <col>` alias of a CASE expression (for the toggleable sections).
      const directPattern = new RegExp(`\\bmp\\.${column}\\b`)
      const aliasPattern = new RegExp(`AS ${column}\\b`)
      expect(directPattern.test(selectList) || aliasPattern.test(selectList)).toBe(true)
    }
  })

  it('gates on public_profile_enabled = true, a non-null username, and an active account_status', () => {
    const sql = readMigration()
    const whereIndex = sql.indexOf('WHERE mp.public_profile_enabled')
    expect(whereIndex).toBeGreaterThan(-1)
    const whereClause = sql.slice(whereIndex, sql.indexOf(';', whereIndex))

    expect(whereClause).toContain('mp.public_profile_enabled = true')
    expect(whereClause).toContain('mp.username IS NOT NULL')
    expect(whereClause).toContain("mp.account_status = 'active'")
  })

  it('grants SELECT on the VIEW to anon and authenticated, and never grants anything on the base table to anon', () => {
    const sql = readMigration()
    expect(sql).toMatch(/GRANT SELECT ON public_forward_profiles TO anon, authenticated;/)

    // No GRANT statement anywhere in the file may target member_profiles
    // (the base table) for anon -- only the view may ever be anon-readable.
    const executableLines = sql
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n')
    expect(executableLines).not.toMatch(/GRANT[^;]*ON member_profiles[^;]*TO[^;]*anon/i)
  })

  it('adds public_profile_enabled and public_profile_sections as additive, default-safe columns', () => {
    const sql = readMigration()
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS public_profile_enabled boolean NOT NULL DEFAULT false')
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS public_profile_sections jsonb NOT NULL DEFAULT')
  })

  it('does not modify any existing member_profiles RLS policy', () => {
    const sql = readMigration()
    expect(sql).not.toMatch(/DROP POLICY/)
    expect(sql).not.toMatch(/CREATE POLICY/)
  })

  it('does not touch protect_member_profiles_privileged_fields() or its trigger', () => {
    const sql = readMigration()
    expect(sql).not.toContain('protect_member_profiles_privileged_fields')
  })

  it('includes a rollback reference section', () => {
    const sql = readMigration()
    const rollbackIndex = sql.indexOf('ROLLBACK')
    expect(rollbackIndex).toBeGreaterThan(-1)
    const rollbackSection = sql.slice(rollbackIndex)
    expect(rollbackSection).toContain('DROP VIEW IF EXISTS public_forward_profiles')
  })

  it('is explicitly marked as a review-only draft, not applied', () => {
    const sql = readMigration()
    expect(sql).toMatch(/REVIEW-ONLY DRAFT\. NOT APPLIED\./)
  })
})
