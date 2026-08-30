# Career Compass Persistence & Anonymous Session — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the (already-merged, pure) Career Compass scoring engines a
persistence layer: two Supabase tables, a testable session module for
starting/resuming/saving/completing an assessment as either an anonymous
visitor or a signed-in member, and the "claim" wiring that attaches an
anonymous visitor's answers to their account the moment they sign in —
without ever losing data or blocking signup if the claim fails.

**Architecture:** One SQL migration following this repo's existing
migration conventions (see `supabase/migrations/20260821000000_opportunity_engine.sql`
for the header-comment + RLS style to match), plus one new pure-ish module
`src/lib/careerCompass/session.ts` that takes the Supabase client as an
injectable parameter (defaulting to the real singleton) specifically so it
is unit-testable with a hand-built fake client — no `vi.mock` module
interception needed, no network, no real database required to run the
test suite.

**Tech Stack:** TypeScript, Supabase (Postgres + RLS), Vitest (already
configured, no new dependencies).

**Spec:** `docs/superpowers/specs/2026-08-29-career-compass-design.md`
(section 8: Data Model; section 10: Risks — the anonymous-RLS trade-off
this plan implements is pre-approved there, not a new decision).

**Depends on (already merged):** `src/types/careerCompass.ts`,
`src/lib/careerCompass/{scoring,archetypeEngine,readinessEngine,recommendationEngine}.ts`.

## Global Constraints

- No new npm dependencies.
- No emojis in code, comments, or commit messages.
- This plan does NOT touch UI, routing, or the dashboard — that's the next
  follow-on plan. Do not create any page or component files here.
- A claim failure must never throw or block signin/signup — every
  `session.ts` function returns `{ error: string | null, ... }` rather
  than throwing, and the caller in `AuthContext` treats claiming as
  fire-and-forget best-effort.
- The anonymous session id is a random UUID, generated client-side, never
  placed in a URL, never logged, stored under one fixed `localStorage` key.
- Follow this repo's existing migration conventions exactly: header
  comment block explaining purpose/tables/security, `CREATE TABLE IF NOT
  EXISTS`, indexes, `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`, and
  `DROP POLICY IF EXISTS` before every `CREATE POLICY` (idempotent,
  re-runnable — matches every existing migration in `supabase/migrations/`).
- `session.ts` functions accept the Supabase client as their last
  parameter, defaulting to the real singleton import from `@/lib/supabase`
  — this is the one deliberate architectural choice in this plan (no
  precedent either way exists yet in this codebase) made specifically so
  tests never need `vi.mock` chain-hoisting gymnastics.

---

## Task 1: Supabase Migration — Assessment & Results Tables

**Files:**
- Create: `supabase/migrations/20260830000000_career_compass_assessment_system.sql`

**Interfaces:**
- Produces: `career_compass_assessments` and `career_compass_results`
  tables — Task 2's `session.ts` is the only code that queries them.

This is a SQL-only task. This repo has no local Supabase test harness
(no other migration in this repo has an automated test) — the
verification step is a careful self-review against the checklist below,
matching how every prior migration in this repo was verified.

- [ ] **Step 1: Write the migration**

