# Career Compass Persistence & Anonymous Session — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Revision note (2026-08-30):** This plan originally specified a
client-generated `anonymous_session_id` string as the RLS access-control
boundary for anonymous visitors. A task review caught that this cannot
actually be enforced by Postgres RLS (the shared `anon` role has no
per-visitor identity to check against), which meant every visitor's
in-progress answers and results — and the claim operation itself — were
exposed to any other caller. Nothing was ever applied to a real database
(caught in local review before merge). This revision replaces that design
with **Supabase Anonymous Sign-In**, which is both more secure and
simpler: every visitor, anonymous or not, gets a genuine `auth.uid()`,
both tables use one ordinary ownership policy, and "claiming" becomes an
identity-layer conversion (uid never changes) instead of a data migration.

**Goal:** Give the (already-merged, pure) Career Compass scoring engines a
persistence layer: two Supabase tables, a testable session module for
starting/resuming/saving/completing an assessment under a real (if
temporary) `auth.uid()`, and the small conditional branch in
`AuthContext.signUp` that converts an anonymous visitor's account to a
permanent one in place the moment they sign up — preserving every
already-saved assessment row automatically, with no explicit "claim" data
operation and no risk of ever losing answers.

**Architecture:** One SQL migration following this repo's existing
migration conventions (see `supabase/migrations/20260821000000_opportunity_engine.sql`
for the header-comment + RLS style to match), plus one new pure-ish module
`src/lib/careerCompass/session.ts` that takes the Supabase client as an
injectable parameter (defaulting to the real singleton) specifically so it
is unit-testable with a hand-built fake client — no `vi.mock` module
interception needed, no network, no real database required to run the
test suite.

**Tech Stack:** TypeScript, Supabase (Postgres + RLS + Anonymous Auth),
Vitest (already configured, no new dependencies).

**Spec:** `docs/superpowers/specs/2026-08-29-career-compass-design.md`
(section 8: Data Model — revised 2026-08-30 to match this plan; section
10: Risks).

**Depends on (already merged):** `src/types/careerCompass.ts`,
`src/lib/careerCompass/{scoring,archetypeEngine,readinessEngine,recommendationEngine}.ts`.

## Global Constraints

- No new npm dependencies.
- No emojis in code, comments, or commit messages.
- This plan does NOT touch UI, routing, or the dashboard — that's the next
  follow-on plan. Do not create any page or component files here.
- `user_id` is NEVER nullable on either new table. Every visitor —
  anonymous or permanent — has a real `auth.uid()` by the time any row is
  written, because starting an assessment always establishes a Supabase
  Anonymous Sign-In session first if no session exists yet.
- Both tables use exactly one RLS policy each: `FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())`. No
  `anon`-role policy, no separate "claim" policy, no
  `anonymous_session_id` column — none of these are needed under this
  design, and adding any of them back would reintroduce the exact defect
  this revision fixes.
