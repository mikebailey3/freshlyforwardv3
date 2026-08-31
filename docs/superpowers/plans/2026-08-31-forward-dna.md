# Forward DNA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every member a Forward DNA page (`/forward-dna`) that surfaces their Career Compass result, lets them add Professional Scope and Responsibilities to specific roles, mark skills as claimed/demonstrated/supported, set target-role/timeframe career goals, and see an independent completeness score.

**Architecture:** Purely additive. Three new Supabase tables (`career_scope`, `career_responsibilities`, `career_skills`) keyed by a client-generated stable id added to each `EmploymentEntry`. Two new optional columns on `member_profiles` (`target_role`, `target_timeframe`). A new `lib/forwardDna/` module of small, pure/DI-testable functions mirroring the existing `lib/careerCompass/` pattern. A new page + 6 small components under `components/forwardDna/`. Nothing existing is modified except one small, deliberate DRY fix (see Task 7) and the new route/nav/dashboard-card wiring in Task 10.

**Tech Stack:** React + TypeScript + Vite + Tailwind + Supabase (Postgres/RLS/Auth), Vitest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-31-forward-dna-design.md`

## Global Constraints

- `search_readiness_score`, its DB trigger, the "search-ready" badge, and every admin/strategist page reading it are **not touched** by this plan. Forward DNA's completeness score is fully independent (spec section 2, section 6).
- No entitlement/plan gating on any new route or table — Forward DNA is available to every signed-in member (spec section 5).
- Route is flat: `/forward-dna`, not nested under `/dashboard/` (spec section 5).
- No AI/LLM calls anywhere in this plan (spec section 7).
- The existing `skills: string[]` column and `freshFitScore.ts` are not modified — `career_skills` is additive, backfilled once, coexisting (spec section 2, section 4).
- Every new Supabase table uses the exact RLS pattern already used everywhere else in this schema: `FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())`, no `anon`-role policy.
- Run `npx vitest run` and `npx tsc --noEmit` before every commit that touches TypeScript; both must be clean.

---

### Task 1: Migration — career_scope, career_responsibilities, career_skills, member_profiles columns

**Files:**
- Create: `supabase/migrations/20260831000000_forward_dna.sql`

**Interfaces:**
- Produces: tables `career_scope`, `career_responsibilities`, `career_skills`; columns `member_profiles.target_role`, `member_profiles.target_timeframe`. All later tasks depend on these exact table/column names.

- [ ] **Step 1: Write the migration**

```sql
/*
# ForwardOS Project 1 -- Forward DNA

## Overview
Adds structured storage for Professional Scope, Responsibilities, and
skill evidence states, per
docs/superpowers/specs/2026-08-31-forward-dna-design.md sections 4 and 6.
Also adds two optional structured career-goal columns to
member_profiles. This migration is purely additive: no existing table,
column, trigger, or policy is modified. member_profiles.search_readiness_score,
its "search-ready" badge trigger, and skills (text[]) are left completely
untouched -- see spec section 2 for why consolidation is explicitly deferred.

## employment_entry_id
employment_history is a jsonb array on member_profiles, not a table, so
there is no foreign key to reference. Each EmploymentEntry gains a
client-generated `id` field (backfilled lazily by
src/lib/forwardDna/employmentEntryIds.ts on first read/save). The new
tables below reference that id as plain text, matched at the
application layer -- there is no DB-level referential integrity to a
jsonb array element, an accepted trade-off since jsonb array elements
cannot be foreign-key targets in Postgres.

## New tables
- career_scope: revenue/team-size/budget metrics per employment entry.
- career_responsibilities: tags per employment entry.
- career_skills: claimed/demonstrated/supported evidence state per
  named skill. Coexists with the existing skills (text[]) column on
  member_profiles; a one-time client-side backfill
  (src/lib/forwardDna/skills.ts:syncSkillsFromProfile) copies any
  skill missing from this table in as `state = 'claimed'`.

## Security
All three tables follow the exact same RLS pattern as every other
member-owned table in this schema: FOR ALL TO authenticated USING
(user_id = auth.uid()) WITH CHECK (user_id = auth.uid()). No anon-role
policy exists on any of them -- Forward DNA is a signed-in-only feature.
*/

-- ============================================================
-- MEMBER_PROFILES: new optional structured career-goal columns
-- ============================================================
ALTER TABLE member_profiles
  ADD COLUMN IF NOT EXISTS target_role text,
  ADD COLUMN IF NOT EXISTS target_timeframe text;

-- ============================================================
-- CAREER_SCOPE
-- ============================================================
CREATE TABLE IF NOT EXISTS career_scope (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  employment_entry_id text NOT NULL,
  revenue_managed_cents bigint,
  team_size integer,
  budget_managed_cents bigint,
  direct_reports integer,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, employment_entry_id)
);

CREATE INDEX IF NOT EXISTS idx_career_scope_user ON career_scope(user_id);

ALTER TABLE career_scope ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "manage_own_career_scope" ON career_scope;
CREATE POLICY "manage_own_career_scope"
  ON career_scope FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION set_career_scope_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_career_scope_updated_at ON career_scope;
CREATE TRIGGER trg_career_scope_updated_at
  BEFORE UPDATE ON career_scope
  FOR EACH ROW EXECUTE FUNCTION set_career_scope_updated_at();

-- ============================================================
-- CAREER_RESPONSIBILITIES
-- ============================================================
CREATE TABLE IF NOT EXISTS career_responsibilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  employment_entry_id text NOT NULL,
  tag text NOT NULL,
  category text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_career_responsibilities_user ON career_responsibilities(user_id);
CREATE INDEX IF NOT EXISTS idx_career_responsibilities_entry ON career_responsibilities(user_id, employment_entry_id);

ALTER TABLE career_responsibilities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "manage_own_career_responsibilities" ON career_responsibilities;
CREATE POLICY "manage_own_career_responsibilities"
  ON career_responsibilities FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- CAREER_SKILLS
-- ============================================================
CREATE TABLE IF NOT EXISTS career_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  skill_name text NOT NULL,
  state text NOT NULL DEFAULT 'claimed' CHECK (state IN ('claimed', 'demonstrated', 'supported')),
  evidence_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, skill_name)
);

CREATE INDEX IF NOT EXISTS idx_career_skills_user ON career_skills(user_id);

ALTER TABLE career_skills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "manage_own_career_skills" ON career_skills;
CREATE POLICY "manage_own_career_skills"
  ON career_skills FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION set_career_skills_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_career_skills_updated_at ON career_skills;
CREATE TRIGGER trg_career_skills_updated_at
  BEFORE UPDATE ON career_skills
  FOR EACH ROW EXECUTE FUNCTION set_career_skills_updated_at();
```

- [ ] **Step 2: Manual review (no automated migration test harness in this repo, same as Career Compass Task 1)**

Verify by inspection: every table has RLS enabled, exactly one `FOR ALL TO authenticated` policy per table with matching `USING`/`WITH CHECK`, no `anon`-role policy anywhere, `updated_at` triggers use `SET search_path = public` (this exact convention was a cheap fix applied to the Career Compass migration in review — bake it in from the start this time), and the `ALTER TABLE member_profiles ADD COLUMN IF NOT EXISTS` lines do not touch any existing column.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260831000000_forward_dna.sql
git commit -m "feat: add Forward DNA schema (career_scope, career_responsibilities, career_skills)"
```

### Task 2: Types + employment-entry-id backfill helper

**Files:**
- Create: `src/types/forwardDna.ts`
- Modify: `src/types/index.ts` (the `EmploymentEntry` interface and the `MemberProfile` interface)
- Create: `src/lib/forwardDna/employmentEntryIds.ts`
- Test: `src/lib/forwardDna/employmentEntryIds.test.ts`

**Interfaces:**
- Consumes: nothing (foundation task).
- Produces: `EmploymentEntry.id?: string`; `MemberProfile.target_role: string | null`, `MemberProfile.target_timeframe: string | null`; types `CareerScope`, `CareerResponsibility`, `SkillState`, `CareerSkill`; functions `ensureEmploymentEntryIds(entries: EmploymentEntry[]): { entries: EmploymentEntry[]; changed: boolean }` and `ensureEmploymentEntryIdsForUser(userId: string, employmentHistory: EmploymentEntry[], client?: SupabaseClient): Promise<{ entries: EmploymentEntry[]; error: string | null }>`. Every later task that touches an employment entry relies on `entry.id` existing.

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/forwardDna/employmentEntryIds.test.ts
import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ensureEmploymentEntryIds, ensureEmploymentEntryIdsForUser } from './employmentEntryIds'
import type { EmploymentEntry } from '@/types'

function makeFakeClient(updateError: string | null = null) {
  const eqMock = vi.fn().mockResolvedValue({ error: updateError ? { message: updateError } : null })
  const updateMock = vi.fn().mockReturnValue({ eq: eqMock })
  const fromMock = vi.fn().mockReturnValue({ update: updateMock })
  return { client: { from: fromMock } as unknown as SupabaseClient, updateMock, eqMock, fromMock }
}

describe('ensureEmploymentEntryIds', () => {
  it('assigns an id to entries missing one and reports changed=true', () => {
    const entries: EmploymentEntry[] = [
      { company: 'Acme', title: 'Manager', start_date: '2020-01', end_date: null, current: true, description: '' },
    ]
    const { entries: result, changed } = ensureEmploymentEntryIds(entries)
    expect(changed).toBe(true)
    expect(result[0].id).toBeTruthy()
  })

  it('preserves existing ids and reports changed=false when nothing is missing', () => {
    const entries: EmploymentEntry[] = [
      { id: 'entry-123', company: 'Acme', title: 'Manager', start_date: '2020-01', end_date: null, current: true, description: '' },
    ]
    const { entries: result, changed } = ensureEmploymentEntryIds(entries)
    expect(changed).toBe(false)
    expect(result[0].id).toBe('entry-123')
  })
})