```sql
/*
# Career Compass Assessment System

## Overview
Adds persistence for the Career Compass free assessment (Archetype +
Forward Readiness) described in
docs/superpowers/specs/2026-08-29-career-compass-design.md section 8.
Supports a logged-out visitor starting and completing the assessment
before ever creating an account, then "claiming" that work the moment
they sign up -- without losing any answers.

## New Tables

### `career_compass_assessments`
The raw answer state for one assessment attempt. `user_id` starts NULL
for anonymous visitors and is populated by the claim operation on
signup; `anonymous_session_id` is kept permanently (even after
claiming) as an audit trail of where the assessment originated.

### `career_compass_results`
The computed, scored output of a completed assessment (dimension
scores, archetype, readiness, barriers, plan recommendation). Supports
retakes: multiple result rows can exist per user, but only one may have
`is_current = true` at a time (enforced by a partial unique index).
Anonymous users have exactly one active assessment in V1, so the
`is_current` uniqueness constraint is scoped to authenticated
(`user_id IS NOT NULL`) rows only.

## Security (see spec section 8 & 10 for the full risk writeup)
Every score is calculated client-side by the pure functions in
`src/lib/careerCompass/`; these tables only ever store already-computed
results plus the raw answers needed to allow a retake/resume. Nothing
here executes AI calls or reaches an external API.

Two access patterns coexist on both tables, by necessity: a signed-out
visitor (Supabase `anon` role, no `auth.uid()`) manages their own
unclaimed row via a client-held `anonymous_session_id`; a signed-in
member (`authenticated` role) manages rows where `user_id = auth.uid()`.
This is inherently weaker than pure `auth.uid()`-scoped RLS -- anyone who
obtained the anonymous session id could read that one row -- accepted per
spec section 10 because the id is an unguessable random UUID that is
never placed in a URL or logged. A third, narrow policy on each table
lets a freshly authenticated user attach their own uid to a
still-unclaimed row (the one-time "claim" operation performed right
after signup) -- this is the only path by which `user_id` ever changes
from NULL to non-NULL.
*/

-- ============================================================
-- CAREER_COMPASS_ASSESSMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS career_compass_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  anonymous_session_id text,
  version text NOT NULL DEFAULT '1.0',
  archetype_answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  readiness_answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (user_id IS NOT NULL OR anonymous_session_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_career_compass_assessments_user ON career_compass_assessments(user_id);
CREATE INDEX IF NOT EXISTS idx_career_compass_assessments_anon_session ON career_compass_assessments(anonymous_session_id);

ALTER TABLE career_compass_assessments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_manage_own_anonymous_assessment" ON career_compass_assessments;
CREATE POLICY "anon_manage_own_anonymous_assessment"
  ON career_compass_assessments FOR ALL
  TO anon
  USING (user_id IS NULL AND anonymous_session_id IS NOT NULL)
  WITH CHECK (user_id IS NULL AND anonymous_session_id IS NOT NULL);

DROP POLICY IF EXISTS "authenticated_manage_own_assessment" ON career_compass_assessments;
CREATE POLICY "authenticated_manage_own_assessment"
  ON career_compass_assessments FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "authenticated_claim_anonymous_assessment" ON career_compass_assessments;
CREATE POLICY "authenticated_claim_anonymous_assessment"
  ON career_compass_assessments FOR UPDATE
  TO authenticated
  USING (user_id IS NULL AND anonymous_session_id IS NOT NULL)
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION set_career_compass_assessments_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_career_compass_assessments_updated_at ON career_compass_assessments;
CREATE TRIGGER trg_career_compass_assessments_updated_at
  BEFORE UPDATE ON career_compass_assessments
  FOR EACH ROW EXECUTE FUNCTION set_career_compass_assessments_updated_at();

-- ============================================================
-- CAREER_COMPASS_RESULTS
-- ============================================================
CREATE TABLE IF NOT EXISTS career_compass_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES career_compass_assessments(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  is_current boolean NOT NULL DEFAULT true,
  dimension_scores jsonb NOT NULL,
  archetype_scores jsonb NOT NULL,
  primary_archetype text NOT NULL,
  secondary_archetype text NOT NULL,
  readiness_scores jsonb NOT NULL,
  primary_barrier text NOT NULL,
  secondary_barrier text NOT NULL,
  recommended_plan_slug text,
  service_fit_pct integer NOT NULL DEFAULT 0 CHECK (service_fit_pct BETWEEN 0 AND 100),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_career_compass_results_assessment ON career_compass_results(assessment_id);
CREATE INDEX IF NOT EXISTS idx_career_compass_results_user ON career_compass_results(user_id);

-- Only one *authenticated* member may have a single "current" result at a
-- time (spec section 8). Anonymous rows (user_id IS NULL) are exempt --
-- V1 supports exactly one active anonymous assessment per browser anyway,
-- enforced at the application layer, not the database layer.
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_current_result_per_user
  ON career_compass_results(user_id)
  WHERE is_current = true AND user_id IS NOT NULL;

ALTER TABLE career_compass_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_manage_own_anonymous_result" ON career_compass_results;
CREATE POLICY "anon_manage_own_anonymous_result"
  ON career_compass_results FOR ALL
  TO anon
  USING (user_id IS NULL)
  WITH CHECK (user_id IS NULL);

DROP POLICY IF EXISTS "authenticated_manage_own_result" ON career_compass_results;
CREATE POLICY "authenticated_manage_own_result"
  ON career_compass_results FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "authenticated_claim_anonymous_result" ON career_compass_results;
CREATE POLICY "authenticated_claim_anonymous_result"
  ON career_compass_results FOR UPDATE
  TO authenticated
  USING (user_id IS NULL)
  WITH CHECK (user_id = auth.uid());
```