- The anonymous-to-permanent conversion in `AuthContext.signUp` is a
  narrow, guarded conditional branch (only activates when the current
  session's `user.is_anonymous` is true) — it must not change behavior
  for any ordinary signup where no anonymous session exists.
- `session.ts` functions accept the Supabase client as their last
  parameter, defaulting to the real singleton import from `@/lib/supabase`
  — this is the one deliberate architectural choice in this plan (no
  precedent either way exists yet in this codebase) made specifically so
  tests never need `vi.mock` chain-hoisting gymnastics.
- Follow this repo's existing migration conventions exactly: header
  comment block explaining purpose/tables/security, `CREATE TABLE IF NOT
  EXISTS`, indexes, `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`, and
  `DROP POLICY IF EXISTS` before every `CREATE POLICY` (idempotent,
  re-runnable — matches every existing migration in `supabase/migrations/`).

---

## Task 1: Supabase Migration — Assessment & Results Tables (corrected)

**Status:** A prior version of this task's migration
(`supabase/migrations/20260830000000_career_compass_assessment_system.sql`,
commit `d133b3f`) was committed and reviewed on this branch, then found
to have the RLS defect described above. This task REPLACES that file's
contents entirely with the corrected design below — same filename (it was
never applied to any real database, so no destructive migration-rename
dance is needed), new commit.

**Files:**
- Overwrite: `supabase/migrations/20260830000000_career_compass_assessment_system.sql`

This is a SQL-only task. This repo has no local Supabase test harness. The
verification step is a careful self-review against the checklist below —
this time including a hand-traced attack-scenario check, since that step
was missing from the original checklist and is exactly what let the prior
defect through.

- [ ] **Step 1: Replace the migration's full contents**

```sql
/*
# Career Compass Assessment System

## Overview
Adds persistence for the Career Compass free assessment (Archetype +
Forward Readiness) described in
docs/superpowers/specs/2026-08-29-career-compass-design.md section 8.
Supports a logged-out visitor starting and completing the assessment
before ever creating an account, then signing up and having that work
carry over automatically -- without losing any answers.

## Identity model (see spec section 8, revised 2026-08-30)
Every visitor -- anonymous or permanent -- gets a real, if temporary,
`auth.uid()` via Supabase Anonymous Sign-In (`auth.signInAnonymously()`,
called client-side in `src/lib/careerCompass/session.ts`). Anonymous
Sign-In issues a genuine JWT under the `authenticated` Postgres role
(the user row is simply flagged `is_anonymous = true`), so both tables
below use one ordinary `user_id = auth.uid()` ownership policy -- the
same pattern already used everywhere else in this schema. `user_id` is
NEVER nullable: there is no "unclaimed" state to represent, because the
uid exists from the moment the visitor starts the assessment.

An earlier version of this migration used a client-generated
`anonymous_session_id` string as the access-control boundary instead.
That could not actually be enforced by RLS -- the shared `anon` role has
no per-visitor identity to check a value against -- and was caught in
review as a full read/write/claim exposure across every visitor's data
before ever being applied to a real database. This version replaces
that design entirely; there is no `anon`-role policy on either table.

## New Tables

### `career_compass_assessments`
The raw answer state for one assessment attempt.

### `career_compass_results`
The computed, scored output of a completed assessment (dimension
scores, archetype, readiness, barriers, plan recommendation). Supports
retakes: multiple result rows can exist per user, but only one may have
`is_current = true` at a time (enforced by a unique index -- this now
applies uniformly to every user, anonymous or permanent, since `user_id`
is always present).

## Security
Every score is calculated client-side by the pure functions in
`src/lib/careerCompass/`; these tables only ever store already-computed
results plus the raw answers needed to allow a retake/resume. Nothing
here executes AI calls or reaches an external API. "Claiming" an
anonymous visitor's work on signup is an identity-layer operation
(`supabase.auth.updateUser()` converting the anonymous account to a
permanent one in place -- see `AuthContext.signUp`), not a data
operation: `auth.uid()` never changes during that conversion, so the
single ownership policy below keeps working, unmodified, before and
after signup.
*/

-- ============================================================
-- CAREER_COMPASS_ASSESSMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS career_compass_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  version text NOT NULL DEFAULT '1.0',
  archetype_answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  readiness_answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_career_compass_assessments_user ON career_compass_assessments(user_id);

ALTER TABLE career_compass_assessments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "manage_own_assessment" ON career_compass_assessments;
CREATE POLICY "manage_own_assessment"
  ON career_compass_assessments FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
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
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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

-- Only one "current" result at a time, for every user (anonymous or
-- permanent -- user_id is always present under this identity model).
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_current_result_per_user
  ON career_compass_results(user_id)
  WHERE is_current = true;

ALTER TABLE career_compass_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "manage_own_result" ON career_compass_results;
CREATE POLICY "manage_own_result"
  ON career_compass_results FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

- [ ] **Step 2: Self-review against this checklist**

- [ ] Every `CREATE TABLE` uses `IF NOT EXISTS` (idempotent, re-runnable)
- [ ] Every `CREATE POLICY` is preceded by a matching `DROP POLICY IF EXISTS`
- [ ] `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` present on both tables
- [ ] Neither table has an `anon`-role policy, a separate "claim" policy,
      or an `anonymous_session_id` column — confirm none crept back in
- [ ] `user_id` is `NOT NULL` on both tables, no nullable-until-claimed state
- [ ] The unique index on `career_compass_results` is unconditional on
      `user_id` (just `WHERE is_current = true`, no `user_id IS NOT NULL`
      qualifier — that qualifier was part of the old, wrong design)
- [ ] **Hand-trace attack scenario:** with only the `authenticated` role's
      `USING (user_id = auth.uid())` policy on each table, confirm no
      authenticated caller (real or Anonymous-Sign-In) can select, update,
      or claim a row whose `user_id` is not their own `auth.uid()` — write
      down the trace in your report, don't just check the box
- [ ] No raw SQL string concatenation, no dynamic table/column names
- [ ] File name's timestamp sorts after every existing migration in
      `supabase/migrations/` (confirm via `dir supabase\migrations`)

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260830000000_career_compass_assessment_system.sql
git commit -m "fix(career-compass): replace unenforceable anonymous_session_id RLS with Anonymous Sign-In + uid ownership"
```

---

## Task 2: Session Module (Anonymous Sign-In + start/resume/save/complete)

**Files:**
- Create: `src/lib/careerCompass/session.ts`
- Create: `src/lib/careerCompass/session.test.ts`

**Interfaces:**
- Consumes: `ArchetypeAnswers`, `ReadinessAnswers`, `ArchetypeResult`,
  `ReadinessResult`, `PlanRecommendation` from `@/types/careerCompass`
  (already merged); `supabase` from `@/lib/supabase`; `SupabaseClient`
  type from `@supabase/supabase-js`.
- Produces: `ensureAuthenticatedSession`, `startOrResumeAssessment`,
  `saveAssessmentAnswers`, `completeAssessment` — a later UI plan calls
  all four. There is no `claimAnonymousAssessment` in this design (see
  Task 3): claiming is an identity-layer operation living entirely in
  `AuthContext.signUp`, not a `session.ts` data operation.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/careerCompass/session.test.ts
import { describe, it, expect, vi } from 'vitest'
import {
  ensureAuthenticatedSession,
  startOrResumeAssessment,
  saveAssessmentAnswers,
  completeAssessment,
} from './session'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ArchetypeResult, ReadinessResult, PlanRecommendation } from '@/types/careerCompass'

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
    maybeSingle: vi.fn(() => Promise.resolve(response)),
    single: vi.fn(() => Promise.resolve(response)),
    then: (resolve: (value: typeof response) => unknown) => Promise.resolve(response).then(resolve),
  }
  return builder
}

