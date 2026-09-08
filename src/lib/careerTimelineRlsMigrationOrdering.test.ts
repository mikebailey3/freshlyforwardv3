import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

function stripSqlComments(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n')
}

// Static, repo-side guard for the migration-order dependency between the
// Roadmap RPC and the career_timeline reserved event-type RLS hardening.
//
// Live-audit finding (2026-09-08): public.add_roadmap_milestone does NOT
// currently exist in the live FreshlyForward Supabase project (confirmed via
// a direct pg_proc query returning zero rows). The RLS hardening migration's
// entire safety argument depends on that RPC already existing and having
// been smoke-tested live -- see the "DEPLOYMENT PREREQUISITE" comment block
// at the top of the RLS migration file itself.
//
// This test cannot verify live deployment state or live RLS/ownership
// behavior (no Supabase access from this sandbox -- see the other tests in
// this directory for the same caveat). It only guards the one thing a
// repo-only test can: that the RPC migration's filename continues to sort
// strictly before the RLS hardening migration's filename (so a standard
// chronological `supabase db push` would still create the RPC before
// tightening the policies that depend on it), and that no other migration
// file sitting between them touches career_timeline or add_roadmap_milestone
// in a way that could interfere.

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations')
const RPC_MIGRATION_FILENAME = '20260907000000_add_roadmap_milestone_rpc.sql'
const RLS_MIGRATION_FILENAME = '20260908010000_career_timeline_reserved_event_type_rls.sql'

describe('career_timeline RLS hardening migration ordering (static, repo-only -- see file header for the live deployment prerequisite)', () => {
  it('the Roadmap RPC migration file exists and defines add_roadmap_milestone as SECURITY DEFINER', () => {
    const content = readFileSync(join(MIGRATIONS_DIR, RPC_MIGRATION_FILENAME), 'utf-8')
    expect(content).toContain('CREATE OR REPLACE FUNCTION public.add_roadmap_milestone')
    expect(content).toContain('SECURITY DEFINER')
    expect(content).toContain("SET search_path = ''")
  })

  it('the RPC migration filename sorts strictly before the RLS hardening migration filename', () => {
    // Supabase applies migrations in filename-sorted (timestamp-prefixed)
    // order. Plain string comparison matches that ordering exactly, since
    // both filenames share the same YYYYMMDDHHMMSS_ prefix format.
    expect(RPC_MIGRATION_FILENAME < RLS_MIGRATION_FILENAME).toBe(true)
  })

  it('no migration file sorting between the RPC and RLS-hardening migrations touches career_timeline or add_roadmap_milestone', () => {
    const allFilenames = readdirSync(MIGRATIONS_DIR)
      .filter((name) => name.endsWith('.sql'))
      .sort()

    const rpcIndex = allFilenames.indexOf(RPC_MIGRATION_FILENAME)
    const rlsIndex = allFilenames.indexOf(RLS_MIGRATION_FILENAME)
    expect(rpcIndex).toBeGreaterThanOrEqual(0)
    expect(rlsIndex).toBeGreaterThan(rpcIndex)

    const filesInBetween = allFilenames.slice(rpcIndex + 1, rlsIndex)

    for (const filename of filesInBetween) {
      const executableSql = stripSqlComments(readFileSync(join(MIGRATIONS_DIR, filename), 'utf-8'))
      // Deliberately scoped to executable SQL only, not prose. A migration
      // is free to *mention* add_roadmap_milestone or career_timeline in a
      // /* ... */ or -- comment (e.g. documenting that it reviewed an
      // unrelated migration's conventions) without that being real
      // interference -- confirmed by manual review that
      // 20260908000000_career_vault.sql does exactly this in its header.
      // Only actual DDL/DML referencing these identifiers would be a real
      // ordering hazard.
      expect(executableSql).not.toContain('add_roadmap_milestone')
      expect(executableSql).not.toContain('career_timeline')
    }
  })

  it('the RLS hardening migration documents the live-audit deployment prerequisite explicitly', () => {
    const content = readFileSync(join(MIGRATIONS_DIR, RLS_MIGRATION_FILENAME), 'utf-8')
    expect(content).toContain('DEPLOYMENT PREREQUISITE')
    expect(content).toContain('DO NOT APPLY THIS MIGRATION STANDALONE')
    expect(content).toContain('add_roadmap_milestone')
  })
})