- [ ] **Step 2: Self-review against this checklist**

- [ ] Every `CREATE TABLE` uses `IF NOT EXISTS` (idempotent, re-runnable)
- [ ] Every `CREATE POLICY` is preceded by a matching `DROP POLICY IF EXISTS`
- [ ] `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` present on both tables
- [ ] No policy allows `anon` to ever set `user_id` to a non-null value
      (only the `authenticated_claim_*` policies can move `user_id` from
      NULL to `auth.uid()`, and only for their own uid)
- [ ] The partial unique index is scoped to `user_id IS NOT NULL` only
- [ ] No raw SQL string concatenation, no dynamic table/column names
- [ ] File name's timestamp sorts after every existing migration in
      `supabase/migrations/` (confirm via `dir supabase\migrations` —
      the last existing file is `20260823000000_linkedin_optimizer.sql`)

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260830000000_career_compass_assessment_system.sql
git commit -m "feat(career-compass): add assessment and results persistence migration"
```

---

## Task 2: Session Module (start/resume/save/complete/claim)

**Files:**
- Create: `src/lib/careerCompass/session.ts`
- Create: `src/lib/careerCompass/session.test.ts`

**Interfaces:**
- Consumes: `ArchetypeAnswers`, `ReadinessAnswers`, `ArchetypeResult`,
  `ReadinessResult`, `PlanRecommendation` from `@/types/careerCompass`
  (already merged); `supabase` from `@/lib/supabase`; `SupabaseClient`
  type from `@supabase/supabase-js`.
- Produces: `getOrCreateAnonymousSessionId`, `removeAnonymousSessionId`,
  `startOrResumeAssessment`, `saveAssessmentAnswers`,
  `completeAssessment`, `claimAnonymousAssessment` — Task 3
  (`AuthContext`) calls `claimAnonymousAssessment` and
  `removeAnonymousSessionId` directly; a later UI plan calls the rest.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/careerCompass/session.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getOrCreateAnonymousSessionId,
  removeAnonymousSessionId,
  startOrResumeAssessment,
  saveAssessmentAnswers,
  completeAssessment,
  claimAnonymousAssessment,
} from './session'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ArchetypeResult, ReadinessResult, PlanRecommendation } from '@/types/careerCompass'

// A minimal fake Storage (localStorage-shaped) for the anonymous-id tests.
function makeFakeStorage(): Storage {
  const map = new Map<string, string>()
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => { map.set(key, value) },
    removeItem: (key: string) => { map.delete(key) },
    clear: () => map.clear(),
    key: () => null,
    length: 0,
  } as Storage
}

// A minimal fake Supabase query builder: every chain method returns the
// same builder (for fluent chaining), and the builder itself is thenable
// so `await client.from(...).update(...).eq(...)` resolves even when no
// terminal method like .single()/.maybeSingle() is called.
function makeBuilder(response: { data: unknown; error: { message: string } | null }) {
  const builder: Record<string, unknown> = {
    select: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    is: vi.fn(() => builder),
    in: vi.fn(() => builder),
    maybeSingle: vi.fn(() => Promise.resolve(response)),
    single: vi.fn(() => Promise.resolve(response)),
    then: (resolve: (value: typeof response) => unknown) => Promise.resolve(response).then(resolve),
  }
  return builder
}

function makeFakeClient(fromImpl: (table: string) => Record<string, unknown>): SupabaseClient {
  return { from: vi.fn(fromImpl) } as unknown as SupabaseClient
}

describe('getOrCreateAnonymousSessionId', () => {
  it('creates and persists a new id when none exists', () => {
    const storage = makeFakeStorage()
    const id = getOrCreateAnonymousSessionId(storage)
    expect(id).toBeTruthy()
    expect(storage.getItem('ff_career_compass_anon_session_id')).toBe(id)
  })

  it('returns the existing id on a second call instead of generating a new one', () => {
    const storage = makeFakeStorage()
    const first = getOrCreateAnonymousSessionId(storage)
    const second = getOrCreateAnonymousSessionId(storage)
    expect(second).toBe(first)
  })
})

describe('removeAnonymousSessionId', () => {
  it('clears the stored id', () => {
    const storage = makeFakeStorage()
    getOrCreateAnonymousSessionId(storage)
    removeAnonymousSessionId(storage)
    expect(storage.getItem('ff_career_compass_anon_session_id')).toBeNull()
  })
})

describe('startOrResumeAssessment', () => {
  it('returns an error when given neither a user id nor an anonymous session id', async () => {
    const client = makeFakeClient(() => makeBuilder({ data: null, error: null }))
    const result = await startOrResumeAssessment({ userId: null, anonymousSessionId: null }, client)
    expect('error' in result).toBe(true)
  })

  it('resumes an existing in-progress assessment instead of creating a new one', async () => {
    const existingRow = { id: 'assess-1', archetype_answers: { q1: 3 }, readiness_answers: {} }
    const client = makeFakeClient(() => makeBuilder({ data: existingRow, error: null }))
    const result = await startOrResumeAssessment({ userId: 'user-1', anonymousSessionId: null }, client)
    expect(result).toEqual({ assessmentId: 'assess-1', archetypeAnswers: { q1: 3 }, readinessAnswers: {} })
  })

  it('creates a new assessment when none is in progress', async () => {
    let call = 0
    const client = makeFakeClient(() => {
      call += 1
      return call === 1
        ? makeBuilder({ data: null, error: null }) // select found nothing
        : makeBuilder({ data: { id: 'new-assess' }, error: null }) // insert
    })
    const result = await startOrResumeAssessment({ userId: null, anonymousSessionId: 'anon-1' }, client)
    expect(result).toEqual({ assessmentId: 'new-assess', archetypeAnswers: {}, readinessAnswers: {} })
  })
})

describe('saveAssessmentAnswers', () => {
  it('returns no error on a successful update', async () => {
    const client = makeFakeClient(() => makeBuilder({ data: null, error: null }))
    const result = await saveAssessmentAnswers('assess-1', { q1: 3 }, {}, client)
    expect(result.error).toBeNull()
  })

  it('surfaces the database error message on failure', async () => {
    const client = makeFakeClient(() => makeBuilder({ data: null, error: { message: 'boom' } }))
    const result = await saveAssessmentAnswers('assess-1', {}, {}, client)
    expect(result.error).toBe('boom')
  })
})

describe('completeAssessment', () => {
  const archetype: ArchetypeResult = {
    dimensionScores: { peopleFocus: 1, leadershipDrive: 1, structurePreference: 1, ambiguityTolerance: 1, analyticalOrientation: 1, workPace: 1 },
    archetypeScores: { driver: 1, connector: 1, strategist: 1, builder: 1, explorer: 1, creator: 1 },
    primaryArchetype: 'driver',
    secondaryArchetype: 'connector',
  }
  const readiness: ReadinessResult = {
    dimensionScores: { careerDirection: 1, resumePositioning: 1, searchStrategy: 1, applicationResults: 1, interviewConfidence: 1 },
    supportNeed: 1, urgency: 1, transitionType: null, isComplexTransition: false,
    overallScore: 1, primaryBarrier: 'careerDirection', secondaryBarrier: 'resumePositioning',
  }
  const recommendation: PlanRecommendation = { planSlug: 'founding-member', serviceFitPct: 80, reasons: ['because'] }

  it('does not attempt to supersede a prior result for an anonymous user (no user id to scope by)', async () => {
    const fromCalls: string[] = []
    const client = makeFakeClient((table) => { fromCalls.push(table); return makeBuilder({ data: null, error: null }) })
    await completeAssessment({ assessmentId: 'assess-1', userId: null, archetype, readiness, recommendation }, client)
    // Expect exactly: update assessments status, insert results. No extra "supersede" update.
    expect(fromCalls.filter((t) => t === 'career_compass_results').length).toBe(1)
  })

  it('supersedes the prior current result before inserting the new one for an authenticated user', async () => {
    const fromCalls: string[] = []
    const client = makeFakeClient((table) => { fromCalls.push(table); return makeBuilder({ data: null, error: null }) })
    await completeAssessment({ assessmentId: 'assess-1', userId: 'user-1', archetype, readiness, recommendation }, client)
    expect(fromCalls.filter((t) => t === 'career_compass_results').length).toBe(2)
  })

  it('stops and returns an error if marking the assessment completed fails, without inserting a result', async () => {
    const fromCalls: string[] = []
    const client = makeFakeClient((table) => {
      fromCalls.push(table)
      return table === 'career_compass_assessments'
        ? makeBuilder({ data: null, error: { message: 'assessment update failed' } })
        : makeBuilder({ data: null, error: null })
    })
    const result = await completeAssessment({ assessmentId: 'assess-1', userId: null, archetype, readiness, recommendation }, client)
    expect(result.error).toBe('assessment update failed')
    expect(fromCalls).not.toContain('career_compass_results')
  })
})

describe('claimAnonymousAssessment', () => {
  it('claims matching assessments and cascades the claim to their results', async () => {
    const fromCalls: string[] = []
    const client = makeFakeClient((table) => {
      fromCalls.push(table)
      return table === 'career_compass_assessments'
        ? makeBuilder({ data: [{ id: 'assess-1' }, { id: 'assess-2' }], error: null })
        : makeBuilder({ data: null, error: null })
    })
    const result = await claimAnonymousAssessment('user-1', 'anon-1', client)
    expect(result.error).toBeNull()
    expect(result.claimedAssessmentIds).toEqual(['assess-1', 'assess-2'])
    expect(fromCalls).toContain('career_compass_results')
  })

  it('skips the results update entirely when nothing was claimed', async () => {
    const fromCalls: string[] = []
    const client = makeFakeClient((table) => {
      fromCalls.push(table)
      return makeBuilder({ data: [], error: null })
    })
    const result = await claimAnonymousAssessment('user-1', 'anon-1', client)
    expect(result.claimedAssessmentIds).toEqual([])
    expect(fromCalls).not.toContain('career_compass_results')
  })

  it('never throws and returns the error message when the claim update fails', async () => {
    const client = makeFakeClient(() => makeBuilder({ data: null, error: { message: 'claim failed' } }))
    const result = await claimAnonymousAssessment('user-1', 'anon-1', client)
    expect(result.error).toBe('claim failed')
    expect(result.claimedAssessmentIds).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/careerCompass/session.test.ts`