describe('ensureEmploymentEntryIdsForUser', () => {
  it('does not call update when no ids were missing', async () => {
    const { client, fromMock } = makeFakeClient()
    const entries: EmploymentEntry[] = [
      { id: 'entry-1', company: 'Acme', title: 'Manager', start_date: '2020-01', end_date: null, current: true, description: '' },
    ]
    await ensureEmploymentEntryIdsForUser('user-1', entries, client)
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('persists backfilled entries when ids were missing', async () => {
    const { client, fromMock, updateMock, eqMock } = makeFakeClient()
    const entries: EmploymentEntry[] = [
      { company: 'Acme', title: 'Manager', start_date: '2020-01', end_date: null, current: true, description: '' },
    ]
    const { entries: result, error } = await ensureEmploymentEntryIdsForUser('user-1', entries, client)
    expect(error).toBeNull()
    expect(result[0].id).toBeTruthy()
    expect(fromMock).toHaveBeenCalledWith('member_profiles')
    expect(updateMock).toHaveBeenCalledWith({ employment_history: result })
    expect(eqMock).toHaveBeenCalledWith('user_id', 'user-1')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/forwardDna/employmentEntryIds.test.ts`
Expected: FAIL with "Cannot find module './employmentEntryIds'"

- [ ] **Step 3: Add the new types**

```typescript
// src/types/forwardDna.ts
export interface CareerScope {
  id: string
  user_id: string
  employment_entry_id: string
  revenue_managed_cents: number | null
  team_size: number | null
  budget_managed_cents: number | null
  direct_reports: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface CareerResponsibility {
  id: string
  user_id: string
  employment_entry_id: string
  tag: string
  category: string | null
  created_at: string
}

export type SkillState = 'claimed' | 'demonstrated' | 'supported'

export interface CareerSkill {
  id: string
  user_id: string
  skill_name: string
  state: SkillState
  evidence_note: string | null
  created_at: string
  updated_at: string
}
```

- [ ] **Step 4: Add `id` to `EmploymentEntry` and the two new fields to `MemberProfile`**

In `src/types/index.ts`, change:

```typescript
export interface EmploymentEntry {
  company: string
  title: string
  start_date: string
  end_date: string | null
  current: boolean
  description: string
}
```

to:

```typescript
export interface EmploymentEntry {
  id?: string
  company: string
  title: string
  start_date: string
  end_date: string | null
  current: boolean
  description: string
}
```

And in the `MemberProfile` interface, add these two lines directly after the existing `biggest_challenge: string | null` field:

```typescript
  target_role: string | null
  target_timeframe: string | null
```

- [ ] **Step 5: Write the implementation**

```typescript
// src/lib/forwardDna/employmentEntryIds.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase as defaultClient } from '@/lib/supabase'
import type { EmploymentEntry } from '@/types'

/**
 * Generates a short, unique-enough id for a jsonb array element. Not
 * cryptographic -- it only needs to be unique within one member's own
 * employment history -- so Date.now() plus a random suffix is
 * sufficient and avoids depending on crypto.randomUUID() being present
 * in every runtime this code runs in (browsers and test environments).
 */
function generateEntryId(): string {
  return `entry-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/** Pure: returns entries with every missing `id` filled in, and whether anything changed. */
export function ensureEmploymentEntryIds(
  entries: EmploymentEntry[]
): { entries: EmploymentEntry[]; changed: boolean } {
  let changed = false
  const withIds = entries.map((entry) => {
    if (entry.id) return entry
    changed = true
    return { ...entry, id: generateEntryId() }
  })
  return { entries: withIds, changed }
}

/**
 * Backfills missing employment-entry ids for a user's employment_history
 * and persists them if anything changed. Idempotent -- safe to call on
 * every Forward DNA page load.
 */
export async function ensureEmploymentEntryIdsForUser(
  userId: string,
  employmentHistory: EmploymentEntry[],
  client: SupabaseClient = defaultClient
): Promise<{ entries: EmploymentEntry[]; error: string | null }> {
  const { entries, changed } = ensureEmploymentEntryIds(employmentHistory)
  if (!changed) return { entries, error: null }

  const { error } = await client
    .from('member_profiles')
    .update({ employment_history: entries })
    .eq('user_id', userId)

  return { entries, error: error?.message ?? null }
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/lib/forwardDna/employmentEntryIds.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 8: Commit**

```bash
git add src/types/forwardDna.ts src/types/index.ts src/lib/forwardDna/employmentEntryIds.ts src/lib/forwardDna/employmentEntryIds.test.ts
git commit -m "feat: add Forward DNA types and employment-entry-id backfill"
```

### Task 3: career_scope CRUD

**Files:**
- Create: `src/lib/forwardDna/scope.ts`
- Test: `src/lib/forwardDna/scope.test.ts`

**Interfaces:**
- Consumes: `CareerScope` from `@/types/forwardDna` (Task 2).
- Produces: `getAllScopeForUser(userId, client?): Promise<{ scope: CareerScope[]; error: string | null }>`, `upsertScope(userId, employmentEntryId, updates: CareerScopeUpdate, client?): Promise<{ error: string | null }>`, `dollarsToCents(value: string): number | null`, `centsToDollars(cents: number | null): string`. Task 8 (UI cards) and Task 9 (page) depend on these exact names.

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/forwardDna/scope.test.ts
import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getAllScopeForUser, upsertScope, dollarsToCents, centsToDollars } from './scope'

function makeFakeClient(opts: { scopeRows?: unknown[]; selectError?: string; upsertError?: string } = {}) {
  const eqMock = vi.fn().mockResolvedValue({
    data: opts.scopeRows ?? [],
    error: opts.selectError ? { message: opts.selectError } : null,
  })
  const selectMock = vi.fn().mockReturnValue({ eq: eqMock })
  const upsertMock = vi.fn().mockResolvedValue({ error: opts.upsertError ? { message: opts.upsertError } : null })
  const fromMock = vi.fn().mockReturnValue({ select: selectMock, upsert: upsertMock })
  return { client: { from: fromMock } as unknown as SupabaseClient, selectMock, eqMock, upsertMock, fromMock }
}

describe('getAllScopeForUser', () => {
  it('returns rows for the given user', async () => {
    const rows = [{ id: 's1', user_id: 'u1', employment_entry_id: 'e1' }]
    const { client, eqMock } = makeFakeClient({ scopeRows: rows })
    const { scope, error } = await getAllScopeForUser('u1', client)
    expect(error).toBeNull()
    expect(scope).toEqual(rows)
    expect(eqMock).toHaveBeenCalledWith('user_id', 'u1')
  })

  it('surfaces a select error', async () => {
    const { client } = makeFakeClient({ selectError: 'boom' })
    const { error } = await getAllScopeForUser('u1', client)
    expect(error).toBe('boom')
  })
})

describe('upsertScope', () => {
  it('upserts with the correct conflict target', async () => {
    const { client, upsertMock } = makeFakeClient()
    const { error } = await upsertScope('u1', 'e1', { team_size: 5 }, client)
    expect(error).toBeNull()
    expect(upsertMock).toHaveBeenCalledWith(
      { user_id: 'u1', employment_entry_id: 'e1', team_size: 5 },
      { onConflict: 'user_id,employment_entry_id' }
    )
  })
})

describe('dollarsToCents / centsToDollars', () => {
  it('round-trips a dollar amount', () => {
    expect(dollarsToCents('1500.50')).toBe(150050)
    expect(centsToDollars(150050)).toBe('1500.5')
  })

  it('treats empty input as null', () => {
    expect(dollarsToCents('')).toBeNull()
    expect(centsToDollars(null)).toBe('')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/forwardDna/scope.test.ts`
Expected: FAIL with "Cannot find module './scope'"

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/forwardDna/scope.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase as defaultClient } from '@/lib/supabase'
import type { CareerScope } from '@/types/forwardDna'

export async function getAllScopeForUser(
  userId: string,
  client: SupabaseClient = defaultClient
): Promise<{ scope: CareerScope[]; error: string | null }> {
  const { data, error } = await client.from('career_scope').select('*').eq('user_id', userId)
  return { scope: (data as CareerScope[]) ?? [], error: error?.message ?? null }
}

export type CareerScopeUpdate = Partial<
  Pick<CareerScope, 'revenue_managed_cents' | 'team_size' | 'budget_managed_cents' | 'direct_reports' | 'notes'>
>

export async function upsertScope(
  userId: string,
  employmentEntryId: string,
  updates: CareerScopeUpdate,
  client: SupabaseClient = defaultClient
): Promise<{ error: string | null }> {
  const { error } = await client
    .from('career_scope')
    .upsert(
      { user_id: userId, employment_entry_id: employmentEntryId, ...updates },
      { onConflict: 'user_id,employment_entry_id' }
    )
  return { error: error?.message ?? null }
}

/** Converts a dollar-amount input string to integer cents. Empty/invalid input -> null. */
export function dollarsToCents(value: string): number | null {
  if (!value) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null
}

/** Converts integer cents back to a plain dollar-amount string for an input field. */
export function centsToDollars(cents: number | null): string {
  return cents == null ? '' : (cents / 100).toString()
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/forwardDna/scope.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/forwardDna/scope.ts src/lib/forwardDna/scope.test.ts
git commit -m "feat: add career_scope CRUD"
```

### Task 4: career_responsibilities CRUD

**Files:**
- Create: `src/lib/forwardDna/responsibilities.ts`
- Test: `src/lib/forwardDna/responsibilities.test.ts`

**Interfaces:**
- Consumes: `CareerResponsibility` from `@/types/forwardDna` (Task 2).
- Produces: `getAllResponsibilitiesForUser(userId, client?): Promise<{ responsibilities: CareerResponsibility[]; error: string | null }>`, `addResponsibility(userId, employmentEntryId, tag, category, client?): Promise<{ error: string | null }>`, `removeResponsibility(responsibilityId, client?): Promise<{ error: string | null }>`. Tasks 8 and 9 depend on these exact names.

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/forwardDna/responsibilities.test.ts
import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getAllResponsibilitiesForUser, addResponsibility, removeResponsibility } from './responsibilities'

function makeFakeClient(opts: { rows?: unknown[]; error?: string } = {}) {
  const selectEq = vi.fn().mockResolvedValue({ data: opts.rows ?? [], error: opts.error ? { message: opts.error } : null })
  const selectMock = vi.fn().mockReturnValue({ eq: selectEq })
  const insertMock = vi.fn().mockResolvedValue({ error: opts.error ? { message: opts.error } : null })
  const deleteEq = vi.fn().mockResolvedValue({ error: opts.error ? { message: opts.error } : null })
  const deleteMock = vi.fn().mockReturnValue({ eq: deleteEq })
  const fromMock = vi.fn().mockReturnValue({ select: selectMock, insert: insertMock, delete: deleteMock })
  return { client: { from: fromMock } as unknown as SupabaseClient, selectEq, insertMock, deleteEq, deleteMock, fromMock }
}

describe('getAllResponsibilitiesForUser', () => {
  it('returns rows for the given user', async () => {
    const rows = [{ id: 'r1', tag: 'Managed budget' }]
    const { client } = makeFakeClient({ rows })
    const { responsibilities, error } = await getAllResponsibilitiesForUser('u1', client)
    expect(error).toBeNull()
    expect(responsibilities).toEqual(rows)
  })
})

describe('addResponsibility', () => {
  it('inserts a new tag', async () => {
    const { client, insertMock } = makeFakeClient()
    const { error } = await addResponsibility('u1', 'e1', 'Managed budget', null, client)
    expect(error).toBeNull()
    expect(insertMock).toHaveBeenCalledWith({ user_id: 'u1', employment_entry_id: 'e1', tag: 'Managed budget', category: null })
  })
})

describe('removeResponsibility', () => {
  it('deletes by id', async () => {
    const { client, deleteEq, deleteMock } = makeFakeClient()
    const { error } = await removeResponsibility('r1', client)
    expect(error).toBeNull()
    expect(deleteMock).toHaveBeenCalled()
    expect(deleteEq).toHaveBeenCalledWith('id', 'r1')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/forwardDna/responsibilities.test.ts`
Expected: FAIL with "Cannot find module './responsibilities'"

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/forwardDna/responsibilities.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase as defaultClient } from '@/lib/supabase'
import type { CareerResponsibility } from '@/types/forwardDna'

export async function getAllResponsibilitiesForUser(
  userId: string,
  client: SupabaseClient = defaultClient
): Promise<{ responsibilities: CareerResponsibility[]; error: string | null }> {
  const { data, error } = await client.from('career_responsibilities').select('*').eq('user_id', userId)
  return { responsibilities: (data as CareerResponsibility[]) ?? [], error: error?.message ?? null }
}

export async function addResponsibility(
  userId: string,
  employmentEntryId: string,
  tag: string,
  category: string | null,
  client: SupabaseClient = defaultClient
): Promise<{ error: string | null }> {
  const { error } = await client
    .from('career_responsibilities')
    .insert({ user_id: userId, employment_entry_id: employmentEntryId, tag, category })
  return { error: error?.message ?? null }
}

export async function removeResponsibility(
  responsibilityId: string,
  client: SupabaseClient = defaultClient
): Promise<{ error: string | null }> {
  const { error } = await client.from('career_responsibilities').delete().eq('id', responsibilityId)
  return { error: error?.message ?? null }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/forwardDna/responsibilities.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/forwardDna/responsibilities.ts src/lib/forwardDna/responsibilities.test.ts
git commit -m "feat: add career_responsibilities CRUD"
```

### Task 5: career_skills CRUD + flat-list backfill

**Files:**
- Create: `src/lib/forwardDna/skills.ts`
- Test: `src/lib/forwardDna/skills.test.ts`

**Interfaces:**
- Consumes: `CareerSkill`, `SkillState` from `@/types/forwardDna` (Task 2).
- Produces: `getSkillStates(userId, client?): Promise<{ skills: CareerSkill[]; error: string | null }>`, `upsertSkillState(userId, skillName, state, evidenceNote, client?): Promise<{ error: string | null }>`, `syncSkillsFromProfile(userId, flatSkills: string[], client?): Promise<{ error: string | null }>`. Tasks 8 and 9 depend on these exact names.

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/forwardDna/skills.test.ts
import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSkillStates, upsertSkillState, syncSkillsFromProfile } from './skills'

function makeFakeClient(opts: { existingSkills?: { skill_name: string }[]; error?: string } = {}) {
  const selectEq = vi.fn().mockResolvedValue({
    data: opts.existingSkills ?? [],
    error: opts.error ? { message: opts.error } : null,
  })
  const selectMock = vi.fn().mockReturnValue({ eq: selectEq })
  const upsertMock = vi.fn().mockResolvedValue({ error: opts.error ? { message: opts.error } : null })
  const fromMock = vi.fn().mockReturnValue({ select: selectMock, upsert: upsertMock })
  return { client: { from: fromMock } as unknown as SupabaseClient, selectEq, upsertMock, fromMock }
}

describe('getSkillStates', () => {
  it('returns rows for the given user', async () => {
    const { client } = makeFakeClient({ existingSkills: [{ skill_name: 'excel' }] })
    const { skills, error } = await getSkillStates('u1', client)
    expect(error).toBeNull()
    expect(skills).toEqual([{ skill_name: 'excel' }])
  })
})

describe('upsertSkillState', () => {
  it('upserts with the correct conflict target', async () => {
    const { client, upsertMock } = makeFakeClient()
    const { error } = await upsertSkillState('u1', 'excel', 'demonstrated', 'built quarterly reports', client)
    expect(error).toBeNull()
    expect(upsertMock).toHaveBeenCalledWith(
      { user_id: 'u1', skill_name: 'excel', state: 'demonstrated', evidence_note: 'built quarterly reports' },
      { onConflict: 'user_id,skill_name' }
    )
  })
})

describe('syncSkillsFromProfile', () => {
  it('inserts only skills missing from career_skills, as claimed', async () => {
    const { client, upsertMock } = makeFakeClient({ existingSkills: [{ skill_name: 'excel' }] })
    const { error } = await syncSkillsFromProfile('u1', ['excel', 'leadership'], client)
    expect(error).toBeNull()
    expect(upsertMock).toHaveBeenCalledWith(
      [{ user_id: 'u1', skill_name: 'leadership', state: 'claimed' }],
      { onConflict: 'user_id,skill_name', ignoreDuplicates: true }
    )
  })

  it('does nothing when every flat skill is already tracked', async () => {
    const { client, upsertMock } = makeFakeClient({ existingSkills: [{ skill_name: 'excel' }] })
    await syncSkillsFromProfile('u1', ['excel'], client)
    expect(upsertMock).not.toHaveBeenCalled()
  })

  it('does nothing when the flat skill list is empty', async () => {
    const { client, upsertMock } = makeFakeClient()
    await syncSkillsFromProfile('u1', [], client)
    expect(upsertMock).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/forwardDna/skills.test.ts`
Expected: FAIL with "Cannot find module './skills'"

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/forwardDna/skills.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase as defaultClient } from '@/lib/supabase'
import type { CareerSkill, SkillState } from '@/types/forwardDna'

export async function getSkillStates(
  userId: string,
  client: SupabaseClient = defaultClient
): Promise<{ skills: CareerSkill[]; error: string | null }> {
  const { data, error } = await client.from('career_skills').select('*').eq('user_id', userId)
  return { skills: (data as CareerSkill[]) ?? [], error: error?.message ?? null }
}

export async function upsertSkillState(
  userId: string,
  skillName: string,
  state: SkillState,
  evidenceNote: string | null,
  client: SupabaseClient = defaultClient
): Promise<{ error: string | null }> {
  const { error } = await client
    .from('career_skills')
    .upsert(
      { user_id: userId, skill_name: skillName, state, evidence_note: evidenceNote },
      { onConflict: 'user_id,skill_name' }
    )
  return { error: error?.message ?? null }
}

/**
 * One-time-per-visit backfill: any skill in the flat member_profiles.skills
 * list that isn't already tracked here gets inserted as 'claimed'. Existing
 * rows (any state) are left untouched -- this never downgrades a skill a
 * member already marked demonstrated/supported.
 */
export async function syncSkillsFromProfile(
  userId: string,
  flatSkills: string[],
  client: SupabaseClient = defaultClient
): Promise<{ error: string | null }> {
  if (flatSkills.length === 0) return { error: null }

  const { skills: existing, error: readError } = await getSkillStates(userId, client)
  if (readError) return { error: readError }

  const existingNames = new Set(existing.map((s) => s.skill_name))
  const missing = flatSkills.filter((name) => !existingNames.has(name))
  if (missing.length === 0) return { error: null }

  const { error } = await client
    .from('career_skills')
    .upsert(
      missing.map((skill_name) => ({ user_id: userId, skill_name, state: 'claimed' as SkillState })),
      { onConflict: 'user_id,skill_name', ignoreDuplicates: true }
    )

  return { error: error?.message ?? null }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/forwardDna/skills.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/forwardDna/skills.ts src/lib/forwardDna/skills.test.ts
git commit -m "feat: add career_skills CRUD and flat-list backfill"
```

### Task 6: Completeness scoring

**Files:**
- Create: `src/lib/forwardDna/completeness.ts`
- Test: `src/lib/forwardDna/completeness.test.ts`

**Interfaces:**
- Consumes: nothing (pure function, foundation for Task 7/9).
- Produces: `interface ForwardDnaCompletenessInput`, `calculateForwardDnaCompleteness(input: ForwardDnaCompletenessInput): { score: number; missing: { key: string; label: string }[] }`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/forwardDna/completeness.test.ts
import { describe, it, expect } from 'vitest'
import { calculateForwardDnaCompleteness } from './completeness'

const fullyComplete = {
  hasCareerCompassResult: true,
  hasScopeEntry: true,
  hasResponsibilityTag: true,
  hasSkillEvidenceBeyondClaimed: true,
  hasEducationOrCertifications: true,
  hasTargetRoleAndTimeframe: true,
}

describe('calculateForwardDnaCompleteness', () => {
  it('scores 100 when every signal is present', () => {
    const { score, missing } = calculateForwardDnaCompleteness(fullyComplete)
    expect(score).toBe(100)
    expect(missing).toEqual([])
  })

  it('scores 0 and lists every check when nothing is present', () => {
    const { score, missing } = calculateForwardDnaCompleteness({
      hasCareerCompassResult: false,
      hasScopeEntry: false,
      hasResponsibilityTag: false,
      hasSkillEvidenceBeyondClaimed: false,
      hasEducationOrCertifications: false,
      hasTargetRoleAndTimeframe: false,
    })
    expect(score).toBe(0)
    expect(missing).toHaveLength(6)
  })

  it('lists only the missing checks for a partial profile', () => {
    const { missing } = calculateForwardDnaCompleteness({ ...fullyComplete, hasScopeEntry: false })
    expect(missing).toEqual([{ key: 'hasScopeEntry', label: 'Professional scope on at least one role' }])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/forwardDna/completeness.test.ts`
Expected: FAIL with "Cannot find module './completeness'"

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/forwardDna/completeness.ts
export interface ForwardDnaCompletenessInput {
  hasCareerCompassResult: boolean
  hasScopeEntry: boolean
  hasResponsibilityTag: boolean
  hasSkillEvidenceBeyondClaimed: boolean
  hasEducationOrCertifications: boolean
  hasTargetRoleAndTimeframe: boolean
}

interface CompletenessCheck {
  key: keyof ForwardDnaCompletenessInput
  label: string
  weight: number
}

const completenessChecks: CompletenessCheck[] = [
  { key: 'hasCareerCompassResult', label: 'Career Compass result', weight: 20 },
  { key: 'hasScopeEntry', label: 'Professional scope on at least one role', weight: 20 },
  { key: 'hasResponsibilityTag', label: 'Responsibilities on at least one role', weight: 15 },
  { key: 'hasSkillEvidenceBeyondClaimed', label: 'At least one skill with evidence', weight: 15 },
  { key: 'hasEducationOrCertifications', label: 'Education or certifications', weight: 15 },
  { key: 'hasTargetRoleAndTimeframe', label: 'Career goal target role and timeframe', weight: 15 },
]

export function calculateForwardDnaCompleteness(
  input: ForwardDnaCompletenessInput
): { score: number; missing: { key: string; label: string }[] } {
  let earned = 0
  let total = 0
  const missing: { key: string; label: string }[] = []

  for (const check of completenessChecks) {
    total += check.weight
    if (input[check.key]) {
      earned += check.weight
    } else {
      missing.push({ key: check.key, label: check.label })
    }
  }

  return { score: Math.round((earned / total) * 100), missing }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/forwardDna/completeness.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/forwardDna/completeness.ts src/lib/forwardDna/completeness.test.ts
git commit -m "feat: add Forward DNA completeness scoring"
```

### Task 7: Extract ARCHETYPE_LABELS (DRY fix) + CompassSummaryCard + CompletenessWidget

**Files:**
- Modify: `src/lib/careerCompass/archetypeEngine.ts` (add and export `ARCHETYPE_LABELS`)
- Modify: `src/pages/DashboardPage.tsx` (remove its local `ARCHETYPE_LABELS` copy, import the shared one instead)
- Create: `src/components/forwardDna/CompassSummaryCard.tsx`
- Create: `src/components/forwardDna/CompletenessWidget.tsx`
- Test: `src/components/forwardDna/CompassSummaryCard.test.tsx`
- Test: `src/components/forwardDna/CompletenessWidget.test.tsx`

**Interfaces:**
- Consumes: `ArchetypeKey` from `@/types/careerCompass`; `calculateForwardDnaCompleteness`, `ForwardDnaCompletenessInput` from `@/lib/forwardDna/completeness` (Task 6); `CircularProgress` from `@/components/CircularProgress`.
- Produces: `ARCHETYPE_LABELS: Record<ArchetypeKey, string>` exported from `@/lib/careerCompass`; components `CompassSummaryCard({ result })` and `CompletenessWidget({ input })`. Task 9 (page assembly) consumes both.

**Why this DRY fix belongs here:** `DashboardPage.tsx` already defines `ARCHETYPE_LABELS` locally, with a comment admitting it duplicates `ARCHETYPE_COPY` in `CareerCompassResultsPage.tsx`. `CompassSummaryCard` needs the exact same label map. Adding a third copy would be an obvious violation caught in any review — so this task moves the existing `DashboardPage` copy to a shared location instead of duplicating it again. `CareerCompassResultsPage.tsx`'s richer `ARCHETYPE_COPY` (which includes full descriptive paragraphs, not just short labels) is untouched — out of scope, don't over-reach.

- [ ] **Step 1: Move ARCHETYPE_LABELS into archetypeEngine.ts**

Append to the end of `src/lib/careerCompass/archetypeEngine.ts`:

```typescript
// Short display labels for each archetype. Shared by DashboardPage and
// ForwardDnaPage's CompassSummaryCard so there is exactly one place
// this mapping lives (previously duplicated locally in DashboardPage.tsx).
export const ARCHETYPE_LABELS: Record<ArchetypeKey, string> = {
  driver: 'Driver',
  connector: 'Connector',
  strategist: 'Strategist',
  builder: 'Builder',
  explorer: 'Explorer',
  creator: 'Creator',
}
```

(`ArchetypeKey` is already imported in this file for the existing scoring functions; if it is not, add `import type { ArchetypeKey } from '@/types/careerCompass'` to the top of the file.) This is already re-exported by the existing `export * from './archetypeEngine'` line in `src/lib/careerCompass/index.ts` — no barrel change needed.

- [ ] **Step 2: Remove the duplicate from DashboardPage.tsx and import the shared one**

In `src/pages/DashboardPage.tsx`, remove this block:

```typescript
// Display labels mirror ARCHETYPE_COPY in CareerCompassResultsPage.tsx --
// keep wording identical if that file's labels ever change.
const ARCHETYPE_LABELS: Record<ArchetypeKey, string> = {
  driver: 'Driver',
  connector: 'Connector',
  strategist: 'Strategist',
  builder: 'Builder',
  explorer: 'Explorer',
  creator: 'Creator',
}
```

and add this import near the other `@/lib/careerCompass`-adjacent imports at the top of the file:

```typescript
import { ARCHETYPE_LABELS } from '@/lib/careerCompass'
```

- [ ] **Step 3: Run the existing dashboard test to confirm no regression**

Run: `npx vitest run src/pages/DashboardPage.test.tsx`
Expected: PASS, unchanged (this is a pure source-of-constant move, no behavior change)

- [ ] **Step 4: Write the failing tests for the two new components**

```typescript
// src/components/forwardDna/CompassSummaryCard.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CompassSummaryCard } from './CompassSummaryCard'

describe('CompassSummaryCard', () => {
  it('shows the primary archetype and barrier when a result exists', () => {
    render(
      <MemoryRouter>
        <CompassSummaryCard result={{ primary_archetype: 'driver', primary_barrier: 'resume_positioning' }} />
      </MemoryRouter>
    )
    expect(screen.getByText('Driver')).toBeInTheDocument()
    expect(screen.getByText(/resume_positioning/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View full results' })).toHaveAttribute('href', '/career-compass/results')
  })

  it('shows a call-to-action when no result exists yet', () => {
    render(
      <MemoryRouter>
        <CompassSummaryCard result={null} />
      </MemoryRouter>
    )
    expect(screen.getByRole('link', { name: 'Take the free assessment' })).toHaveAttribute('href', '/career-compass')
  })
})
```

```typescript
// src/components/forwardDna/CompletenessWidget.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CompletenessWidget } from './CompletenessWidget'

const fullyComplete = {
  hasCareerCompassResult: true,
  hasScopeEntry: true,
  hasResponsibilityTag: true,
  hasSkillEvidenceBeyondClaimed: true,
  hasEducationOrCertifications: true,
  hasTargetRoleAndTimeframe: true,
}

describe('CompletenessWidget', () => {
  it('shows no missing items when everything is complete', () => {
    render(<CompletenessWidget input={fullyComplete} />)
    expect(screen.queryByText('Professional scope on at least one role')).not.toBeInTheDocument()
  })

  it('lists specific missing items for a partial profile', () => {
    render(<CompletenessWidget input={{ ...fullyComplete, hasScopeEntry: false }} />)
    expect(screen.getByText('Professional scope on at least one role')).toBeInTheDocument()
  })
})
```

- [ ] **Step 5: Run tests to verify they fail**

Run: `npx vitest run src/components/forwardDna/`
Expected: FAIL with "Cannot find module './CompassSummaryCard'" / "Cannot find module './CompletenessWidget'"

- [ ] **Step 6: Write the implementations**

```typescript
// src/components/forwardDna/CompassSummaryCard.tsx
import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { ARCHETYPE_LABELS } from '@/lib/careerCompass'
import type { ArchetypeKey } from '@/types/careerCompass'

interface CompassSummaryCardProps {
  result: { primary_archetype: ArchetypeKey; primary_barrier: string } | null
}

export function CompassSummaryCard({ result }: CompassSummaryCardProps) {
  return (
    <div className="border border-neutral-200 bg-white p-6">
      <div className="flex items-center gap-2">
        <Compass className="h-5 w-5 text-primary-600" />
        <h3 className="font-serif text-base font-semibold text-neutral-900">Career Compass</h3>
      </div>
      {result ? (
        <div className="mt-3">
          <p className="text-sm text-neutral-700">
            Primary archetype: <span className="font-semibold">{ARCHETYPE_LABELS[result.primary_archetype]}</span>
          </p>
          <p className="mt-1 text-sm text-neutral-700">Primary barrier: {result.primary_barrier}</p>
          <Link to="/career-compass/results" className="mt-2 inline-block text-xs font-medium text-primary-600 hover:underline">
            View full results
          </Link>
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-sm text-neutral-600">You haven't taken the Career Compass yet.</p>
          <Link
            to="/career-compass"
            className="mt-2 inline-block rounded-full bg-primary-600 px-4 py-2 text-xs font-semibold text-white hover:bg-primary-700"
          >
            Take the free assessment
          </Link>
        </div>
      )}
    </div>
  )
}
```

```typescript
// src/components/forwardDna/CompletenessWidget.tsx
import { CircularProgress } from '@/components/CircularProgress'
import { calculateForwardDnaCompleteness } from '@/lib/forwardDna/completeness'
import type { ForwardDnaCompletenessInput } from '@/lib/forwardDna/completeness'

export function CompletenessWidget({ input }: { input: ForwardDnaCompletenessInput }) {
  const { score, missing } = calculateForwardDnaCompleteness(input)

  return (
    <div className="border border-neutral-200 bg-white p-6">
      <h3 className="font-serif text-base font-semibold text-neutral-900">Forward DNA Completeness</h3>
      <p className="mt-1 text-xs text-neutral-500">How complete your professional intelligence profile is.</p>
      <div className="mt-6 flex items-center justify-center">
        <CircularProgress value={score} size={128} strokeWidth={8} />
      </div>
      {missing.length > 0 && (
        <ul className="mt-6 space-y-2">
          {missing.map((item) => (
            <li key={item.key} className="text-sm text-neutral-600">{item.label}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run src/components/forwardDna/`
Expected: PASS (4 tests)

- [ ] **Step 8: Type-check and full suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no type errors, full suite green

- [ ] **Step 9: Commit**

```bash
git add src/lib/careerCompass/archetypeEngine.ts src/pages/DashboardPage.tsx src/components/forwardDna/CompassSummaryCard.tsx src/components/forwardDna/CompletenessWidget.tsx src/components/forwardDna/CompassSummaryCard.test.tsx src/components/forwardDna/CompletenessWidget.test.tsx
git commit -m "feat: add Forward DNA summary/completeness widgets, dedupe ARCHETYPE_LABELS"
```

### Task 8: Interactive edit cards — Scope, Responsibilities, Skills, Career Goals

**Files:**
- Create: `src/components/forwardDna/CareerScopeCard.tsx`
- Create: `src/components/forwardDna/ResponsibilitiesCard.tsx`
- Create: `src/components/forwardDna/SkillEvidenceCard.tsx`
- Create: `src/components/forwardDna/CareerGoalsCard.tsx`
- Test: `src/components/forwardDna/CareerScopeCard.test.tsx`
- Test: `src/components/forwardDna/ResponsibilitiesCard.test.tsx`
- Test: `src/components/forwardDna/SkillEvidenceCard.test.tsx`
- Test: `src/components/forwardDna/CareerGoalsCard.test.tsx`

**Interfaces:**
- Consumes: `EmploymentEntry`, `MemberProfile` from `@/types`; `CareerScope`, `CareerResponsibility`, `CareerSkill`, `SkillState` from `@/types/forwardDna`; `dollarsToCents`, `centsToDollars` from `@/lib/forwardDna/scope` (Task 3).
- Produces: components `CareerScopeCard({ entries, scope, onSave })`, `ResponsibilitiesCard({ entries, responsibilities, onAdd, onRemove })`, `SkillEvidenceCard({ skills, onChangeState })`, `CareerGoalsCard({ profile, onSaveTargets })`. Task 9 (page assembly) wires all four to the CRUD functions from Tasks 3-5.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/components/forwardDna/CareerScopeCard.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CareerScopeCard } from './CareerScopeCard'

const entries = [{ id: 'e1', company: 'Acme', title: 'Ops Manager', start_date: '2020-01', end_date: null, current: true, description: '' }]

describe('CareerScopeCard', () => {
  it('renders one row per employment entry and pre-fills existing scope', () => {
    render(
      <CareerScopeCard
        entries={entries}
        scope={[{ id: 's1', user_id: 'u1', employment_entry_id: 'e1', revenue_managed_cents: 150050, team_size: 5, budget_managed_cents: null, direct_reports: 2, notes: null, created_at: '', updated_at: '' }]}
        onSave={vi.fn()}
      />
    )
    expect(screen.getByText('Ops Manager — Acme')).toBeInTheDocument()
    expect(screen.getByDisplayValue('5')).toBeInTheDocument()
    expect(screen.getByDisplayValue('1500.5')).toBeInTheDocument()
  })

  it('calls onSave with parsed values when Save is clicked', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<CareerScopeCard entries={entries} scope={[]} onSave={onSave} />)
    fireEvent.change(screen.getByLabelText('Team size'), { target: { value: '10' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledWith('e1', expect.objectContaining({ team_size: 10 }))
  })
})
```

```typescript
// src/components/forwardDna/ResponsibilitiesCard.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ResponsibilitiesCard } from './ResponsibilitiesCard'

const entries = [{ id: 'e1', company: 'Acme', title: 'Ops Manager', start_date: '2020-01', end_date: null, current: true, description: '' }]

describe('ResponsibilitiesCard', () => {
  it('renders existing tags and calls onAdd for a new one', () => {
    const onAdd = vi.fn().mockResolvedValue(undefined)
    render(
      <ResponsibilitiesCard
        entries={entries}
        responsibilities={[{ id: 'r1', user_id: 'u1', employment_entry_id: 'e1', tag: 'Managed budget', category: null, created_at: '' }]}
        onAdd={onAdd}
        onRemove={vi.fn()}
      />
    )
    expect(screen.getByText('Managed budget')).toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText('Add a responsibility'), { target: { value: 'Hired staff' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(onAdd).toHaveBeenCalledWith('e1', 'Hired staff')
  })

  it('calls onRemove when a tag is removed', () => {
    const onRemove = vi.fn()
    render(
      <ResponsibilitiesCard
        entries={entries}
        responsibilities={[{ id: 'r1', user_id: 'u1', employment_entry_id: 'e1', tag: 'Managed budget', category: null, created_at: '' }]}
        onAdd={vi.fn()}
        onRemove={onRemove}
      />
    )
    fireEvent.click(screen.getByLabelText('Remove Managed budget'))
    expect(onRemove).toHaveBeenCalledWith('r1')
  })
})
```

```typescript
// src/components/forwardDna/SkillEvidenceCard.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SkillEvidenceCard } from './SkillEvidenceCard'

describe('SkillEvidenceCard', () => {
  it('highlights the current state and calls onChangeState when a new one is picked', () => {
    const onChangeState = vi.fn().mockResolvedValue(undefined)
    render(
      <SkillEvidenceCard
        skills={[{ id: 'k1', user_id: 'u1', skill_name: 'excel', state: 'claimed', evidence_note: null, created_at: '', updated_at: '' }]}
        onChangeState={onChangeState}
      />
    )
    expect(screen.getByText('excel')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Demonstrated' }))
    expect(onChangeState).toHaveBeenCalledWith('excel', 'demonstrated')
  })
})
```

```typescript
// src/components/forwardDna/CareerGoalsCard.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CareerGoalsCard } from './CareerGoalsCard'
import type { MemberProfile } from '@/types'

const baseProfile = { career_goals: 'Become a VP', target_role: null, target_timeframe: null } as MemberProfile

describe('CareerGoalsCard', () => {
  it('shows the existing free-text career goal and calls onSaveTargets with new field values', () => {
    const onSaveTargets = vi.fn().mockResolvedValue(undefined)
    render(
      <MemoryRouter>
        <CareerGoalsCard profile={baseProfile} onSaveTargets={onSaveTargets} />
      </MemoryRouter>
    )
    expect(screen.getByText(/Become a VP/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Target role'), { target: { value: 'VP of Operations' } })
    fireEvent.change(screen.getByLabelText('Target timeframe'), { target: { value: 'within 12 months' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSaveTargets).toHaveBeenCalledWith('VP of Operations', 'within 12 months')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/forwardDna/CareerScopeCard.test.tsx src/components/forwardDna/ResponsibilitiesCard.test.tsx src/components/forwardDna/SkillEvidenceCard.test.tsx src/components/forwardDna/CareerGoalsCard.test.tsx`
Expected: FAIL, modules not found

- [ ] **Step 3: Write the implementations**

```typescript
// src/components/forwardDna/CareerScopeCard.tsx
import { useState } from 'react'
import type { EmploymentEntry } from '@/types'
import type { CareerScope } from '@/types/forwardDna'
import { dollarsToCents, centsToDollars } from '@/lib/forwardDna/scope'
import type { CareerScopeUpdate } from '@/lib/forwardDna/scope'

interface CareerScopeCardProps {
  entries: EmploymentEntry[]
  scope: CareerScope[]
  onSave: (employmentEntryId: string, updates: CareerScopeUpdate) => Promise<void>
}

export function CareerScopeCard({ entries, scope, onSave }: CareerScopeCardProps) {
  return (
    <div className="border border-neutral-200 bg-white p-6">
      <h3 className="font-serif text-base font-semibold text-neutral-900">Professional Scope</h3>
      <p className="mt-1 text-xs text-neutral-500">The scale of what you've managed in each role.</p>
      <div className="mt-4 space-y-4">
        {entries.map((entry) => (
          <ScopeRow key={entry.id} entry={entry} existing={scope.find((s) => s.employment_entry_id === entry.id)} onSave={onSave} />
        ))}
      </div>
    </div>
  )
}

function ScopeRow({
  entry,
  existing,
  onSave,
}: {
  entry: EmploymentEntry
  existing: CareerScope | undefined
  onSave: CareerScopeCardProps['onSave']
}) {
  const [revenue, setRevenue] = useState(centsToDollars(existing?.revenue_managed_cents ?? null))
  const [budget, setBudget] = useState(centsToDollars(existing?.budget_managed_cents ?? null))
  const [teamSize, setTeamSize] = useState(existing?.team_size?.toString() ?? '')
  const [directReports, setDirectReports] = useState(existing?.direct_reports?.toString() ?? '')
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!entry.id) return
    setSaving(true)
    await onSave(entry.id, {
      revenue_managed_cents: dollarsToCents(revenue),
      budget_managed_cents: dollarsToCents(budget),
      team_size: teamSize ? Number(teamSize) : null,
      direct_reports: directReports ? Number(directReports) : null,
      notes: notes || null,
    })
    setSaving(false)
  }

  return (
    <div className="border-l-2 border-primary-200 pl-4">
      <p className="text-sm font-semibold text-neutral-900">{entry.title} — {entry.company}</p>
      <div className="mt-2 grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-semibold text-neutral-500">Revenue managed ($)</span>
          <input type="text" value={revenue} onChange={(e) => setRevenue(e.target.value)} className="mt-1 w-full border border-neutral-300 px-3 py-2 text-sm" />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-neutral-500">Budget managed ($)</span>
          <input type="text" value={budget} onChange={(e) => setBudget(e.target.value)} className="mt-1 w-full border border-neutral-300 px-3 py-2 text-sm" />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-neutral-500">Team size</span>
          <input type="number" min="0" value={teamSize} onChange={(e) => setTeamSize(e.target.value)} className="mt-1 w-full border border-neutral-300 px-3 py-2 text-sm" />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-neutral-500">Direct reports</span>
          <input type="number" min="0" value={directReports} onChange={(e) => setDirectReports(e.target.value)} className="mt-1 w-full border border-neutral-300 px-3 py-2 text-sm" />
        </label>
      </div>
      <label className="mt-2 block">
        <span className="text-xs font-semibold text-neutral-500">Notes</span>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 w-full border border-neutral-300 px-3 py-2 text-sm" rows={2} />
      </label>
      <button onClick={handleSave} disabled={saving} className="mt-2 rounded-full bg-primary-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
        {saving ? 'Saving\u2026' : 'Save'}
      </button>
    </div>
  )
}
```

```typescript
// src/components/forwardDna/ResponsibilitiesCard.tsx
import { useState } from 'react'
import { X } from 'lucide-react'
import type { EmploymentEntry } from '@/types'
import type { CareerResponsibility } from '@/types/forwardDna'

interface ResponsibilitiesCardProps {
  entries: EmploymentEntry[]
  responsibilities: CareerResponsibility[]
  onAdd: (employmentEntryId: string, tag: string) => Promise<void>
  onRemove: (responsibilityId: string) => Promise<void>
}

export function ResponsibilitiesCard({ entries, responsibilities, onAdd, onRemove }: ResponsibilitiesCardProps) {
  return (
    <div className="border border-neutral-200 bg-white p-6">
      <h3 className="font-serif text-base font-semibold text-neutral-900">Responsibilities</h3>
      <p className="mt-1 text-xs text-neutral-500">What you were actually responsible for in each role.</p>
      <div className="mt-4 space-y-4">
        {entries.map((entry) => (
          <ResponsibilityRow key={entry.id} entry={entry} tags={responsibilities.filter((r) => r.employment_entry_id === entry.id)} onAdd={onAdd} onRemove={onRemove} />
        ))}
      </div>
    </div>
  )
}

function ResponsibilityRow({
  entry,
  tags,
  onAdd,
  onRemove,
}: {
  entry: EmploymentEntry
  tags: CareerResponsibility[]
  onAdd: ResponsibilitiesCardProps['onAdd']
  onRemove: ResponsibilitiesCardProps['onRemove']
}) {
  const [newTag, setNewTag] = useState('')

  const handleAdd = async () => {
    if (!entry.id || !newTag.trim()) return
    await onAdd(entry.id, newTag.trim())
    setNewTag('')
  }

  return (
    <div className="border-l-2 border-primary-200 pl-4">
      <p className="text-sm font-semibold text-neutral-900">{entry.title} — {entry.company}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span key={tag.id} className="flex items-center gap-1 border border-primary-300 px-2.5 py-1 font-mono text-xs text-primary-700">
            {tag.tag}
            <button onClick={() => onRemove(tag.id)} aria-label={`Remove ${tag.tag}`}>
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input type="text" value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="Add a responsibility" className="flex-1 border border-neutral-300 px-3 py-1.5 text-sm" />
        <button onClick={handleAdd} className="rounded-full bg-primary-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-primary-700">
          Add
        </button>
      </div>
    </div>
  )
}
```

```typescript
// src/components/forwardDna/SkillEvidenceCard.tsx
import { useState } from 'react'
import type { CareerSkill, SkillState } from '@/types/forwardDna'

const STATE_LABELS: Record<SkillState, string> = {
  claimed: 'Claimed',
  demonstrated: 'Demonstrated',
  supported: 'Supported',
}

const STATE_ORDER: SkillState[] = ['claimed', 'demonstrated', 'supported']

interface SkillEvidenceCardProps {
  skills: CareerSkill[]
  onChangeState: (skillName: string, state: SkillState) => Promise<void>
}

export function SkillEvidenceCard({ skills, onChangeState }: SkillEvidenceCardProps) {
  return (
    <div className="border border-neutral-200 bg-white p-6">
      <h3 className="font-serif text-base font-semibold text-neutral-900">Skills</h3>
      <p className="mt-1 text-xs text-neutral-500">
        Claimed = you say you have it. Demonstrated = you've used it on the job. Supported = a strategist or reference has backed it up.
      </p>
      <div className="mt-4 space-y-3">
        {skills.map((skill) => (
          <SkillRow key={skill.id} skill={skill} onChangeState={onChangeState} />
        ))}
      </div>
    </div>
  )
}

function SkillRow({ skill, onChangeState }: { skill: CareerSkill; onChangeState: SkillEvidenceCardProps['onChangeState'] }) {
  const [saving, setSaving] = useState(false)

  const handleChange = async (state: SkillState) => {
    setSaving(true)
    await onChangeState(skill.skill_name, state)
    setSaving(false)
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 pb-2">
      <span className="font-mono text-sm font-medium text-primary-700">{skill.skill_name}</span>
      <div className="flex gap-1">
        {STATE_ORDER.map((state) => (
          <button
            key={state}
            disabled={saving}
            onClick={() => handleChange(state)}
            className={`px-2.5 py-1 text-xs font-semibold ${skill.state === state ? 'bg-primary-600 text-white' : 'border border-neutral-300 text-neutral-600 hover:border-primary-300'}`}
          >
            {STATE_LABELS[state]}
          </button>
        ))}
      </div>
    </div>
  )
}
```

```typescript
// src/components/forwardDna/CareerGoalsCard.tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { MemberProfile } from '@/types'

interface CareerGoalsCardProps {
  profile: MemberProfile
  onSaveTargets: (targetRole: string, targetTimeframe: string) => Promise<void>
}

export function CareerGoalsCard({ profile, onSaveTargets }: CareerGoalsCardProps) {
  const [targetRole, setTargetRole] = useState(profile.target_role ?? '')
  const [targetTimeframe, setTargetTimeframe] = useState(profile.target_timeframe ?? '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await onSaveTargets(targetRole, targetTimeframe)
    setSaving(false)
  }

  return (
    <div className="border border-neutral-200 bg-white p-6">
      <h3 className="font-serif text-base font-semibold text-neutral-900">Career Goals</h3>
      <p className="mt-1 text-xs text-neutral-500">
        {profile.career_goals || 'No career goals recorded yet.'}{' '}
        <Link to="/profile?edit=1&focus=goals" className="text-primary-600 hover:underline">
          Edit in Career Profile
        </Link>
      </p>
      <div className="mt-4 space-y-3">
        <label className="block">
          <span className="text-xs font-semibold text-neutral-500">Target role</span>
          <input type="text" value={targetRole} onChange={(e) => setTargetRole(e.target.value)} className="mt-1 w-full border border-neutral-300 px-3 py-2 text-sm" />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-neutral-500">Target timeframe</span>
          <input type="text" value={targetTimeframe} onChange={(e) => setTargetTimeframe(e.target.value)} placeholder="e.g. within 12 months" className="mt-1 w-full border border-neutral-300 px-3 py-2 text-sm" />
        </label>
        <button onClick={handleSave} disabled={saving} className="rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
          {saving ? 'Saving\u2026' : 'Save'}
        </button>
      </div>
    </div>
  )
}
```

Note: the `<label>` + `<span>` + `<input>` pattern above associates each label with its input implicitly (the `<input>` is a descendant of the `<label>`), which is what makes `getByLabelText('Team size')` etc. work in the tests above without needing explicit `htmlFor`/`id` pairs.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/forwardDna/CareerScopeCard.test.tsx src/components/forwardDna/ResponsibilitiesCard.test.tsx src/components/forwardDna/SkillEvidenceCard.test.tsx src/components/forwardDna/CareerGoalsCard.test.tsx`
Expected: PASS (6 tests)

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add src/components/forwardDna/CareerScopeCard.tsx src/components/forwardDna/ResponsibilitiesCard.tsx src/components/forwardDna/SkillEvidenceCard.tsx src/components/forwardDna/CareerGoalsCard.tsx src/components/forwardDna/CareerScopeCard.test.tsx src/components/forwardDna/ResponsibilitiesCard.test.tsx src/components/forwardDna/SkillEvidenceCard.test.tsx src/components/forwardDna/CareerGoalsCard.test.tsx
git commit -m "feat: add Forward DNA interactive edit cards"
```

### Task 9: Assemble ForwardDnaPage

**Files:**
- Create: `src/pages/ForwardDnaPage.tsx`
- Test: `src/pages/ForwardDnaPage.test.tsx`

**Interfaces:**
- Consumes: everything from Tasks 2-8 (`ensureEmploymentEntryIdsForUser`, `getAllScopeForUser`/`upsertScope`, `getAllResponsibilitiesForUser`/`addResponsibility`/`removeResponsibility`, `getSkillStates`/`upsertSkillState`/`syncSkillsFromProfile`, `calculateForwardDnaCompleteness`'s consumer `CompletenessWidget`, `CompassSummaryCard`, `CareerScopeCard`, `ResponsibilitiesCard`, `SkillEvidenceCard`, `CareerGoalsCard`); `useAuth` from `@/context/AuthContext`; `ensureProfile` from `@/lib/profile`; `MemberLayout` from `@/components/MemberLayout`.
- Produces: `export function ForwardDnaPage()`. Task 10 imports this into `App.tsx`.

**Note on layout:** `ForwardDnaPage` wraps its own content in `<MemberLayout>`, matching the convention every existing page component follows (`CareerProfilePage`, `DashboardPage`, `RoadmapPage`, etc. all self-wrap). Task 10's route will deliberately *not* additionally wrap it in `MemberLayout` — see Task 10's note on the pre-existing systemic double-wrap found during planning.

- [ ] **Step 1: Write the failing test**

```typescript
// src/pages/ForwardDnaPage.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ForwardDnaPage } from './ForwardDnaPage'

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1' },
    profile: { employment_history: [], education: [], certifications: [], skills: [], target_role: null, target_timeframe: null, career_goals: null },
    refreshProfile: vi.fn(),
  }),
}))

vi.mock('@/lib/profile', () => ({
  ensureProfile: vi.fn().mockResolvedValue({ employment_history: [], education: [], certifications: [], skills: [], target_role: null, target_timeframe: null, career_goals: null }),
}))

vi.mock('@/lib/forwardDna/employmentEntryIds', () => ({
  ensureEmploymentEntryIdsForUser: vi.fn().mockResolvedValue({ entries: [], error: null }),
}))

vi.mock('@/lib/forwardDna/scope', () => ({
  getAllScopeForUser: vi.fn().mockResolvedValue({ scope: [], error: null }),
  upsertScope: vi.fn().mockResolvedValue({ error: null }),
  dollarsToCents: (v: string) => (v ? Number(v) * 100 : null),
  centsToDollars: (c: number | null) => (c == null ? '' : String(c / 100)),
}))

vi.mock('@/lib/forwardDna/responsibilities', () => ({
  getAllResponsibilitiesForUser: vi.fn().mockResolvedValue({ responsibilities: [], error: null }),
  addResponsibility: vi.fn().mockResolvedValue({ error: null }),
  removeResponsibility: vi.fn().mockResolvedValue({ error: null }),
}))

vi.mock('@/lib/forwardDna/skills', () => ({
  getSkillStates: vi.fn().mockResolvedValue({ skills: [], error: null }),
  upsertSkillState: vi.fn().mockResolvedValue({ error: null }),
  syncSkillsFromProfile: vi.fn().mockResolvedValue({ error: null }),
}))

const maybeSingleMock = vi.fn().mockResolvedValue({ data: null, error: null })
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock }) }) }),
      update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
    }),
  },
}))

describe('ForwardDnaPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders the page title and every section once data loads', async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: null })
    render(
      <MemoryRouter>
        <ForwardDnaPage />
      </MemoryRouter>
    )
    await waitFor(() => expect(screen.getByText('Forward DNA')).toBeInTheDocument())
    expect(screen.getByText('Professional Scope')).toBeInTheDocument()
    expect(screen.getByText('Responsibilities')).toBeInTheDocument()
    expect(screen.getByText('Skills')).toBeInTheDocument()
    expect(screen.getByText('Career Goals')).toBeInTheDocument()
    expect(screen.getByText('Forward DNA Completeness')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/ForwardDnaPage.test.tsx`
Expected: FAIL with "Cannot find module './ForwardDnaPage'"

- [ ] **Step 3: Write the implementation**

```typescript
// src/pages/ForwardDnaPage.tsx
import { useEffect, useState, useCallback } from 'react'
import { MemberLayout } from '@/components/MemberLayout'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { ensureProfile } from '@/lib/profile'
import { ensureEmploymentEntryIdsForUser } from '@/lib/forwardDna/employmentEntryIds'
import { getAllScopeForUser, upsertScope } from '@/lib/forwardDna/scope'
import type { CareerScopeUpdate } from '@/lib/forwardDna/scope'
import { getAllResponsibilitiesForUser, addResponsibility, removeResponsibility } from '@/lib/forwardDna/responsibilities'
import { getSkillStates, upsertSkillState, syncSkillsFromProfile } from '@/lib/forwardDna/skills'
import type { SkillState } from '@/types/forwardDna'
import { CompassSummaryCard } from '@/components/forwardDna/CompassSummaryCard'
import { CareerScopeCard } from '@/components/forwardDna/CareerScopeCard'
import { ResponsibilitiesCard } from '@/components/forwardDna/ResponsibilitiesCard'
import { SkillEvidenceCard } from '@/components/forwardDna/SkillEvidenceCard'
import { CareerGoalsCard } from '@/components/forwardDna/CareerGoalsCard'
import { CompletenessWidget } from '@/components/forwardDna/CompletenessWidget'
import { Loader2 } from 'lucide-react'
import type { MemberProfile, EmploymentEntry } from '@/types'
import type { CareerScope, CareerResponsibility, CareerSkill } from '@/types/forwardDna'
import type { ArchetypeKey } from '@/types/careerCompass'

interface CompassSummary {
  primary_archetype: ArchetypeKey
  primary_barrier: string
}

export function ForwardDnaPage() {
  const { user, refreshProfile } = useAuth()
  const [profile, setProfile] = useState<MemberProfile | null>(null)
  const [entries, setEntries] = useState<EmploymentEntry[]>([])
  const [scope, setScope] = useState<CareerScope[]>([])
  const [responsibilities, setResponsibilities] = useState<CareerResponsibility[]>([])
  const [skills, setSkills] = useState<CareerSkill[]>([])
  const [compassResult, setCompassResult] = useState<CompassSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    let cancelled = false

    const load = async () => {
      const p = (await ensureProfile(user.id)) as MemberProfile | null
      if (!p || cancelled) return
      setProfile(p)

      const { entries: idEntries } = await ensureEmploymentEntryIdsForUser(user.id, p.employment_history || [])
      if (cancelled) return
      setEntries(idEntries)

      await syncSkillsFromProfile(user.id, p.skills || [])

      const [scopeRes, respRes, skillsRes, compassRes] = await Promise.all([
        getAllScopeForUser(user.id),
        getAllResponsibilitiesForUser(user.id),
        getSkillStates(user.id),
        supabase
          .from('career_compass_results')
          .select('primary_archetype, primary_barrier')
          .eq('user_id', user.id)
          .eq('is_current', true)
          .maybeSingle(),
      ])

      if (cancelled) return
      setScope(scopeRes.scope)
      setResponsibilities(respRes.responsibilities)
      setSkills(skillsRes.skills)
      setCompassResult((compassRes.data as CompassSummary | null) ?? null)
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [user])

  const handleSaveScope = useCallback(
    async (employmentEntryId: string, updates: CareerScopeUpdate) => {
      if (!user) return
      await upsertScope(user.id, employmentEntryId, updates)
      const { scope: refreshed } = await getAllScopeForUser(user.id)
      setScope(refreshed)
    },
    [user]
  )

  const handleAddResponsibility = useCallback(
    async (employmentEntryId: string, tag: string) => {
      if (!user) return
      await addResponsibility(user.id, employmentEntryId, tag, null)
      const { responsibilities: refreshed } = await getAllResponsibilitiesForUser(user.id)
      setResponsibilities(refreshed)
    },
    [user]
  )

  const handleRemoveResponsibility = useCallback(
    async (responsibilityId: string) => {
      if (!user) return
      await removeResponsibility(responsibilityId)
      const { responsibilities: refreshed } = await getAllResponsibilitiesForUser(user.id)
      setResponsibilities(refreshed)
    },
    [user]
  )

  const handleChangeSkillState = useCallback(
    async (skillName: string, state: SkillState) => {
      if (!user) return
      const existing = skills.find((s) => s.skill_name === skillName)
      await upsertSkillState(user.id, skillName, state, existing?.evidence_note ?? null)
      const { skills: refreshed } = await getSkillStates(user.id)
      setSkills(refreshed)
    },
    [user, skills]
  )

  const handleSaveTargets = useCallback(
    async (targetRole: string, targetTimeframe: string) => {
      if (!user) return
      await supabase
        .from('member_profiles')
        .update({ target_role: targetRole || null, target_timeframe: targetTimeframe || null })
        .eq('user_id', user.id)
      await refreshProfile()
    },
    [user, refreshProfile]
  )

  if (loading || !profile) {
    return (
      <MemberLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      </MemberLayout>
    )
  }

  return (
    <MemberLayout>
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-semibold text-neutral-900 sm:text-3xl">Forward DNA</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Your complete professional intelligence profile — not a resume, the real thing underneath it.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <CompassSummaryCard result={compassResult} />
          <CareerScopeCard entries={entries} scope={scope} onSave={handleSaveScope} />
          <ResponsibilitiesCard entries={entries} responsibilities={responsibilities} onAdd={handleAddResponsibility} onRemove={handleRemoveResponsibility} />
          <SkillEvidenceCard skills={skills} onChangeState={handleChangeSkillState} />
          <CareerGoalsCard profile={profile} onSaveTargets={handleSaveTargets} />
        </div>
        <div>
          <CompletenessWidget
            input={{
              hasCareerCompassResult: !!compassResult,
              hasScopeEntry: scope.length > 0,
              hasResponsibilityTag: responsibilities.length > 0,
              hasSkillEvidenceBeyondClaimed: skills.some((s) => s.state !== 'claimed'),
              hasEducationOrCertifications: (profile.education?.length ?? 0) > 0 || (profile.certifications?.length ?? 0) > 0,
              hasTargetRoleAndTimeframe: !!profile.target_role && !!profile.target_timeframe,
            }}
          />
        </div>
      </div>
    </MemberLayout>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/pages/ForwardDnaPage.test.tsx`
Expected: PASS (1 test)

- [ ] **Step 5: Type-check and full suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no type errors, full suite green

- [ ] **Step 6: Commit**

```bash
git add src/pages/ForwardDnaPage.tsx src/pages/ForwardDnaPage.test.tsx
git commit -m "feat: assemble ForwardDnaPage"
```

### Task 10: Routing, nav, dashboard card

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/MemberLayout.tsx`
- Modify: `src/pages/DashboardPage.tsx`
- Test: `src/pages/DashboardPage.test.tsx` (add one new test)

**Interfaces:**
- Consumes: `ForwardDnaPage` from Task 9.
- Produces: route `/forward-dna`; nav item in `MemberLayout`; dashboard teaser card.

**Note on the double-`MemberLayout` finding:** while planning this task, every single existing member route was found to wrap its page element in `<MemberLayout>` at the `App.tsx` route level (e.g. `<MemberLayout><CareerProfilePage /></MemberLayout>`) even though every page component *also* wraps itself in `<MemberLayout>` internally — a systemic double-wrap across all ~24 existing member routes. That is a pre-existing issue, far too broad to fix as part of this plan, and is being flagged separately, not fixed here. This task's new route deliberately does **not** replicate it: `ForwardDnaPage` already self-wraps (Task 9), so the route below wraps only in `ProtectedRoute`, not `MemberLayout` again.

- [ ] **Step 1: Add the route**

In `src/App.tsx`, add this import near the `CareerProfilePage` import:

```typescript
import { ForwardDnaPage } from '@/pages/ForwardDnaPage'
```

And add this route directly after the existing `/profile` route block:

```tsx
<Route
  path="/forward-dna"
  element={
    <ProtectedRoute>
      <ForwardDnaPage />
    </ProtectedRoute>
  }
/>
```

- [ ] **Step 2: Add the nav item**

In `src/components/MemberLayout.tsx`, add `Dna` to the existing `lucide-react` import list:

```typescript
import {
  Compass, LayoutDashboard, User, CreditCard, Calendar, MessageSquare,
  Sparkles, Menu, X, LogOut, Search, FileText, Briefcase,
  Bell, Settings, Activity, Award, FileText as FileTextIcon,
  Lock, Video, Map, ChevronDown, Linkedin, Dna,
} from 'lucide-react'
```

Then add a new entry to the `'My Search'` nav group, directly after the Career Profile item:

```typescript
{ to: '/profile', label: 'Career Profile', icon: User, feature: 'career_profile' },
{ to: '/forward-dna', label: 'Forward DNA', icon: Dna, isNew: true },
```

(No `feature`/`requiredPlan` on the new item — Forward DNA is available to every member, confirmed with user during design.)

- [ ] **Step 3: Add the dashboard teaser card**

In `src/pages/DashboardPage.tsx`, add this block directly after the closing `</div>` of the existing "Career Compass" card (the block ending with the `Start Now` link), before the next section:

```tsx
{/* Forward DNA */}
<div className="mt-6 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
  <div className="flex items-center justify-between">
    <h2 className="font-display text-base font-semibold text-neutral-900">Forward DNA</h2>
  </div>
  <div className="mt-4 flex items-center justify-between gap-3">
    <div>
      <p className="text-sm font-medium text-neutral-900">Your professional intelligence profile</p>
      <p className="mt-1 text-xs text-neutral-500">
        Career history, scope, responsibilities, skills, and goals — the real profile behind your resume.
      </p>
    </div>
    <Link
      to="/forward-dna"
      className="flex-shrink-0 rounded-full bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
    >
      Open
    </Link>
  </div>
</div>
```

This is a deliberately cheap, static teaser (no extra data fetching on the dashboard) — the live completeness score and all interactive editing live on `/forward-dna` itself, consistent with the "no dashboard redesign" constraint carried over from the Career Compass spec.

- [ ] **Step 4: Add a dashboard regression test**

In `src/pages/DashboardPage.test.tsx`, add:

```typescript
it('always shows the Forward DNA teaser card', async () => {
  render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>
  )
  await waitFor(() => expect(screen.getByText('Your professional intelligence profile')).toBeInTheDocument())
  expect(screen.getByRole('link', { name: 'Open' })).toHaveAttribute('href', '/forward-dna')
})
```

(Add this inside the existing `describe('DashboardPage - Career Compass card', ...)` block or as a sibling `describe` — match whatever wrapping/rendering setup that file's existing tests already use for `DashboardPage`, since this test needs the same mocked providers/router context.)

- [ ] **Step 5: Run the full suite and type-check**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no type errors, full suite green, including the new dashboard test and the existing Career Compass dashboard tests (unaffected)

- [ ] **Step 6: Manual route smoke check**

Run: `npm run dev` (or the project's existing dev-server command), sign in as a test member, navigate to `/forward-dna` directly and via the new nav item and the new dashboard card. Confirm the sidebar/header render exactly once (not doubled) — this is the concrete proof that avoiding the double-`MemberLayout` wrap for this new route was correct.

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx src/components/MemberLayout.tsx src/pages/DashboardPage.tsx src/pages/DashboardPage.test.tsx
git commit -m "feat: wire Forward DNA route, nav item, and dashboard card"
```

---

## Self-Review Notes (completed during plan authoring)

**Spec coverage:** Career Compass connection → Task 9/Task 7 (`CompassSummaryCard`). Career History → read directly via `entries` in Task 9, no new storage. Professional Scope → Tasks 1/3/8. Responsibilities → Tasks 1/4/8. Skills/evidence → Tasks 1/5/8. Education/Credentials → read directly from `profile` in Task 9 (spec explicitly says CONNECT, no new UI beyond what `CareerProfilePage` already renders). Career Goals → Tasks 2/8 (`target_role`/`target_timeframe`) plus existing free-text display. Completeness → Tasks 6/7/9. Routing/nav/dashboard → Task 10. `search_readiness_score` left untouched → verified no task modifies it. No AI calls → verified no task introduces one.

**Placeholder scan:** every step above contains complete, runnable code; no "TBD"/"similar to Task N"/"add appropriate handling" language.

**Type consistency check:** `CareerScopeUpdate` (Task 3) is the exact type threaded through `CareerScopeCard`'s `onSave` prop (Task 8) and `ForwardDnaPage`'s `handleSaveScope` (Task 9) — same name, same shape, no renaming drift. `SkillState` (Task 2) is used identically in `skills.ts` (Task 5), `SkillEvidenceCard` (Task 8), and `ForwardDnaPage` (Task 9). `EmploymentEntry.id` (Task 2) is consumed identically by `CareerScopeCard`/`ResponsibilitiesCard` (Task 8) and `ForwardDnaPage` (Task 9).