function makeFakeClient(opts: {
  fromImpl?: (table: string) => Record<string, unknown>
  getSession?: () => Promise<{ data: { session: { user: { id: string } } | null } }>
  signInAnonymously?: () => Promise<{ data: { user: { id: string } | null }; error: { message: string } | null }>
}): SupabaseClient {
  return {
    from: vi.fn(opts.fromImpl ?? (() => makeBuilder({ data: null, error: null }))),
    auth: {
      getSession: vi.fn(opts.getSession ?? (() => Promise.resolve({ data: { session: null } }))),
      signInAnonymously: vi.fn(opts.signInAnonymously ?? (() => Promise.resolve({ data: { user: { id: 'anon-uid' } }, error: null }))),
    },
  } as unknown as SupabaseClient
}

describe('ensureAuthenticatedSession', () => {
  it('returns the existing session\'s user id without creating a new one', async () => {
    const client = makeFakeClient({
      getSession: () => Promise.resolve({ data: { session: { user: { id: 'existing-uid' } } } }),
    })
    const result = await ensureAuthenticatedSession(client)
    expect(result).toEqual({ userId: 'existing-uid' })
    expect(client.auth.signInAnonymously).not.toHaveBeenCalled()
  })

  it('signs in anonymously and returns the new user id when no session exists', async () => {
    const client = makeFakeClient({
      getSession: () => Promise.resolve({ data: { session: null } }),
      signInAnonymously: () => Promise.resolve({ data: { user: { id: 'new-anon-uid' } }, error: null }),
    })
    const result = await ensureAuthenticatedSession(client)
    expect(result).toEqual({ userId: 'new-anon-uid' })
  })

  it('returns an error if anonymous sign-in itself fails', async () => {
    const client = makeFakeClient({
      getSession: () => Promise.resolve({ data: { session: null } }),
      signInAnonymously: () => Promise.resolve({ data: { user: null }, error: { message: 'anon sign-in disabled' } }),
    })
    const result = await ensureAuthenticatedSession(client)
    expect(result).toEqual({ error: 'anon sign-in disabled' })
  })
})