Expected: FAIL — module does not exist yet.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/careerCompass/session.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase as defaultClient } from '@/lib/supabase'
import type {
  ArchetypeAnswers, ReadinessAnswers, ArchetypeResult, ReadinessResult, PlanRecommendation,
} from '@/types/careerCompass'

const ANONYMOUS_SESSION_STORAGE_KEY = 'ff_career_compass_anon_session_id'

export interface AssessmentIdentity {
  userId: string | null
  anonymousSessionId: string | null
}

export interface AssessmentProgress {
  assessmentId: string
  archetypeAnswers: ArchetypeAnswers
  readinessAnswers: ReadinessAnswers
}

export interface CareerCompassResultInsert {
  assessmentId: string
  userId: string | null
  archetype: ArchetypeResult
  readiness: ReadinessResult
  recommendation: PlanRecommendation
}

/**
 * Reads (or creates and persists) the random, unguessable id that lets an
 * anonymous visitor's in-progress assessment survive a page refresh
 * before they have an account. Never placed in a URL or logged.
 */
export function getOrCreateAnonymousSessionId(storage: Storage = window.localStorage): string {
  const existing = storage.getItem(ANONYMOUS_SESSION_STORAGE_KEY)
  if (existing) return existing
  const id = crypto.randomUUID()
  storage.setItem(ANONYMOUS_SESSION_STORAGE_KEY, id)
  return id
}

/** Clears the stored anonymous session id, e.g. once it has been claimed. */
export function removeAnonymousSessionId(storage: Storage = window.localStorage): void {
  storage.removeItem(ANONYMOUS_SESSION_STORAGE_KEY)
}

function identityFilterColumn(
  identity: AssessmentIdentity
): { column: 'user_id' | 'anonymous_session_id'; value: string } | null {
  if (identity.userId) return { column: 'user_id', value: identity.userId }
  if (identity.anonymousSessionId) return { column: 'anonymous_session_id', value: identity.anonymousSessionId }
  return null
}

/**
 * Finds the caller's existing in-progress assessment, or starts a new
 * one. Never returns more than one open assessment per identity.
 */
export async function startOrResumeAssessment(
  identity: AssessmentIdentity,
  client: SupabaseClient = defaultClient
): Promise<AssessmentProgress | { error: string }> {
  const filter = identityFilterColumn(identity)
  if (!filter) return { error: 'No user id or anonymous session id provided.' }

  const { data: existing, error: selectError } = await client
    .from('career_compass_assessments')
    .select('id, archetype_answers, readiness_answers')
    .eq(filter.column, filter.value)
    .eq('status', 'in_progress')
    .maybeSingle()

  if (selectError) return { error: selectError.message }
  if (existing) {
    const row = existing as { id: string; archetype_answers: ArchetypeAnswers | null; readiness_answers: ReadinessAnswers | null }
    return {
      assessmentId: row.id,
      archetypeAnswers: row.archetype_answers ?? {},
      readinessAnswers: row.readiness_answers ?? {},
    }
  }

  const { data: created, error: insertError } = await client
    .from('career_compass_assessments')
    .insert({ user_id: identity.userId, anonymous_session_id: identity.anonymousSessionId })
    .select('id')
    .single()

  if (insertError) return { error: insertError.message }
  return { assessmentId: (created as { id: string }).id, archetypeAnswers: {}, readinessAnswers: {} }
}