describe('startOrResumeAssessment', () => {
  it('resumes an existing in-progress assessment instead of creating a new one', async () => {
    const existingRow = { id: 'assess-1', archetype_answers: { q1: 3 }, readiness_answers: {} }
    const client = makeFakeClient({ fromImpl: () => makeBuilder({ data: existingRow, error: null }) })
    const result = await startOrResumeAssessment('user-1', client)
    expect(result).toEqual({ assessmentId: 'assess-1', archetypeAnswers: { q1: 3 }, readinessAnswers: {} })
  })

  it('creates a new assessment when none is in progress', async () => {
    let call = 0
    const client = makeFakeClient({
      fromImpl: () => {
        call += 1
        return call === 1
          ? makeBuilder({ data: null, error: null }) // select found nothing
          : makeBuilder({ data: { id: 'new-assess' }, error: null }) // insert
      },
    })
    const result = await startOrResumeAssessment('user-1', client)
    expect(result).toEqual({ assessmentId: 'new-assess', archetypeAnswers: {}, readinessAnswers: {} })
  })
})

describe('saveAssessmentAnswers', () => {
  it('returns no error on a successful update', async () => {
    const client = makeFakeClient({ fromImpl: () => makeBuilder({ data: null, error: null }) })
    const result = await saveAssessmentAnswers('assess-1', { q1: 3 }, {}, client)
    expect(result.error).toBeNull()
  })

  it('surfaces the database error message on failure', async () => {
    const client = makeFakeClient({ fromImpl: () => makeBuilder({ data: null, error: { message: 'boom' } }) })
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

  it('always supersedes the prior current result before inserting the new one (every user has a uid now)', async () => {
    const fromCalls: string[] = []
    const client = makeFakeClient({ fromImpl: (table) => { fromCalls.push(table); return makeBuilder({ data: null, error: null }) } })
    await completeAssessment({ assessmentId: 'assess-1', userId: 'user-1', archetype, readiness, recommendation }, client)
    expect(fromCalls.filter((t) => t === 'career_compass_results').length).toBe(2)
  })

  it('stops and returns an error if marking the assessment completed fails, without touching results at all', async () => {
    const fromCalls: string[] = []
    const client = makeFakeClient({
      fromImpl: (table) => {
        fromCalls.push(table)
        return table === 'career_compass_assessments'
          ? makeBuilder({ data: null, error: { message: 'assessment update failed' } })
          : makeBuilder({ data: null, error: null })
      },
    })
    const result = await completeAssessment({ assessmentId: 'assess-1', userId: 'user-1', archetype, readiness, recommendation }, client)
    expect(result.error).toBe('assessment update failed')
    expect(fromCalls).not.toContain('career_compass_results')
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

export interface AssessmentProgress {
  assessmentId: string
  archetypeAnswers: ArchetypeAnswers
  readinessAnswers: ReadinessAnswers
}

export interface CareerCompassResultInsert {
  assessmentId: string
  userId: string
  archetype: ArchetypeResult
  readiness: ReadinessResult
  recommendation: PlanRecommendation
}

/**
 * Returns the current session's user id, or establishes a real (if
 * temporary) Supabase Anonymous Sign-In session and returns its id if no
 * session exists yet. Every visitor -- anonymous or already
 * authenticated -- ends up with a genuine `auth.uid()` this way, which
 * is what lets both Career Compass tables use one ordinary
 * `user_id = auth.uid()` RLS policy instead of a bespoke, unenforceable
 * client-side-token scheme.
 */
export async function ensureAuthenticatedSession(
  client: SupabaseClient = defaultClient
): Promise<{ userId: string } | { error: string }> {
  const { data: { session } } = await client.auth.getSession()
  if (session?.user) return { userId: session.user.id }

  const { data, error } = await client.auth.signInAnonymously()
  if (error) return { error: error.message }
  if (!data.user) return { error: 'Anonymous sign-in returned no user.' }
  return { userId: data.user.id }
}

/**
 * Finds the caller's existing in-progress assessment, or starts a new
 * one. Never returns more than one open assessment per user.
 */
export async function startOrResumeAssessment(
  userId: string,
  client: SupabaseClient = defaultClient
): Promise<AssessmentProgress | { error: string }> {
  const { data: existing, error: selectError } = await client
    .from('career_compass_assessments')
    .select('id, archetype_answers, readiness_answers')
    .eq('user_id', userId)
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
    .insert({ user_id: userId })
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
 * Marks the assessment completed and stores its computed result,
 * superseding any prior "current" result for this user (every user has
 * a real uid under this identity model, anonymous or not, so retake
 * history works identically for everyone).
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

  const { error: supersedeError } = await client
    .from('career_compass_results')
    .update({ is_current: false })
    .eq('user_id', result.userId)
    .eq('is_current', true)

  if (supersedeError) return { error: supersedeError.message }

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/careerCompass/session.test.ts`
Expected: PASS (9 tests)

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
git commit -m "feat(career-compass): add persistence session module (anonymous sign-in, start/resume/save/complete)"
```

---

## Task 3: In-Place Anonymous-to-Permanent Conversion on Signup

**Files:**
- Modify: `src/context/AuthContext.tsx`

**Interfaces:**
- Consumes: `supabase.auth.getSession()`, `supabase.auth.updateUser()`
  (both already available on the existing `supabase` client — no new
  imports from `@/lib/careerCompass` needed, since this is purely an
  identity-layer operation, not a Career Compass data operation).

This task has no new automated test (no existing test file for
`AuthContext.tsx` to extend, and testing a live Supabase auth flow
end-to-end needs a real or heavily-mocked auth backend, out of scope for
this plan). Verification is manual: read the diff against the checklist
below, then run the full suite to confirm nothing else broke.

- [ ] **Step 1: Change `signUp` to detect and convert an anonymous session**

Replace the existing `signUp` function body in `AuthContext.tsx`:

```ts
  const signUp = async (email: string, password: string) => {
    const { data: { session: currentSession } } = await supabase.auth.getSession()

    if (currentSession?.user?.is_anonymous) {
      // This visitor already has a real (temporary) auth.uid() from an
      // earlier Supabase Anonymous Sign-In (started by Career Compass or
      // any future anonymous-first flow). Converting in place -- rather
      // than creating a brand-new account -- keeps that exact uid, so
      // every already-saved row scoped by `user_id = auth.uid()` is
      // instantly and correctly owned by the new permanent account with
      // zero data migration and no separate "claim" step.
      const { error } = await supabase.auth.updateUser({ email, password })
      return { error: error?.message ?? null }
    }

    const { error } = await supabase.auth.signUp({ email, password })
    return { error: error?.message ?? null }
  }
```

(The prior `signUp` returned `{ error: error?.message ?? null }` already
for the plain path — this only adds the `currentSession?.user?.is_anonymous`
branch above it. No other function in this file changes.)

- [ ] **Step 2: Self-review against this checklist**

- [ ] The new branch only activates when `currentSession?.user?.is_anonymous`
      is true — every ordinary signup (no anonymous session active) takes
      the exact same `supabase.auth.signUp(...)` path as before, unchanged
- [ ] No other function in `AuthContext.tsx` was touched (`signIn`,
      `signOut`, `fetchProfile`, `refreshProfile`, the `useEffect` auth
      listener) — this is a single, isolated function-body change
- [ ] `getSession()` call added here does not introduce a second
      subscription or listener — it is a one-shot read, matching how
      `getSession()` is already used elsewhere in this same file
- [ ] No claim-related import was added — this task deliberately does
      NOT import anything from `@/lib/careerCompass`, confirming Task 2's
      `session.ts` has zero auth-conversion responsibility

- [ ] **Step 3: Run the full test suite**

Run: `npx vitest run`
Expected: PASS (no regressions — this file has no tests of its own, but
must not break any test that indirectly renders through `AuthProvider`)

- [ ] **Step 4: Commit**

```bash
git add src/context/AuthContext.tsx
git commit -m "feat(career-compass): convert anonymous session to permanent account in place on signup"
```

---

## What This Plan Does Not Cover

Routing, pages, components, dashboard/nav integration, AI interpretation,
and analytics are all still open per the original spec's Implementation
Sequence (Tasks 8-15) and belong to a follow-on UI plan that builds on
top of this persistence layer. That UI plan is also responsible for
actually calling `ensureAuthenticatedSession()` at the right moment (when
a visitor starts the assessment) — this plan only builds the function.

**Hard prerequisite for that follow-on plan, not merely a nice-to-have:**
`completeAssessment` currently does its status-update, supersede, and
insert as three separate non-atomic network round trips with no
idempotency guard (see the ledger's Task 2 ruling). Final review sharpened
the risk: a failure between the supersede and the insert leaves the user
with **zero** current results (every historical row exists, none has
`is_current = true`), not merely a duplicate — a real "you have no
results" symptom for someone who definitely finished. This is safely
deferred today only because no UI calls this function yet; wrapping the
whole sequence in a single Postgres RPC/transaction must land in the same
plan that wires a real "Finish assessment" button, not sometime after.