/** Autosaves answers to the caller's open assessment. Safe to call after every answer. */
export async function saveAssessmentAnswers(
  assessmentId: string,
  archetypeAnswers: ArchetypeAnswers,
  readinessAnswers: ReadinessAnswers,
  client: SupabaseClient = defaultClient
): Promise<{ error: string | null }> {
  const { error } = await client
    .from('career_compass_assessments')
    .update({ archetype_answers: archetypeAnswers, readiness_answers: readinessAnswers })
    .eq('id', assessmentId)

  return { error: error?.message ?? null }
}

/**
 * Marks the assessment completed and stores its computed result. For an
 * authenticated user, the prior "current" result (if any) is superseded
 * (not deleted) so retake history is preserved; anonymous users have no
 * such prior row to supersede in V1.
 */
export async function completeAssessment(
  result: CareerCompassResultInsert,
  client: SupabaseClient = defaultClient
): Promise<{ error: string | null }> {
  const { error: statusError } = await client
    .from('career_compass_assessments')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', result.assessmentId)

  if (statusError) return { error: statusError.message }

  if (result.userId) {
    const { error: supersedeError } = await client
      .from('career_compass_results')
      .update({ is_current: false })
      .eq('user_id', result.userId)
      .eq('is_current', true)

    if (supersedeError) return { error: supersedeError.message }
  }

  const { error: insertError } = await client
    .from('career_compass_results')
    .insert({
      assessment_id: result.assessmentId,
      user_id: result.userId,
      is_current: true,
      dimension_scores: result.archetype.dimensionScores,
      archetype_scores: result.archetype.archetypeScores,
      primary_archetype: result.archetype.primaryArchetype,
      secondary_archetype: result.archetype.secondaryArchetype,
      readiness_scores: result.readiness.dimensionScores,
      primary_barrier: result.readiness.primaryBarrier,
      secondary_barrier: result.readiness.secondaryBarrier,
      recommended_plan_slug: result.recommendation.planSlug,
      service_fit_pct: result.recommendation.serviceFitPct,
    })

  return { error: insertError?.message ?? null }
}

/**
 * Attaches a newly-authenticated user's id to any assessment/result rows
 * created anonymously under their browser's session id. Never deletes or
 * overwrites answers; never throws — callers should treat this as
 * best-effort and never let it block sign-in/signup.
 */
export async function claimAnonymousAssessment(
  userId: string,
  anonymousSessionId: string,
  client: SupabaseClient = defaultClient
): Promise<{ error: string | null; claimedAssessmentIds: string[] }> {
  const { data: claimed, error: claimError } = await client
    .from('career_compass_assessments')
    .update({ user_id: userId })
    .eq('anonymous_session_id', anonymousSessionId)
    .is('user_id', null)
    .select('id')

  if (claimError) return { error: claimError.message, claimedAssessmentIds: [] }

  const assessmentIds = ((claimed ?? []) as { id: string }[]).map((row) => row.id)
  if (assessmentIds.length === 0) return { error: null, claimedAssessmentIds: [] }

  const { error: resultsError } = await client
    .from('career_compass_results')
    .update({ user_id: userId })
    .in('assessment_id', assessmentIds)
    .is('user_id', null)

  return { error: resultsError?.message ?? null, claimedAssessmentIds: assessmentIds }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/careerCompass/session.test.ts`
Expected: PASS (13 tests)

- [ ] **Step 5: Update the barrel export**

Add one line to `src/lib/careerCompass/index.ts`:

```ts
export * from './session'
```

- [ ] **Step 6: Run the full test suite to confirm no regressions**

Run: `npx vitest run`
Expected: PASS (all pre-existing tests plus every new session.ts test)

- [ ] **Step 7: Commit**

```bash
git add src/lib/careerCompass/session.ts src/lib/careerCompass/session.test.ts src/lib/careerCompass/index.ts
git commit -m "feat(career-compass): add persistence session module (start/resume/save/complete/claim)"
```

---

## Task 3: Wire Claiming Into AuthContext

**Files:**
- Modify: `src/context/AuthContext.tsx`

**Interfaces:**
- Consumes: `claimAnonymousAssessment`, `removeAnonymousSessionId` from
  `@/lib/careerCompass` (Task 2).

This task has no new automated test (no existing test file for
`AuthContext.tsx` to extend, and testing a live Supabase auth listener
end-to-end needs a real or heavily-mocked auth backend, which is out of
scope for this plan). Verification is manual: read the diff against the
checklist below, then run the full suite to confirm the existing app
still builds/type-checks and nothing else broke.

- [ ] **Step 1: Add the claim call**

In `src/context/AuthContext.tsx`, import the two new functions:

```ts
import { claimAnonymousAssessment, removeAnonymousSessionId } from '@/lib/careerCompass'
```

Add this helper function inside `AuthProvider`, above `fetchProfile`:

```ts
  const maybeClaimAnonymousAssessment = async (userId: string) => {
    const anonymousSessionId = window.localStorage.getItem('ff_career_compass_anon_session_id')
    if (!anonymousSessionId) return
    try {
      await claimAnonymousAssessment(userId, anonymousSessionId)
    } catch (err) {
      console.error('Career Compass claim failed (non-blocking):', err)
    } finally {
      removeAnonymousSessionId()
    }
  }
```

Call it, fire-and-forget (never awaited by the surrounding auth flow, and
wrapped so a rejection can never surface as an unhandled promise
rejection), in both places `AuthProvider` learns a user is signed in —
right after the existing `fetchProfile(...)` call in the initial
`getSession()` handler, and right after the existing `await
fetchProfile(...)` call in the `onAuthStateChange` handler:

```ts
        void maybeClaimAnonymousAssessment(session.user.id)
```

(Reads the raw `localStorage` key directly, using the exact literal
`'ff_career_compass_anon_session_id'`, rather than importing the
private constant from `session.ts` — that constant is intentionally not
exported, since only `session.ts` itself should decide the key name;
duplicating the literal here is an accepted, documented trade-off, not
an oversight.)

- [ ] **Step 2: Self-review against this checklist**

- [ ] The claim call never uses `await` in a way that blocks or delays
      `setLoading(false)` or the rest of the auth flow
- [ ] Any rejection from `claimAnonymousAssessment` is caught locally
      (via the `try/catch` inside `maybeClaimAnonymousAssessment`) and
      never propagates to break sign-in
- [ ] `removeAnonymousSessionId()` runs in a `finally` block so a claim
      failure doesn't leave a stale id trying (and failing) again
      forever on every future sign-in
- [ ] No existing behavior in `AuthContext.tsx` changed — this is a
      strictly additive two-line call in two places plus one helper
      function

- [ ] **Step 3: Run the full test suite**

Run: `npx vitest run`
Expected: PASS (no regressions — this file has no tests of its own, but
must not break any test that indirectly renders through `AuthProvider`)

- [ ] **Step 4: Commit**

```bash
git add src/context/AuthContext.tsx
git commit -m "feat(career-compass): claim anonymous assessment on sign-in, best-effort"
```

---

## What This Plan Does Not Cover

Routing, pages, components, dashboard/nav integration, AI interpretation,
and analytics are all still open per the original spec's Implementation
Sequence (Tasks 8-15) and belong to a follow-on UI plan that builds on
top of this persistence layer.
