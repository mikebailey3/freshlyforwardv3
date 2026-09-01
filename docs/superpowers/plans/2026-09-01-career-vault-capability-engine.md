# Career Vault + Capability Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Career Vault (member-authored evidence of accomplishments), a deterministic Capability Engine (extracts structure and suggests Forward DNA capabilities from that evidence), and the confirmation flow that lets a member turn a suggestion into a real, explainable upgrade of an existing `career_skills` row -- with zero changes to Search Readiness, FreshFit, or the core Forward DNA data model.

**Architecture:** Two new, purely additive Postgres tables (`career_wins`, `career_win_capabilities`) plus a small set of pure TypeScript modules (interpreter, capability engine) sitting behind a swappable interface, wired into the existing `career_skills` state machine via the existing `upsertSkillState()` function. A single lightweight capture modal (statement -> review -> save) is the only new member-facing surface beyond a list page; a new read-only tab on the existing strategist workspace page is the only staff-facing surface.

**Tech Stack:** React + TypeScript, Vite, Tailwind, Supabase (Postgres + RLS), Vitest + Testing Library (existing project stack -- nothing new introduced).

**Spec:** `docs/superpowers/specs/2026-09-01-career-vault-capability-engine-design.md` (read this first -- this plan implements its locked decisions in \u00a77.1 and \u00a719 and must not be executed if that spec is not approved).

## Global Constraints

- `career_win_capabilities.suggested_state` is constrained (at the DB layer, via CHECK) to the single literal value `'demonstrated'` in v1. No code path may write `'supported'` through this table. (Spec \u00a77.1, Decision 1.)
- A brand-new `career_skills` row may be created directly at `state = 'demonstrated'` when confirmed evidence exists -- never forced through `'claimed'` first. (Spec \u00a77.1, Decision 2.)
- Skill evidence state represents evidence *strength*, not a workflow *sequence* -- confirmation logic must only ever upgrade `career_skills.state`, never downgrade it, and must skip the write entirely if the existing state is already `'demonstrated'` or `'supported'`.
- No AI/LLM implementation, API call, or prompt anywhere in this plan. The `CareerWinInterpreter` interface exists so one can be added later; it is not stubbed or scaffolded beyond the interface itself.
- No new `FeatureKey`, entitlement gate, `requiredPlan`, or `feature` prop on any new route -- Career Vault is free for every authenticated member, identical to `/forward-dna`.
- Strategist/admin access to Career Vault data is SELECT-only. No task in this plan may add an INSERT, UPDATE, or DELETE RLS policy, or any UI affordance, granting strategists or admins write access to `career_wins` or `career_win_capabilities`.
- Zero changes to `member_profiles`, `calculateSearchReadiness()`, the "search-ready" badge trigger, or the `AdminMemberSummary` view, in any task.
- Zero changes to `calculateForwardDnaCompleteness()`'s existing weighting or field list -- the existing `hasSkillEvidenceBeyondClaimed` check already covers Career Vault's contribution.
- Every pure-logic module (interpreter, capability engine, CRUD modules) accepts an injectable `client: SupabaseClient = defaultClient` parameter, matching every existing module in `src/lib/forwardDna/`, so it is unit-testable without a real Supabase connection.
- TDD discipline throughout: write the failing test, confirm it fails for the expected reason, write the minimal implementation, confirm it passes, commit. Small commits, one per task (or per sub-step where noted).
- At the end of the final task, the entire existing test suite must still be green and `tsc` must be clean -- this is itself a task step, not assumed.

---

## File Structure

| File | Responsibility |
|---|---|
| `supabase/migrations/20260901010000_career_vault.sql` | New tables + RLS + trigger. Purely additive. |
| `src/types/careerVault.ts` | `CareerWin`, `CareerWinCapability`, `EvidenceType`, `MetricType`, `CapabilitySource`, `CapabilityStatus`. |
| `src/lib/careerVault/interpreter.ts` | `CareerWinInterpreter` interface + `InterpretedCareerWin` type. No implementation. |
| `src/lib/careerVault/deterministicInterpreter.ts` | `DeterministicCareerWinInterpreter` -- v1's only implementation. Pure, no I/O. |
| `src/lib/careerVault/deterministicInterpreter.test.ts` | Interpreter unit tests, including the anti-fabrication suite. |
| `src/lib/careerVault/capabilityEngine.ts` | `inferCapabilities()` -- pure rule-table matcher, statement in, suggestions out. |
| `src/lib/careerVault/capabilityEngine.test.ts` | Capability engine unit tests. |
| `src/lib/careerVault/careerWins.ts` | CRUD: `createCareerWin`, `getCareerWinsForUser`, `getCareerWinsWithCapabilities`, `deleteCareerWin`. |
| `src/lib/careerVault/careerWins.test.ts` | CRUD unit tests with a fake Supabase client. |
| `src/lib/careerVault/capabilities.ts` | `confirmCapabilities()` -- writes evidence rows and upgrades `career_skills.state`, upgrade-only. |
| `src/lib/careerVault/capabilities.test.ts` | Confirmation-logic unit tests, including the never-downgrade case. |
| `src/components/careerVault/AddCareerWinModal.tsx` | "What happened?" -> review -> save. The only capture UI. |
| `src/components/careerVault/AddCareerWinModal.test.tsx` | Component tests. |
| `src/components/careerVault/CareerWinCard.tsx` | Read-only render of one Career Win + its confirmed capabilities. Reused by member page and strategist tab. |
| `src/components/careerVault/CareerWinCard.test.tsx` | Component tests. |
| `src/components/careerVault/CareerVaultTeaserCard.tsx` | Small link-out card rendered on `/forward-dna`. |
| `src/components/careerVault/CareerVaultTeaserCard.test.tsx` | Component test. |
| `src/pages/CareerVaultPage.tsx` | Member's own list + "+ Add Career Win", wraps `MemberLayout`. |
| `src/pages/CareerVaultPage.test.tsx` | Page test, same harness style as `ForwardDnaPage.test.tsx`. |
| `src/App.tsx` | Modify: add `/career-vault` route (member-only, no feature gate). |
| `src/components/MemberLayout.tsx` | Modify: add one nav item. |
| `src/pages/ForwardDnaPage.tsx` | Modify: render `CareerVaultTeaserCard` (one new line). |
| `src/pages/strategist/StrategistMemberWorkspacePage.tsx` | Modify: add `'career_vault'` to `TabKey`, one tab-bar entry, one new `CareerVaultTab` function in the same file (matching the existing `NotesTab`/`TimelineTab` pattern). |

---

## Task 1: Database migration -- `career_wins` + `career_win_capabilities`

**Files:**
- Create: `supabase/migrations/20260901010000_career_vault.sql`

**Interfaces:**
- Produces: tables `career_wins`, `career_win_capabilities` with the exact columns below -- every later TypeScript task's field names must match these verbatim.

This task has no unit test (it is a SQL migration); verification is a manual/staging step, consistent with every prior migration in this project's history (no live Postgres in this sandbox). The "test" for this task is a syntax and idempotency check via `psql --dry-run`-equivalent review plus running it against a local/staging Supabase instance before merge.

- [ ] **Step 1: Write the migration file**

```sql
/*
# ForwardOS Project 2 -- Career Vault + Capability Engine

## Overview
Adds career_wins (verbatim member-authored evidence) and
career_win_capabilities (the evidence-to-skill relationship, serving as
both suggestion and confirmed-evidence record via its `status` column).
Purely additive -- no existing table, column, trigger, or policy is
modified. See docs/superpowers/specs/2026-09-01-career-vault-capability-engine-design.md
sections 4, 7.1, and 14.

## Locked v1 rule (spec section 7.1, Decision 1)
career_win_capabilities.suggested_state is constrained to the single
literal value 'demonstrated'. A single Career Win can never suggest or
write 'supported' in v1. Widening this constraint is a future,
separate, additive migration once stronger/multiple-evidence criteria
for 'supported' are designed -- not scaffolded here.

## Search Readiness
This migration does not touch member_profiles, search_readiness_score,
or any badge trigger. See spec section 12 for the full protected
dependency list.
*/

-- ============================================================
-- CAREER_WINS
-- ============================================================
CREATE TABLE IF NOT EXISTS career_wins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  employment_entry_id text,
  original_statement text NOT NULL,
  evidence_type text NOT NULL DEFAULT 'accomplishment',
  category text,
  metric_type text,
  metric_value numeric,
  metric_raw text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_career_wins_user ON career_wins(user_id);

ALTER TABLE career_wins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "manage_own_career_wins" ON career_wins;
CREATE POLICY "manage_own_career_wins"
  ON career_wins FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "select_career_wins_strategist" ON career_wins;
CREATE POLICY "select_career_wins_strategist"
  ON career_wins FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR auth.uid() IN (
      SELECT strategist_id FROM strategist_assignments
      WHERE strategist_assignments.member_id = career_wins.user_id
      AND strategist_assignments.is_active = true
    )
    OR auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  );

CREATE OR REPLACE FUNCTION set_career_wins_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_career_wins_updated_at ON career_wins;
CREATE TRIGGER trg_career_wins_updated_at
  BEFORE UPDATE ON career_wins
  FOR EACH ROW EXECUTE FUNCTION set_career_wins_updated_at();

-- ============================================================
-- CAREER_WIN_CAPABILITIES
-- ============================================================
CREATE TABLE IF NOT EXISTS career_win_capabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  career_win_id uuid NOT NULL REFERENCES career_wins(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  skill_name text NOT NULL,
  suggested_state text NOT NULL DEFAULT 'demonstrated' CHECK (suggested_state = 'demonstrated'),
  source text NOT NULL CHECK (source IN ('system', 'member')),
  inference_reason text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected')),
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (career_win_id, skill_name)
);

CREATE INDEX IF NOT EXISTS idx_career_win_capabilities_user_skill ON career_win_capabilities(user_id, skill_name);
CREATE INDEX IF NOT EXISTS idx_career_win_capabilities_win ON career_win_capabilities(career_win_id);

ALTER TABLE career_win_capabilities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "manage_own_career_win_capabilities" ON career_win_capabilities;
CREATE POLICY "manage_own_career_win_capabilities"
  ON career_win_capabilities FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "select_career_win_capabilities_strategist" ON career_win_capabilities;
CREATE POLICY "select_career_win_capabilities_strategist"
  ON career_win_capabilities FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR auth.uid() IN (
      SELECT strategist_id FROM strategist_assignments
      WHERE strategist_assignments.member_id = career_win_capabilities.user_id
      AND strategist_assignments.is_active = true
    )
    OR auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'
  );
```

- [ ] **Step 2: Review for idempotency**

Confirm every `CREATE TABLE` uses `IF NOT EXISTS`, every `DROP POLICY`
uses `IF EXISTS`, and every `CREATE TRIGGER` is preceded by a matching
`DROP TRIGGER IF EXISTS` -- this migration must be safely re-runnable,
matching every other migration in `supabase/migrations/`.

- [ ] **Step 3: Run against a local/staging Supabase instance**

Apply the migration to a non-production database and confirm both
tables, both RLS policies (per table), the index, and the trigger exist
as expected. Insert one `career_wins` row as a test user, attempt to
insert a `career_win_capabilities` row with `suggested_state = 'supported'`
and confirm it is REJECTED by the CHECK constraint (this is the concrete
verification of Global Constraint #1).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260901010000_career_vault.sql
git commit -m "feat(career-vault): add career_wins and career_win_capabilities tables"
```

---

## Task 2: TypeScript types

**Files:**
- Create: `src/types/careerVault.ts`

**Interfaces:**
- Consumes: nothing (this is the foundation type file).
- Produces: `CareerWin`, `CareerWinCapability`, `EvidenceType`, `MetricType`, `CapabilitySource`, `CapabilityStatus` -- every later task imports from here, exact names must match.

No test file -- this is a pure type declaration, matching how `src/types/forwardDna.ts` has no companion test.

- [ ] **Step 1: Write the types file**

```typescript
// src/types/careerVault.ts
export type EvidenceType =
  | 'accomplishment'
  | 'project'
  | 'process_improvement'
  | 'promotion'
  | 'recognition'
  | 'certification'
  | 'leadership'
  | 'problem_solved'
  | 'other'

export type MetricType = 'currency' | 'percentage' | 'count'

export interface CareerWin {
  id: string
  user_id: string
  employment_entry_id: string | null
  original_statement: string
  evidence_type: EvidenceType
  category: string | null
  metric_type: MetricType | null
  metric_value: number | null
  metric_raw: string | null
  created_at: string
  updated_at: string
}

export type CapabilitySource = 'system' | 'member'
export type CapabilityStatus = 'pending' | 'confirmed' | 'rejected'

export interface CareerWinCapability {
  id: string
  career_win_id: string
  user_id: string
  skill_name: string
  suggested_state: 'demonstrated'
  source: CapabilitySource
  inference_reason: string | null
  status: CapabilityStatus
  decided_at: string | null
  created_at: string
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors introduced.

- [ ] **Step 3: Commit**

```bash
git add src/types/careerVault.ts
git commit -m "feat(career-vault): add CareerWin and CareerWinCapability types"
```

---

## Task 3: Deterministic interpreter (with anti-fabrication tests)

**Files:**
- Create: `src/lib/careerVault/interpreter.ts`
- Create: `src/lib/careerVault/deterministicInterpreter.ts`
- Create: `src/lib/careerVault/deterministicInterpreter.test.ts`

**Interfaces:**
- Consumes: `MetricType` from `src/types/careerVault.ts` (Task 2).
- Produces: `InterpretedCareerWin`, `CareerWinInterpreter` interface, `DeterministicCareerWinInterpreter` class -- Task 4 and Task 7 both import `DeterministicCareerWinInterpreter` and the `InterpretedCareerWin` shape.

This is the highest-risk-of-getting-wrong module (anti-fabrication is a
hard product requirement) -- write every test below before any
implementation code, per Global Constraints' TDD discipline.

- [ ] **Step 1: Write the interface (no logic yet)**

```typescript
// src/lib/careerVault/interpreter.ts
import type { MetricType } from '@/types/careerVault'

export interface InterpretedCareerWin {
  metricType: MetricType | null
  metricValue: number | null
  metricRaw: string | null
  category: string | null
}

/**
 * Extracts structure (metric, category) from a member's verbatim Career
 * Win statement. Never invents a fact -- every non-null field must be
 * derived from a literal substring of the input statement. Returns a
 * Promise even though v1's implementation resolves synchronously: a
 * future AICareerWinInterpreter will need to make a network call, and
 * designing this as sync now would force a breaking interface change
 * later for every caller (spec section 6).
 */
export interface CareerWinInterpreter {
  interpret(statement: string): Promise<InterpretedCareerWin>
}
```

- [ ] **Step 2: Write the failing anti-fabrication tests**

```typescript
// src/lib/careerVault/deterministicInterpreter.test.ts
import { describe, it, expect } from 'vitest'
import { DeterministicCareerWinInterpreter } from './deterministicInterpreter'

const interpreter = new DeterministicCareerWinInterpreter()

describe('DeterministicCareerWinInterpreter -- anti-fabrication', () => {
  it('never invents a metric for a statement with no numbers', async () => {
    const result = await interpreter.interpret('I improved inventory.')
    expect(result.metricType).toBeNull()
    expect(result.metricValue).toBeNull()
    expect(result.metricRaw).toBeNull()
  })

  it('never invents a dollar figure, percentage, team size, or timeframe for a bare statement', async () => {
    const result = await interpreter.interpret('I improved inventory.')
    expect(result.metricType).not.toBe('currency')
    expect(result.metricType).not.toBe('percentage')
    expect(result.metricType).not.toBe('count')
    expect(result.metricValue).toBeNull()
  })

  it('extracts a currency metric literally present in the statement', async () => {
    const result = await interpreter.interpret('I reduced inventory loss by $31,000.')
    expect(result.metricType).toBe('currency')
    expect(result.metricValue).toBe(31000)
    expect(result.metricRaw).toBe('$31,000')
  })

  it('extracts a percentage metric literally present in the statement', async () => {
    const result = await interpreter.interpret('I increased customer satisfaction by 15%.')
    expect(result.metricType).toBe('percentage')
    expect(result.metricValue).toBe(15)
    expect(result.metricRaw).toBe('15%')
  })

  it('does not report a percentage when only a dollar amount is present', async () => {
    const result = await interpreter.interpret('I saved the store $500 this month.')
    expect(result.metricType).toBe('currency')
    expect(result.metricType).not.toBe('percentage')
  })

  it('every non-null metricValue has a metricRaw that is a literal substring of the statement', async () => {
    const statements = [
      'I reduced inventory loss by $31,000.',
      'I increased customer satisfaction by 15%.',
      'I improved inventory.',
      'Developed three associates who were later promoted into leadership.',
    ]
    for (const statement of statements) {
      const result = await interpreter.interpret(statement)
      if (result.metricValue !== null) {
        expect(result.metricRaw).not.toBeNull()
        expect(statement).toContain(result.metricRaw as string)
      }
    }
  })

  it('infers a category from keywords without requiring a numeric metric', async () => {
    const result = await interpreter.interpret('I improved inventory.')
    expect(result.category).toBe('Operational Execution')
  })

  it('returns a Promise (interface contract for future async implementations)', () => {
    const returned = interpreter.interpret('I improved inventory.')
    expect(returned).toBeInstanceOf(Promise)
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/lib/careerVault/deterministicInterpreter.test.ts`
Expected: FAIL -- `deterministicInterpreter.ts` does not exist yet.

- [ ] **Step 4: Write the minimal implementation**

```typescript
// src/lib/careerVault/deterministicInterpreter.ts
import type { CareerWinInterpreter, InterpretedCareerWin } from './interpreter'

const CURRENCY_RE = /\$\s?\d[\d,]*(?:\.\d+)?\s?(?:million|m|k)?\b/i
const PERCENTAGE_RE = /\b\d+(?:\.\d+)?\s?%/
const COUNT_RE = /\b(\d+)\s+(?:associates|employees|people|team members|direct reports|reports|clients|customers|stores|locations)\b/i

interface CategoryRule {
  pattern: RegExp
  category: string
}

// Order matters -- first match wins, most-specific-first.
const CATEGORY_RULES: CategoryRule[] = [
  { pattern: /\bdevelop(ed)?\s+\w+\s+(associates|employees|people|team)|\bmentor|\bcoach|\bpromot/i, category: 'Leadership / People Development' },
  { pattern: /\$|\bcost\b|\bbudget\b|\brevenue\b|\bsales\b|\bprofit\b|\bloss\b/i, category: 'Financial / Operational Impact' },
  { pattern: /\bprocess\b|\befficien|\bstreamlin|\bautomat/i, category: 'Process Improvement' },
  { pattern: /\binventory\b|\bstock\b|\bsupply chain/i, category: 'Operational Execution' },
]

function extractCurrency(statement: string): { value: number; raw: string } | null {
  const match = statement.match(CURRENCY_RE)
  if (!match) return null
  const raw = match[0]
  const numeric = raw.replace(/[^0-9.]/g, '')
  let value = Number(numeric)
  if (/million|m\b/i.test(raw)) value *= 1_000_000
  else if (/k\b/i.test(raw)) value *= 1_000
  return Number.isFinite(value) ? { value, raw } : null
}

function extractPercentage(statement: string): { value: number; raw: string } | null {
  const match = statement.match(PERCENTAGE_RE)
  if (!match) return null
  const raw = match[0]
  const value = Number(raw.replace('%', '').trim())
  return Number.isFinite(value) ? { value, raw } : null
}

function extractCount(statement: string): { value: number; raw: string } | null {
  const match = statement.match(COUNT_RE)
  if (!match) return null
  return { value: Number(match[1]), raw: match[0] }
}

function inferCategory(statement: string): string | null {
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(statement)) return rule.category
  }
  return null
}

export class DeterministicCareerWinInterpreter implements CareerWinInterpreter {
  interpret(statement: string): Promise<InterpretedCareerWin> {
    const category = inferCategory(statement)

    const currency = extractCurrency(statement)
    if (currency) {
      return Promise.resolve({ metricType: 'currency', metricValue: currency.value, metricRaw: currency.raw, category })
    }

    const percentage = extractPercentage(statement)
    if (percentage) {
      return Promise.resolve({ metricType: 'percentage', metricValue: percentage.value, metricRaw: percentage.raw, category })
    }

    const count = extractCount(statement)
    if (count) {
      return Promise.resolve({ metricType: 'count', metricValue: count.value, metricRaw: count.raw, category })
    }

    return Promise.resolve({ metricType: null, metricValue: null, metricRaw: null, category })
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/careerVault/deterministicInterpreter.test.ts`
Expected: PASS, all 9 tests green.

- [ ] **Step 6: Commit**

```bash
git add src/lib/careerVault/interpreter.ts src/lib/careerVault/deterministicInterpreter.ts src/lib/careerVault/deterministicInterpreter.test.ts
git commit -m "feat(career-vault): add deterministic interpreter with anti-fabrication tests"
```

---

## Task 4: Capability engine

**Files:**
- Create: `src/lib/careerVault/capabilityEngine.ts`
- Create: `src/lib/careerVault/capabilityEngine.test.ts`

**Interfaces:**
- Consumes: nothing beyond a raw `string` (deliberately independent of `InterpretedCareerWin` -- capability inference reads the raw statement directly, per spec section 6's single-responsibility split between structure-extraction and capability-inference).
- Produces: `CapabilitySuggestion { skillName: string; reason: string }` and `inferCapabilities(statement: string): CapabilitySuggestion[]` -- Task 7 (`AddCareerWinModal`) imports both.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/careerVault/capabilityEngine.test.ts
import { describe, it, expect } from 'vitest'
import { inferCapabilities } from './capabilityEngine'

describe('inferCapabilities', () => {
  it('suggests Inventory Management and Financial Performance for a financial inventory statement', () => {
    const suggestions = inferCapabilities('Reduced inventory loss by $31,000.')
    const names = suggestions.map((s) => s.skillName)
    expect(names).toContain('Inventory Management')
    expect(names).toContain('Financial Performance')
    for (const s of suggestions) expect(s.reason.length).toBeGreaterThan(0)
  })

  it('suggests People Development and Leadership for a people-development statement', () => {
    const suggestions = inferCapabilities('Developed three associates who were later promoted into leadership.')
    const names = suggestions.map((s) => s.skillName)
    expect(names).toContain('People Development')
    expect(names).toContain('Leadership')
  })

  it('suggests Inventory Management from a category-only keyword with no numbers (anti-fabrication: suggestion is plausibility, not a fabricated fact)', () => {
    const suggestions = inferCapabilities('I improved inventory.')
    expect(suggestions.map((s) => s.skillName)).toEqual(['Inventory Management'])
  })

  it('returns an empty array, not an error, for a statement matching no rule', () => {
    const suggestions = inferCapabilities('I came to work on time every day.')
    expect(suggestions).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/careerVault/capabilityEngine.test.ts`
Expected: FAIL -- `capabilityEngine.ts` does not exist yet.

- [ ] **Step 3: Write the minimal implementation**

```typescript
// src/lib/careerVault/capabilityEngine.ts
export interface CapabilitySuggestion {
  skillName: string
  reason: string
}

interface CapabilityRule {
  pattern: RegExp
  skillName: string
  reason: string
}

const CAPABILITY_RULES: CapabilityRule[] = [
  {
    pattern: /\binventory\b|\bstock\b/i,
    skillName: 'Inventory Management',
    reason: 'Statement mentions inventory or stock.',
  },
  {
    pattern: /\$|\bcost\b|\bbudget\b|\brevenue\b|\bsales\b|\bprofit\b/i,
    skillName: 'Financial Performance',
    reason: 'Statement mentions a financial outcome (cost, budget, revenue, sales, or profit).',
  },
  {
    pattern: /\bsolv|\bfix(ed)?\b|\btroubleshoot/i,
    skillName: 'Problem Solving',
    reason: 'Statement describes solving or fixing a problem.',
  },
  {
    pattern: /\bprocess\b|\befficien|\bstreamlin|\bautomat|\boperation/i,
    skillName: 'Operational Execution',
    reason: 'Statement describes a process or operational change.',
  },
  {
    pattern: /\bdevelop(ed)?\s+\w+\s+(associates|employees|people|team)|\bmentor|\bcoach(ed)?|\bpromoted\b/i,
    skillName: 'People Development',
    reason: 'Statement describes developing, mentoring, coaching, or promoting others.',
  },
  {
    pattern: /\blead\w*|\bmanaged a team|\bsupervis/i,
    skillName: 'Leadership',
    reason: 'Statement describes leading, managing, or supervising others.',
  },
]

export function inferCapabilities(statement: string): CapabilitySuggestion[] {
  const suggestions: CapabilitySuggestion[] = []
  for (const rule of CAPABILITY_RULES) {
    if (rule.pattern.test(statement)) {
      suggestions.push({ skillName: rule.skillName, reason: rule.reason })
    }
  }
  return suggestions
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/careerVault/capabilityEngine.test.ts`
Expected: PASS, all 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/careerVault/capabilityEngine.ts src/lib/careerVault/capabilityEngine.test.ts
git commit -m "feat(career-vault): add deterministic capability engine"
```

---

## Task 5: `careerWins.ts` CRUD module

**Files:**
- Create: `src/lib/careerVault/careerWins.ts`
- Create: `src/lib/careerVault/careerWins.test.ts`

**Interfaces:**
- Consumes: `CareerWin`, `CareerWinCapability`, `EvidenceType`, `MetricType` from `src/types/careerVault.ts` (Task 2).
- Produces: `CreateCareerWinInput`, `createCareerWin`, `getCareerWinsForUser`, `CareerWinWithCapabilities`, `getCareerWinsWithCapabilities`, `deleteCareerWin`. Task 7 (`AddCareerWinModal`) imports `createCareerWin`; Task 9 (`CareerVaultPage`) and Task 11 (strategist tab) both import `getCareerWinsWithCapabilities` and `CareerWinWithCapabilities`.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/careerVault/careerWins.test.ts
import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createCareerWin, getCareerWinsForUser, getCareerWinsWithCapabilities, deleteCareerWin } from './careerWins'

function makeFakeClient(opts: {
  insertResult?: { data: unknown; error?: string }
  winsRows?: unknown[]
  winsError?: string
  capsRows?: unknown[]
  capsError?: string
  deleteError?: string
} = {}) {
  const insertSelectMaybeSingle = vi.fn().mockResolvedValue({
    data: opts.insertResult?.data ?? null,
    error: opts.insertResult?.error ? { message: opts.insertResult.error } : null,
  })
  const insertSelect = vi.fn().mockReturnValue({ maybeSingle: insertSelectMaybeSingle })
  const insertMock = vi.fn().mockReturnValue({ select: insertSelect })

  const winsOrder = vi.fn().mockResolvedValue({
    data: opts.winsRows ?? [],
    error: opts.winsError ? { message: opts.winsError } : null,
  })
  const winsEq = vi.fn().mockReturnValue({ order: winsOrder })
  const winsSelect = vi.fn().mockReturnValue({ eq: winsEq })

  const capsEqStatus = vi.fn().mockResolvedValue({
    data: opts.capsRows ?? [],
    error: opts.capsError ? { message: opts.capsError } : null,
  })
  const capsIn = vi.fn().mockReturnValue({ eq: capsEqStatus })
  const capsSelect = vi.fn().mockReturnValue({ in: capsIn })

  const deleteEq = vi.fn().mockResolvedValue({ error: opts.deleteError ? { message: opts.deleteError } : null })
  const deleteMock = vi.fn().mockReturnValue({ eq: deleteEq })

  const fromMock = vi.fn().mockImplementation((table: string) => {
    if (table === 'career_wins') return { insert: insertMock, select: winsSelect, delete: deleteMock }
    if (table === 'career_win_capabilities') return { select: capsSelect }
    throw new Error(`unexpected table: ${table}`)
  })

  return {
    client: { from: fromMock } as unknown as SupabaseClient,
    insertMock, winsSelect, winsEq, winsOrder, capsSelect, capsIn, capsEqStatus, deleteMock, deleteEq,
  }
}

describe('createCareerWin', () => {
  it('persists original_statement unchanged and returns the created row', async () => {
    const row = { id: 'win-1', original_statement: 'Reduced inventory loss by $31,000.' }
    const { client, insertMock } = makeFakeClient({ insertResult: { data: row } })

    const { careerWin, error } = await createCareerWin(
      'u1',
      {
        originalStatement: 'Reduced inventory loss by $31,000.',
        employmentEntryId: null,
        evidenceType: 'accomplishment',
        category: 'Financial / Operational Impact',
        metricType: 'currency',
        metricValue: 31000,
        metricRaw: '$31,000',
      },
      client
    )

    expect(error).toBeNull()
    expect(careerWin).toEqual(row)
    expect(insertMock).toHaveBeenCalledWith({
      user_id: 'u1',
      employment_entry_id: null,
      original_statement: 'Reduced inventory loss by $31,000.',
      evidence_type: 'accomplishment',
      category: 'Financial / Operational Impact',
      metric_type: 'currency',
      metric_value: 31000,
      metric_raw: '$31,000',
    })
  })
})

describe('getCareerWinsForUser', () => {
  it('returns rows ordered newest-first for the given user', async () => {
    const rows = [{ id: 'win-1' }]
    const { client, winsEq } = makeFakeClient({ winsRows: rows })
    const { careerWins, error } = await getCareerWinsForUser('u1', client)
    expect(error).toBeNull()
    expect(careerWins).toEqual(rows)
    expect(winsEq).toHaveBeenCalledWith('user_id', 'u1')
  })
})

describe('getCareerWinsWithCapabilities', () => {
  it('attaches only confirmed capabilities to their matching win', async () => {
    const wins = [{ id: 'win-1' }, { id: 'win-2' }]
    const caps = [{ id: 'cap-1', career_win_id: 'win-1', status: 'confirmed' }]
    const { client } = makeFakeClient({ winsRows: wins, capsRows: caps })

    const { careerWins, error } = await getCareerWinsWithCapabilities('u1', client)
    expect(error).toBeNull()
    expect(careerWins[0].capabilities).toEqual([caps[0]])
    expect(careerWins[1].capabilities).toEqual([])
  })

  it('returns an empty array without querying capabilities when there are no wins', async () => {
    const { client, capsSelect } = makeFakeClient({ winsRows: [] })
    const { careerWins, error } = await getCareerWinsWithCapabilities('u1', client)
    expect(error).toBeNull()
    expect(careerWins).toEqual([])
    expect(capsSelect).not.toHaveBeenCalled()
  })
})

describe('deleteCareerWin', () => {
  it('deletes by id', async () => {
    const { client, deleteEq } = makeFakeClient()
    const { error } = await deleteCareerWin('win-1', client)
    expect(error).toBeNull()
    expect(deleteEq).toHaveBeenCalledWith('id', 'win-1')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/careerVault/careerWins.test.ts`
Expected: FAIL -- `careerWins.ts` does not exist yet.

- [ ] **Step 3: Write the minimal implementation**

```typescript
// src/lib/careerVault/careerWins.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase as defaultClient } from '@/lib/supabase'
import type { CareerWin, CareerWinCapability, EvidenceType, MetricType } from '@/types/careerVault'

export interface CreateCareerWinInput {
  originalStatement: string
  employmentEntryId: string | null
  evidenceType: EvidenceType
  category: string | null
  metricType: MetricType | null
  metricValue: number | null
  metricRaw: string | null
}

export async function createCareerWin(
  userId: string,
  input: CreateCareerWinInput,
  client: SupabaseClient = defaultClient
): Promise<{ careerWin: CareerWin | null; error: string | null }> {
  const { data, error } = await client
    .from('career_wins')
    .insert({
      user_id: userId,
      employment_entry_id: input.employmentEntryId,
      original_statement: input.originalStatement,
      evidence_type: input.evidenceType,
      category: input.category,
      metric_type: input.metricType,
      metric_value: input.metricValue,
      metric_raw: input.metricRaw,
    })
    .select('*')
    .maybeSingle()

  return { careerWin: (data as CareerWin | null) ?? null, error: error?.message ?? null }
}

export async function getCareerWinsForUser(
  userId: string,
  client: SupabaseClient = defaultClient
): Promise<{ careerWins: CareerWin[]; error: string | null }> {
  const { data, error } = await client
    .from('career_wins')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  return { careerWins: (data as CareerWin[]) ?? [], error: error?.message ?? null }
}

export interface CareerWinWithCapabilities extends CareerWin {
  capabilities: CareerWinCapability[]
}

/**
 * Fetches a user's Career Wins plus their confirmed capabilities in two
 * queries (not N+1) -- one for the wins, one for all matching
 * career_win_capabilities rows, grouped client-side. Used identically
 * by the member's own Career Vault page and the strategist's read-only
 * tab (userId is simply whichever member's data the RLS policy allows
 * the caller to see).
 */
export async function getCareerWinsWithCapabilities(
  userId: string,
  client: SupabaseClient = defaultClient
): Promise<{ careerWins: CareerWinWithCapabilities[]; error: string | null }> {
  const { careerWins, error } = await getCareerWinsForUser(userId, client)
  if (error) return { careerWins: [], error }
  if (careerWins.length === 0) return { careerWins: [], error: null }

  const ids = careerWins.map((w) => w.id)
  const { data, error: capsError } = await client
    .from('career_win_capabilities')
    .select('*')
    .in('career_win_id', ids)
    .eq('status', 'confirmed')

  if (capsError) {
    return { careerWins: careerWins.map((w) => ({ ...w, capabilities: [] })), error: capsError.message }
  }

  const capsByWin = new Map<string, CareerWinCapability[]>()
  for (const cap of (data as CareerWinCapability[]) ?? []) {
    const list = capsByWin.get(cap.career_win_id) ?? []
    list.push(cap)
    capsByWin.set(cap.career_win_id, list)
  }

  return {
    careerWins: careerWins.map((w) => ({ ...w, capabilities: capsByWin.get(w.id) ?? [] })),
    error: null,
  }
}

export async function deleteCareerWin(
  careerWinId: string,
  client: SupabaseClient = defaultClient
): Promise<{ error: string | null }> {
  const { error } = await client.from('career_wins').delete().eq('id', careerWinId)
  return { error: error?.message ?? null }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/careerVault/careerWins.test.ts`
Expected: PASS, all 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/careerVault/careerWins.ts src/lib/careerVault/careerWins.test.ts
git commit -m "feat(career-vault): add careerWins CRUD module"
```

---

## Task 6: `capabilities.ts` -- confirmation + upgrade-only logic

This is the second highest-risk task: it is the only place
`career_skills.state` gets written by Career Vault, and Global
Constraints requires it to only ever upgrade, never downgrade, and to
skip the write entirely when the existing state already meets or
exceeds `'demonstrated'`.

**Files:**
- Create: `src/lib/careerVault/capabilities.ts`
- Create: `src/lib/careerVault/capabilities.test.ts`

**Interfaces:**
- Consumes: `getSkillStates`, `upsertSkillState` from `src/lib/forwardDna/skills.ts` (existing, unmodified); `SkillState` from `src/types/forwardDna.ts`; `CareerWinCapability`, `CapabilitySource` from `src/types/careerVault.ts`.
- Produces: `ConfirmCapabilityInput`, `confirmCapabilities`, `getCapabilitiesForCareerWin` -- Task 7 (`AddCareerWinModal`) imports `confirmCapabilities` and `ConfirmCapabilityInput`.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/careerVault/capabilities.test.ts
import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { confirmCapabilities, getCapabilitiesForCareerWin } from './capabilities'

vi.mock('@/lib/forwardDna/skills', () => ({
  getSkillStates: vi.fn(),
  upsertSkillState: vi.fn(),
}))

import { getSkillStates, upsertSkillState } from '@/lib/forwardDna/skills'

function makeFakeClient(opts: { insertRows?: unknown[]; insertError?: string; selectRows?: unknown[]; selectError?: string } = {}) {
  const insertSelect = vi.fn().mockResolvedValue({
    data: opts.insertRows ?? [],
    error: opts.insertError ? { message: opts.insertError } : null,
  })
  const insertMock = vi.fn().mockReturnValue({ select: insertSelect })

  const selectEqStatus = vi.fn().mockResolvedValue({
    data: opts.selectRows ?? [],
    error: opts.selectError ? { message: opts.selectError } : null,
  })
  const selectEqWin = vi.fn().mockReturnValue({ eq: selectEqStatus })
  const selectMock = vi.fn().mockReturnValue({ eq: selectEqWin })

  const fromMock = vi.fn().mockReturnValue({ insert: insertMock, select: selectMock })
  return { client: { from: fromMock } as unknown as SupabaseClient, insertMock, insertSelect, selectMock, selectEqWin, selectEqStatus }
}

describe('confirmCapabilities', () => {
  it('inserts one confirmed row per input, always at suggested_state demonstrated', async () => {
    vi.mocked(getSkillStates).mockResolvedValue({ skills: [], error: null })
    vi.mocked(upsertSkillState).mockResolvedValue({ error: null })
    const { client, insertMock } = makeFakeClient({ insertRows: [{ id: 'cap-1' }] })

    await confirmCapabilities(
      'u1',
      [{ careerWinId: 'win-1', skillName: 'Inventory Management', source: 'system', inferenceReason: 'Statement mentions inventory or stock.' }],
      client
    )

    expect(insertMock).toHaveBeenCalledWith([
      expect.objectContaining({
        career_win_id: 'win-1',
        user_id: 'u1',
        skill_name: 'Inventory Management',
        suggested_state: 'demonstrated',
        source: 'system',
        inference_reason: 'Statement mentions inventory or stock.',
        status: 'confirmed',
      }),
    ])
  })

  it('creates a brand-new career_skills row directly at demonstrated, skipping claimed', async () => {
    vi.mocked(getSkillStates).mockResolvedValue({ skills: [], error: null })
    vi.mocked(upsertSkillState).mockResolvedValue({ error: null })
    const { client } = makeFakeClient({ insertRows: [{ id: 'cap-1' }] })

    await confirmCapabilities(
      'u1',
      [{ careerWinId: 'win-1', skillName: 'People Development', source: 'system', inferenceReason: 'reason' }],
      client
    )

    expect(upsertSkillState).toHaveBeenCalledWith('u1', 'People Development', 'demonstrated', null, client)
  })

  it('upgrades an existing claimed skill to demonstrated', async () => {
    vi.mocked(getSkillStates).mockResolvedValue({
      skills: [{ id: 's1', user_id: 'u1', skill_name: 'Inventory Management', state: 'claimed', evidence_note: null, created_at: '', updated_at: '' }],
      error: null,
    })
    vi.mocked(upsertSkillState).mockResolvedValue({ error: null })
    const { client } = makeFakeClient({ insertRows: [{ id: 'cap-1' }] })

    await confirmCapabilities(
      'u1',
      [{ careerWinId: 'win-1', skillName: 'Inventory Management', source: 'system', inferenceReason: 'reason' }],
      client
    )

    expect(upsertSkillState).toHaveBeenCalledWith('u1', 'Inventory Management', 'demonstrated', null, client)
  })

  it('never downgrades and does not call upsertSkillState when the skill is already demonstrated or supported', async () => {
    vi.mocked(getSkillStates).mockResolvedValue({
      skills: [{ id: 's1', user_id: 'u1', skill_name: 'Leadership', state: 'supported', evidence_note: null, created_at: '', updated_at: '' }],
      error: null,
    })
    const { client } = makeFakeClient({ insertRows: [{ id: 'cap-1' }] })

    await confirmCapabilities(
      'u1',
      [{ careerWinId: 'win-1', skillName: 'Leadership', source: 'system', inferenceReason: 'reason' }],
      client
    )

    expect(upsertSkillState).not.toHaveBeenCalled()
  })

  it('does nothing and makes no calls when given an empty input list', async () => {
    const { client, insertMock } = makeFakeClient()
    const { capabilities, error } = await confirmCapabilities('u1', [], client)
    expect(capabilities).toEqual([])
    expect(error).toBeNull()
    expect(insertMock).not.toHaveBeenCalled()
    expect(getSkillStates).not.toHaveBeenCalled()
  })
})

describe('getCapabilitiesForCareerWin', () => {
  it('returns only confirmed capabilities for the given win', async () => {
    const rows = [{ id: 'cap-1', status: 'confirmed' }]
    const { client, selectEqWin, selectEqStatus } = makeFakeClient({ selectRows: rows })
    const { capabilities, error } = await getCapabilitiesForCareerWin('win-1', client)
    expect(error).toBeNull()
    expect(capabilities).toEqual(rows)
    expect(selectEqWin).toHaveBeenCalledWith('career_win_id', 'win-1')
    expect(selectEqStatus).toHaveBeenCalledWith('status', 'confirmed')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/careerVault/capabilities.test.ts`
Expected: FAIL -- `capabilities.ts` does not exist yet.

- [ ] **Step 3: Write the minimal implementation**

```typescript
// src/lib/careerVault/capabilities.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase as defaultClient } from '@/lib/supabase'
import { getSkillStates, upsertSkillState } from '@/lib/forwardDna/skills'
import type { SkillState } from '@/types/forwardDna'
import type { CareerWinCapability, CapabilitySource } from '@/types/careerVault'

const STATE_RANK: Record<SkillState, number> = { claimed: 0, demonstrated: 1, supported: 2 }

export interface ConfirmCapabilityInput {
  careerWinId: string
  skillName: string
  source: CapabilitySource
  inferenceReason: string | null
}

/**
 * Persists one confirmed career_win_capabilities row per input, then
 * upgrades career_skills.state to 'demonstrated' for each skill_name --
 * but only when the existing state (or absence of one) is weaker than
 * 'demonstrated'. Never downgrades a skill already at 'demonstrated' or
 * 'supported'. Locked to 'demonstrated' for v1 (spec section 7.1,
 * Decision 1) -- this function has no parameter that could produce
 * 'supported', matching the DB CHECK constraint from Task 1.
 */
export async function confirmCapabilities(
  userId: string,
  inputs: ConfirmCapabilityInput[],
  client: SupabaseClient = defaultClient
): Promise<{ capabilities: CareerWinCapability[]; error: string | null }> {
  if (inputs.length === 0) return { capabilities: [], error: null }

  const now = new Date().toISOString()
  const rows = inputs.map((input) => ({
    career_win_id: input.careerWinId,
    user_id: userId,
    skill_name: input.skillName,
    suggested_state: 'demonstrated' as const,
    source: input.source,
    inference_reason: input.inferenceReason,
    status: 'confirmed' as const,
    decided_at: now,
  }))

  const { data, error } = await client.from('career_win_capabilities').insert(rows).select('*')
  if (error) return { capabilities: [], error: error.message }

  const { skills: existing, error: readError } = await getSkillStates(userId, client)
  if (readError) return { capabilities: (data as CareerWinCapability[]) ?? [], error: readError }

  const existingByName = new Map(existing.map((s) => [s.skill_name, s]))

  for (const input of inputs) {
    const current = existingByName.get(input.skillName)
    const currentRank = current ? STATE_RANK[current.state] : -1
    if (currentRank >= STATE_RANK.demonstrated) continue

    const { error: upsertError } = await upsertSkillState(
      userId,
      input.skillName,
      'demonstrated',
      current?.evidence_note ?? null,
      client
    )
    if (upsertError) return { capabilities: (data as CareerWinCapability[]) ?? [], error: upsertError }
  }

  return { capabilities: (data as CareerWinCapability[]) ?? [], error: null }
}

export async function getCapabilitiesForCareerWin(
  careerWinId: string,
  client: SupabaseClient = defaultClient
): Promise<{ capabilities: CareerWinCapability[]; error: string | null }> {
  const { data, error } = await client
    .from('career_win_capabilities')
    .select('*')
    .eq('career_win_id', careerWinId)
    .eq('status', 'confirmed')

  return { capabilities: (data as CareerWinCapability[]) ?? [], error: error?.message ?? null }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/careerVault/capabilities.test.ts`
Expected: PASS, all 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/careerVault/capabilities.ts src/lib/careerVault/capabilities.test.ts
git commit -m "feat(career-vault): add capability confirmation with upgrade-only career_skills logic"
```

---

## Task 7: `AddCareerWinModal` -- the capture flow

**Files:**
- Create: `src/components/careerVault/AddCareerWinModal.tsx`
- Create: `src/components/careerVault/AddCareerWinModal.test.tsx`

**Interfaces:**
- Consumes: `DeterministicCareerWinInterpreter` (Task 3), `inferCapabilities` (Task 4), `createCareerWin` (Task 5), `confirmCapabilities` (Task 6), `EmploymentEntry` from `src/types`.
- Produces: `AddCareerWinModal` component with props `{ userId: string; employmentEntries: EmploymentEntry[]; onClose: () => void; onSaved: (careerWin: CareerWin) => void }` -- Task 9 (`CareerVaultPage`) renders this.

Follows the exact structural pattern of the existing `SubmitJobModal.tsx`
(fixed-inset overlay, bordered `FIELD_CLASS` inputs, disabled-until-valid
submit) -- reuse that visual/interaction convention, not a new one.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/components/careerVault/AddCareerWinModal.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AddCareerWinModal } from './AddCareerWinModal'

vi.mock('@/lib/careerVault/careerWins', () => ({ createCareerWin: vi.fn() }))
vi.mock('@/lib/careerVault/capabilities', () => ({ confirmCapabilities: vi.fn() }))

import { createCareerWin } from '@/lib/careerVault/careerWins'
import { confirmCapabilities } from '@/lib/careerVault/capabilities'

describe('AddCareerWinModal', () => {
  it('disables Continue until a statement is entered', () => {
    render(<AddCareerWinModal userId="u1" employmentEntries={[]} onClose={() => {}} onSaved={() => {}} />)
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled()
    fireEvent.change(screen.getByLabelText(/what happened/i), { target: { value: 'Reduced inventory loss by $31,000.' } })
    expect(screen.getByRole('button', { name: /continue/i })).not.toBeDisabled()
  })

  it('shows the detected metric and pre-checked capability suggestions after Continue', async () => {
    render(<AddCareerWinModal userId="u1" employmentEntries={[]} onClose={() => {}} onSaved={() => {}} />)
    fireEvent.change(screen.getByLabelText(/what happened/i), { target: { value: 'Reduced inventory loss by $31,000.' } })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))

    expect(await screen.findByText('$31,000')).toBeInTheDocument()
    const inventoryCheckbox = screen.getByLabelText('Inventory Management') as HTMLInputElement
    expect(inventoryCheckbox.checked).toBe(true)
  })

  it('excludes an unchecked suggestion from confirmCapabilities on Save', async () => {
    vi.mocked(createCareerWin).mockResolvedValue({ careerWin: { id: 'win-1' } as never, error: null })
    vi.mocked(confirmCapabilities).mockResolvedValue({ capabilities: [], error: null })
    const onSaved = vi.fn()

    render(<AddCareerWinModal userId="u1" employmentEntries={[]} onClose={() => {}} onSaved={onSaved} />)
    fireEvent.change(screen.getByLabelText(/what happened/i), { target: { value: 'Reduced inventory loss by $31,000.' } })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    await screen.findByText('$31,000')

    fireEvent.click(screen.getByLabelText('Inventory Management'))
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    const confirmedNames = vi.mocked(confirmCapabilities).mock.calls[0][1].map((c) => c.skillName)
    expect(confirmedNames).not.toContain('Inventory Management')
    expect(confirmedNames).toContain('Financial Performance')
  })

  it('calls onClose when Cancel is clicked on the input screen', () => {
    const onClose = vi.fn()
    render(<AddCareerWinModal userId="u1" employmentEntries={[]} onClose={onClose} onSaved={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onClose).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/careerVault/AddCareerWinModal.test.tsx`
Expected: FAIL -- `AddCareerWinModal.tsx` does not exist yet.

- [ ] **Step 3: Write the minimal implementation**

```typescript
// src/components/careerVault/AddCareerWinModal.tsx
import { useState, type ChangeEvent, type FormEvent } from 'react'
import { X, Loader2 } from 'lucide-react'
import { DeterministicCareerWinInterpreter } from '@/lib/careerVault/deterministicInterpreter'
import { inferCapabilities } from '@/lib/careerVault/capabilityEngine'
import { createCareerWin } from '@/lib/careerVault/careerWins'
import { confirmCapabilities } from '@/lib/careerVault/capabilities'
import type { CareerWin, MetricType } from '@/types/careerVault'
import type { EmploymentEntry } from '@/types'

interface AddCareerWinModalProps {
  userId: string
  employmentEntries: EmploymentEntry[]
  onClose: () => void
  onSaved: (careerWin: CareerWin) => void
}

interface SuggestionRow {
  skillName: string
  reason: string | null
  source: 'system' | 'member'
  checked: boolean
}

const interpreter = new DeterministicCareerWinInterpreter()

const FIELD_CLASS =
  'mt-1.5 w-full border border-neutral-300 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500'

export function AddCareerWinModal({ userId, employmentEntries, onClose, onSaved }: AddCareerWinModalProps) {
  const [step, setStep] = useState<'input' | 'review'>('input')
  const [statement, setStatement] = useState('')
  const [employmentEntryId, setEmploymentEntryId] = useState('')
  const [metric, setMetric] = useState<{ type: MetricType; value: number; raw: string } | null>(null)
  const [keepMetric, setKeepMetric] = useState(true)
  const [category, setCategory] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<SuggestionRow[]>([])
  const [newCapability, setNewCapability] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleContinue = async (e: FormEvent) => {
    e.preventDefault()
    if (!statement.trim()) return
    const interpreted = await interpreter.interpret(statement)
    setMetric(
      interpreted.metricValue !== null && interpreted.metricType !== null && interpreted.metricRaw !== null
        ? { type: interpreted.metricType, value: interpreted.metricValue, raw: interpreted.metricRaw }
        : null
    )
    setCategory(interpreted.category)
    setSuggestions(
      inferCapabilities(statement).map((s) => ({ skillName: s.skillName, reason: s.reason, source: 'system', checked: true }))
    )
    setStep('review')
  }

  const toggleSuggestion = (skillName: string) =>
    setSuggestions((prev) => prev.map((s) => (s.skillName === skillName ? { ...s, checked: !s.checked } : s)))

  const addMemberCapability = () => {
    const name = newCapability.trim()
    if (!name || suggestions.some((s) => s.skillName === name)) return
    setSuggestions((prev) => [...prev, { skillName: name, reason: null, source: 'member', checked: true }])
    setNewCapability('')
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    const { careerWin, error: winError } = await createCareerWin(userId, {
      originalStatement: statement,
      employmentEntryId: employmentEntryId || null,
      evidenceType: 'accomplishment',
      category,
      metricType: keepMetric ? metric?.type ?? null : null,
      metricValue: keepMetric ? metric?.value ?? null : null,
      metricRaw: keepMetric ? metric?.raw ?? null : null,
    })
    if (!careerWin) {
      setSaving(false)
      setError(winError ?? 'Could not save that Career Win. Please try again.')
      return
    }
    const checked = suggestions.filter((s) => s.checked)
    if (checked.length > 0) {
      await confirmCapabilities(
        userId,
        checked.map((s) => ({ careerWinId: careerWin.id, skillName: s.skillName, source: s.source, inferenceReason: s.reason }))
      )
    }
    setSaving(false)
    onSaved(careerWin)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg border border-neutral-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-lg font-semibold text-neutral-900">Add a Career Win</h2>
          <button onClick={onClose} aria-label="Close" className="p-1.5 text-neutral-400 hover:bg-neutral-50 hover:text-neutral-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && <div className="mb-4 border border-error-200 bg-error-50 px-4 py-2.5 text-sm text-error-700">{error}</div>}

        {step === 'input' && (
          <form onSubmit={handleContinue} className="space-y-4">
            <div>
              <label htmlFor="cw-statement" className="block text-sm font-medium text-neutral-700">What happened?</label>
              <textarea
                id="cw-statement"
                autoFocus
                value={statement}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setStatement(e.target.value)}
                required
                rows={4}
                placeholder="e.g. Reduced inventory loss by $31,000 by redesigning the receiving process."
                className={FIELD_CLASS}
              />
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={!statement.trim()}
                className="rounded-full bg-primary-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-60"
              >
                Continue
              </button>
              <button
                type="button"
                onClick={onClose}
                className="border border-neutral-300 px-5 py-2.5 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-50"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {step === 'review' && (
          <div className="space-y-4">
            <div className="border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700">{statement}</div>

            {metric && (
              <label className="flex items-center gap-2 text-sm text-neutral-700">
                <input type="checkbox" checked={keepMetric} onChange={() => setKeepMetric((v) => !v)} />
                Detected: <span className="font-medium">{metric.raw}</span>
              </label>
            )}

            {category && <p className="text-xs text-neutral-500">Category: {category}</p>}

            <div>
              <p className="mb-2 text-sm font-medium text-neutral-700">This may demonstrate:</p>
              <div className="space-y-2">
                {suggestions.map((s) => (
                  <label key={s.skillName} className="flex items-start gap-2 text-sm text-neutral-700">
                    <input type="checkbox" checked={s.checked} onChange={() => toggleSuggestion(s.skillName)} className="mt-0.5" />
                    <span>{s.skillName}</span>
                  </label>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <input
                  type="text"
                  value={newCapability}
                  onChange={(e) => setNewCapability(e.target.value)}
                  placeholder="Add another capability"
                  className={FIELD_CLASS}
                />
                <button
                  type="button"
                  onClick={addMemberCapability}
                  className="border border-neutral-300 px-4 py-2.5 text-sm font-medium text-neutral-600 hover:bg-neutral-50"
                >
                  Add
                </button>
              </div>
            </div>

            {employmentEntries.length > 0 && (
              <div>
                <label htmlFor="cw-entry" className="block text-sm font-medium text-neutral-700">
                  Role <span className="text-neutral-400">(optional)</span>
                </label>
                <select id="cw-entry" value={employmentEntryId} onChange={(e) => setEmploymentEntryId(e.target.value)} className={FIELD_CLASS}>
                  <option value="">Not tied to a specific role</option>
                  {employmentEntries.map((entry) => (
                    <option key={entry.id} value={entry.id}>{entry.title} at {entry.company}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 rounded-full bg-primary-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-60"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {saving ? 'Saving\u2026' : 'Save'}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="border border-neutral-300 px-5 py-2.5 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/careerVault/AddCareerWinModal.test.tsx`
Expected: PASS, all 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/components/careerVault/AddCareerWinModal.tsx src/components/careerVault/AddCareerWinModal.test.tsx
git commit -m "feat(career-vault): add AddCareerWinModal capture flow"
```

---

## Task 8: `CareerWinCard` -- shared read-only display

This single component is reused, unmodified, by both the member's own
Career Vault page (Task 9, with a delete affordance) and the
strategist's read-only tab (Task 11, without one) -- the `onDelete`
prop being optional is what makes it read-only by default, which is
the correct default for a component whose job is to render evidence a
strategist must never be able to edit (spec section 11).

**Files:**
- Create: `src/components/careerVault/CareerWinCard.tsx`
- Create: `src/components/careerVault/CareerWinCard.test.tsx`

**Interfaces:**
- Consumes: `CareerWinWithCapabilities` from `src/lib/careerVault/careerWins.ts` (Task 5).
- Produces: `CareerWinCard` component with props `{ careerWin: CareerWinWithCapabilities; onDelete?: () => void }` -- Task 9 and Task 11 both render this.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/components/careerVault/CareerWinCard.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CareerWinCard } from './CareerWinCard'
import type { CareerWinWithCapabilities } from '@/lib/careerVault/careerWins'

const win: CareerWinWithCapabilities = {
  id: 'win-1',
  user_id: 'u1',
  employment_entry_id: null,
  original_statement: 'Reduced inventory loss by $31,000.',
  evidence_type: 'accomplishment',
  category: 'Financial / Operational Impact',
  metric_type: 'currency',
  metric_value: 31000,
  metric_raw: '$31,000',
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
  capabilities: [
    {
      id: 'cap-1',
      career_win_id: 'win-1',
      user_id: 'u1',
      skill_name: 'Inventory Management',
      suggested_state: 'demonstrated',
      source: 'system',
      inference_reason: 'Statement mentions inventory or stock.',
      status: 'confirmed',
      decided_at: '2026-09-01T00:00:00Z',
      created_at: '2026-09-01T00:00:00Z',
    },
  ],
}

describe('CareerWinCard', () => {
  it('renders the original statement, metric, category, and confirmed capabilities', () => {
    render(<CareerWinCard careerWin={win} />)
    expect(screen.getByText('Reduced inventory loss by $31,000.')).toBeInTheDocument()
    expect(screen.getByText(/\$31,000/)).toBeInTheDocument()
    expect(screen.getByText(/Financial \/ Operational Impact/)).toBeInTheDocument()
    expect(screen.getByText('Inventory Management')).toBeInTheDocument()
  })

  it('renders no delete affordance when onDelete is not provided (read-only, strategist-safe default)', () => {
    render(<CareerWinCard careerWin={win} />)
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument()
  })

  it('renders a delete button and calls onDelete when provided (member-only usage)', () => {
    const onDelete = vi.fn()
    render(<CareerWinCard careerWin={win} onDelete={onDelete} />)
    const deleteButton = screen.getByRole('button', { name: /delete/i })
    deleteButton.click()
    expect(onDelete).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/careerVault/CareerWinCard.test.tsx`
Expected: FAIL -- `CareerWinCard.tsx` does not exist yet.

- [ ] **Step 3: Write the minimal implementation**

```typescript
// src/components/careerVault/CareerWinCard.tsx
import { Trash2 } from 'lucide-react'
import type { CareerWinWithCapabilities } from '@/lib/careerVault/careerWins'

interface CareerWinCardProps {
  careerWin: CareerWinWithCapabilities
  /** Omit for read-only rendering (e.g. the strategist workspace tab) -- only the member's own page passes this. */
  onDelete?: () => void
}

export function CareerWinCard({ careerWin, onDelete }: CareerWinCardProps) {
  return (
    <div className="border border-neutral-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-neutral-800">{careerWin.original_statement}</p>
        {onDelete && (
          <button
            onClick={onDelete}
            aria-label="Delete Career Win"
            className="flex-shrink-0 p-1 text-neutral-400 hover:text-error-600"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {careerWin.metric_raw && <p className="mt-2 text-xs text-neutral-500">Metric: {careerWin.metric_raw}</p>}
      {careerWin.category && <p className="text-xs text-neutral-500">Category: {careerWin.category}</p>}

      {careerWin.capabilities.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {careerWin.capabilities.map((cap) => (
            <span
              key={cap.id}
              title={cap.inference_reason ?? undefined}
              className="rounded-full bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700"
            >
              {cap.skill_name}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/careerVault/CareerWinCard.test.tsx`
Expected: PASS, all 3 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/components/careerVault/CareerWinCard.tsx src/components/careerVault/CareerWinCard.test.tsx
git commit -m "feat(career-vault): add shared read-only CareerWinCard"
```

---

## Task 9: `CareerVaultPage`, route, and nav item

**Files:**
- Create: `src/pages/CareerVaultPage.tsx`
- Create: `src/pages/CareerVaultPage.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/MemberLayout.tsx`

**Interfaces:**
- Consumes: `getCareerWinsWithCapabilities`, `deleteCareerWin`, `CareerWinWithCapabilities` (Task 5); `AddCareerWinModal` (Task 7); `CareerWinCard` (Task 8); `ensureProfile` (existing, `src/lib/profile.ts`); `ensureEmploymentEntryIdsForUser` (existing, `src/lib/forwardDna/employmentEntryIds.ts`).
- Produces: the `/career-vault` route, member-only, no `feature`/`requiredPlan` prop -- identical precedent to `/forward-dna`.

- [ ] **Step 1: Write the failing page tests**

```typescript
// src/pages/CareerVaultPage.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CareerVaultPage } from './CareerVaultPage'
import { getCareerWinsWithCapabilities, deleteCareerWin } from '@/lib/careerVault/careerWins'

const { mockAuthUser } = vi.hoisted(() => ({ mockAuthUser: { id: 'u1' } }))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: mockAuthUser, profile: null, refreshProfile: vi.fn() }),
}))

vi.mock('@/lib/profile', () => ({
  ensureProfile: vi.fn().mockResolvedValue({ employment_history: [] }),
}))

vi.mock('@/lib/forwardDna/employmentEntryIds', () => ({
  ensureEmploymentEntryIdsForUser: vi.fn().mockResolvedValue({ entries: [], error: null }),
}))

vi.mock('@/lib/careerVault/careerWins', () => ({
  getCareerWinsWithCapabilities: vi.fn(),
  deleteCareerWin: vi.fn(),
}))

// MemberLayout independently fires its own Supabase queries (entitlements,
// badges, unread counts) with mixed chain shapes -- reuse the proven
// chainable+thenable double from ForwardDnaPage.test.tsx / DashboardPage.test.tsx.
const { maybeSingleMock } = vi.hoisted(() => ({
  maybeSingleMock: vi.fn().mockResolvedValue({ data: null, error: null }),
}))

function makeBuilder() {
  const result = { data: null, error: null }
  const builder: Record<string, unknown> = {}
  const chain = () => builder
  builder.select = chain
  builder.eq = chain
  builder.order = chain
  builder.gte = chain
  builder.limit = chain
  builder.update = chain
  builder.maybeSingle = maybeSingleMock
  builder.then = (resolve: (value: typeof result) => void) => resolve(result)
  return builder
}

vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn().mockImplementation(() => makeBuilder()) },
}))

describe('CareerVaultPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows an empty state when there are no Career Wins yet', async () => {
    vi.mocked(getCareerWinsWithCapabilities).mockResolvedValue({ careerWins: [], error: null })
    render(<MemoryRouter><CareerVaultPage /></MemoryRouter>)
    await waitFor(() => expect(screen.getByText('Career Vault')).toBeInTheDocument())
    expect(screen.getByText(/No Career Wins yet/)).toBeInTheDocument()
  })

  it('renders a CareerWinCard for each returned Career Win', async () => {
    vi.mocked(getCareerWinsWithCapabilities).mockResolvedValue({
      careerWins: [{ id: 'win-1', original_statement: 'Reduced inventory loss by $31,000.', capabilities: [], metric_raw: null, category: null } as never],
      error: null,
    })
    render(<MemoryRouter><CareerVaultPage /></MemoryRouter>)
    await waitFor(() => expect(screen.getByText('Reduced inventory loss by $31,000.')).toBeInTheDocument())
  })

  it('opens AddCareerWinModal when "Add Career Win" is clicked', async () => {
    vi.mocked(getCareerWinsWithCapabilities).mockResolvedValue({ careerWins: [], error: null })
    render(<MemoryRouter><CareerVaultPage /></MemoryRouter>)
    await waitFor(() => expect(screen.getByText('Career Vault')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /add career win/i }))
    expect(screen.getByText('Add a Career Win')).toBeInTheDocument()
  })

  it("calls deleteCareerWin and reloads when a card's delete button is clicked", async () => {
    vi.mocked(getCareerWinsWithCapabilities).mockResolvedValue({
      careerWins: [{ id: 'win-1', original_statement: 'Reduced inventory loss by $31,000.', capabilities: [], metric_raw: null, category: null } as never],
      error: null,
    })
    vi.mocked(deleteCareerWin).mockResolvedValue({ error: null })
    render(<MemoryRouter><CareerVaultPage /></MemoryRouter>)
    await waitFor(() => expect(screen.getByText('Reduced inventory loss by $31,000.')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /delete career win/i }))
    await waitFor(() => expect(deleteCareerWin).toHaveBeenCalledWith('win-1'))
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/pages/CareerVaultPage.test.tsx`
Expected: FAIL -- `CareerVaultPage.tsx` does not exist yet.

- [ ] **Step 3: Write the minimal page implementation**

```typescript
// src/pages/CareerVaultPage.tsx
import { useEffect, useState, useCallback } from 'react'
import { MemberLayout } from '@/components/MemberLayout'
import { useAuth } from '@/context/AuthContext'
import { ensureProfile } from '@/lib/profile'
import { ensureEmploymentEntryIdsForUser } from '@/lib/forwardDna/employmentEntryIds'
import { getCareerWinsWithCapabilities, deleteCareerWin, type CareerWinWithCapabilities } from '@/lib/careerVault/careerWins'
import { AddCareerWinModal } from '@/components/careerVault/AddCareerWinModal'
import { CareerWinCard } from '@/components/careerVault/CareerWinCard'
import { Loader2, Plus } from 'lucide-react'
import type { MemberProfile, EmploymentEntry } from '@/types'
import type { CareerWin } from '@/types/careerVault'

export function CareerVaultPage() {
  const { user } = useAuth()
  const [entries, setEntries] = useState<EmploymentEntry[]>([])
  const [careerWins, setCareerWins] = useState<CareerWinWithCapabilities[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    const profile = (await ensureProfile(user.id)) as MemberProfile | null
    if (!profile) return
    const { entries: idEntries } = await ensureEmploymentEntryIdsForUser(user.id, profile.employment_history || [])
    setEntries(idEntries)
    const { careerWins: wins } = await getCareerWinsWithCapabilities(user.id)
    setCareerWins(wins)
    setLoading(false)
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  const handleSaved = (_careerWin: CareerWin) => {
    setShowModal(false)
    load()
  }

  const handleDelete = async (careerWinId: string) => {
    await deleteCareerWin(careerWinId)
    load()
  }

  if (loading) {
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
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-neutral-900 sm:text-3xl">Career Vault</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Log what you actually did -- FreshlyForward turns it into evidence for Forward DNA.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 rounded-full bg-primary-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700"
        >
          <Plus className="h-4 w-4" />
          Add Career Win
        </button>
      </div>

      {careerWins.length === 0 ? (
        <div className="border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-500">
          No Career Wins yet. Add your first one to start building evidence for Forward DNA.
        </div>
      ) : (
        <div className="space-y-4">
          {careerWins.map((win) => (
            <CareerWinCard key={win.id} careerWin={win} onDelete={() => handleDelete(win.id)} />
          ))}
        </div>
      )}

      {showModal && user && (
        <AddCareerWinModal
          userId={user.id}
          employmentEntries={entries}
          onClose={() => setShowModal(false)}
          onSaved={handleSaved}
        />
      )}
    </MemberLayout>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/pages/CareerVaultPage.test.tsx`
Expected: PASS, all 4 tests green.

- [ ] **Step 5: Wire the route**

In `src/App.tsx`, add the import next to the existing `ForwardDnaPage` import:

```typescript
import { CareerVaultPage } from '@/pages/CareerVaultPage'
```

Add the route immediately after the existing `/forward-dna` route block:

```typescript
        <Route
          path="/career-vault"
          element={
            <ProtectedRoute>
              <CareerVaultPage />
            </ProtectedRoute>
          }
        />
```

Note: no `feature` or `requiredPlan` prop on `ProtectedRoute`, matching `/forward-dna` exactly -- Global Constraints requires Career Vault to be free for every authenticated member.

- [ ] **Step 6: Wire the nav item**

In `src/components/MemberLayout.tsx`, add `Trophy` to the existing `lucide-react` import list (alongside `Dna`), and add one entry to the `'My Search'` group's `items` array immediately after the existing Forward DNA entry:

```typescript
      { to: '/forward-dna', label: 'Forward DNA', icon: Dna, isNew: true },
      { to: '/career-vault', label: 'Career Vault', icon: Trophy, isNew: true },
```

- [ ] **Step 7: Run the full existing suite to confirm no regressions from the nav/route change**

Run: `npx vitest run`
Expected: PASS, no existing test broken by the new import/route/nav entry.

- [ ] **Step 8: Commit**

```bash
git add src/pages/CareerVaultPage.tsx src/pages/CareerVaultPage.test.tsx src/App.tsx src/components/MemberLayout.tsx
git commit -m "feat(career-vault): add CareerVaultPage, route, and nav entry"
```

---

## Task 10: Forward DNA teaser card

The only change `ForwardDnaPage.tsx` receives in this entire project:
one new presentational card, linking out, exactly mirroring how
`CompassSummaryCard` already links out to the full Career Compass
results page rather than re-rendering it (spec section 10). No data
model change on this page.

**Files:**
- Create: `src/components/careerVault/CareerVaultTeaserCard.tsx`
- Create: `src/components/careerVault/CareerVaultTeaserCard.test.tsx`
- Modify: `src/pages/ForwardDnaPage.tsx`
- Modify: `src/pages/ForwardDnaPage.test.tsx`

**Interfaces:**
- Consumes: nothing (pure presentational link, no props).
- Produces: `CareerVaultTeaserCard` component, rendered once by `ForwardDnaPage`.

- [ ] **Step 1: Write the failing component test**

```typescript
// src/components/careerVault/CareerVaultTeaserCard.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CareerVaultTeaserCard } from './CareerVaultTeaserCard'

describe('CareerVaultTeaserCard', () => {
  it('links to /career-vault', () => {
    render(
      <MemoryRouter>
        <CareerVaultTeaserCard />
      </MemoryRouter>
    )
    expect(screen.getByRole('link', { name: /career vault/i })).toHaveAttribute('href', '/career-vault')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/careerVault/CareerVaultTeaserCard.test.tsx`
Expected: FAIL -- `CareerVaultTeaserCard.tsx` does not exist yet.

- [ ] **Step 3: Write the minimal implementation**

```typescript
// src/components/careerVault/CareerVaultTeaserCard.tsx
import { Link } from 'react-router-dom'
import { Trophy } from 'lucide-react'

export function CareerVaultTeaserCard() {
  return (
    <Link
      to="/career-vault"
      className="block border border-neutral-200 bg-white p-4 transition-colors hover:border-primary-300"
    >
      <div className="flex items-center gap-3">
        <Trophy className="h-5 w-5 flex-shrink-0 text-primary-600" />
        <div>
          <p className="font-serif text-sm font-semibold text-neutral-900">Career Vault</p>
          <p className="text-xs text-neutral-600">Log a Career Win to add real evidence to your Forward DNA.</p>
        </div>
      </div>
    </Link>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/careerVault/CareerVaultTeaserCard.test.tsx`
Expected: PASS.

- [ ] **Step 5: Render it from `ForwardDnaPage.tsx`**

Add the import near the other `components/forwardDna/*` imports:

```typescript
import { CareerVaultTeaserCard } from '@/components/careerVault/CareerVaultTeaserCard'
```

Modify the sidebar `<div>` (currently containing only `CompletenessWidget`) to add spacing and render the new card beneath it:

```typescript
        <div className="space-y-6">
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
          <CareerVaultTeaserCard />
        </div>
```

- [ ] **Step 6: Add a regression assertion to `ForwardDnaPage.test.tsx`**

In the existing `'renders the page title and every section once data loads'` test, add one more assertion alongside the existing section checks:

```typescript
    expect(screen.getByText('Career Vault')).toBeInTheDocument()
```

- [ ] **Step 7: Run the full `ForwardDnaPage` test file to verify it still passes**

Run: `npx vitest run src/pages/ForwardDnaPage.test.tsx`
Expected: PASS, including the new assertion.

- [ ] **Step 8: Commit**

```bash
git add src/components/careerVault/CareerVaultTeaserCard.tsx src/components/careerVault/CareerVaultTeaserCard.test.tsx src/pages/ForwardDnaPage.tsx src/pages/ForwardDnaPage.test.tsx
git commit -m "feat(career-vault): add Forward DNA teaser card linking to Career Vault"
```

---

## Task 11: Strategist read-only tab

**Design note (deviation from the spec's suggestion, with reasoning):**
`StrategistMemberWorkspacePage.tsx` is already ~49KB with no existing
test file, and every one of its existing tabs (`NotesTab`, `TimelineTab`,
etc.) is defined inline in that same giant file. Rather than grow an
already-large, untested file further, this task extracts the new tab
as its own small, independently-testable component --
`src/pages/strategist/CareerVaultTab.tsx` -- and wires it into the page
with a minimal two-line diff (one import, one tab entry, one render
line). This keeps the new, safety-sensitive read-only logic
(critically: it must never render a delete/edit control) under direct
test coverage without having to reverse-engineer mocks for the other
eight unrelated tabs just to render the page at all.

**Files:**
- Create: `src/pages/strategist/CareerVaultTab.tsx`
- Create: `src/pages/strategist/CareerVaultTab.test.tsx`
- Modify: `src/pages/strategist/StrategistMemberWorkspacePage.tsx`

**Interfaces:**
- Consumes: `getCareerWinsWithCapabilities`, `CareerWinWithCapabilities` (Task 5); `CareerWinCard` (Task 8, called with **no** `onDelete` prop -- this is what makes it read-only).
- Produces: `CareerVaultTab` component with props `{ memberId: string }`.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/pages/strategist/CareerVaultTab.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { CareerVaultTab } from './CareerVaultTab'
import { getCareerWinsWithCapabilities } from '@/lib/careerVault/careerWins'

vi.mock('@/lib/careerVault/careerWins', () => ({
  getCareerWinsWithCapabilities: vi.fn(),
}))

describe('CareerVaultTab', () => {
  it("shows an empty state when the member has no Career Wins", async () => {
    vi.mocked(getCareerWinsWithCapabilities).mockResolvedValue({ careerWins: [], error: null })
    render(<CareerVaultTab memberId="member-1" />)
    await waitFor(() => expect(screen.getByText(/hasn't logged any Career Wins/i)).toBeInTheDocument())
    expect(getCareerWinsWithCapabilities).toHaveBeenCalledWith('member-1')
  })

  it("renders a CareerWinCard for each of the member's Career Wins", async () => {
    vi.mocked(getCareerWinsWithCapabilities).mockResolvedValue({
      careerWins: [{ id: 'win-1', original_statement: 'Reduced inventory loss by $31,000.', capabilities: [], metric_raw: null, category: null } as never],
      error: null,
    })
    render(<CareerVaultTab memberId="member-1" />)
    await waitFor(() => expect(screen.getByText('Reduced inventory loss by $31,000.')).toBeInTheDocument())
  })

  it('never renders a delete affordance -- this tab is read-only for strategists/admins, no exceptions', async () => {
    vi.mocked(getCareerWinsWithCapabilities).mockResolvedValue({
      careerWins: [{ id: 'win-1', original_statement: 'Reduced inventory loss by $31,000.', capabilities: [], metric_raw: null, category: null } as never],
      error: null,
    })
    render(<CareerVaultTab memberId="member-1" />)
    await waitFor(() => expect(screen.getByText('Reduced inventory loss by $31,000.')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/pages/strategist/CareerVaultTab.test.tsx`
Expected: FAIL -- `CareerVaultTab.tsx` does not exist yet.

- [ ] **Step 3: Write the minimal implementation**

```typescript
// src/pages/strategist/CareerVaultTab.tsx
import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { getCareerWinsWithCapabilities, type CareerWinWithCapabilities } from '@/lib/careerVault/careerWins'
import { CareerWinCard } from '@/components/careerVault/CareerWinCard'

interface CareerVaultTabProps {
  memberId: string
}

/**
 * Read-only, full stop. Never passes onDelete to CareerWinCard --
 * strategists and admins can view a member's Career Vault evidence but
 * can never edit or delete it (spec section 11). The RLS SELECT policy
 * from the migration enforces this server-side too; this component
 * additionally never renders a control that could attempt it.
 */
export function CareerVaultTab({ memberId }: CareerVaultTabProps) {
  const [careerWins, setCareerWins] = useState<CareerWinWithCapabilities[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    getCareerWinsWithCapabilities(memberId).then(({ careerWins: wins }) => {
      if (cancelled) return
      setCareerWins(wins)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [memberId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
      </div>
    )
  }

  if (careerWins.length === 0) {
    return (
      <div className="border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-500">
        This member hasn't logged any Career Wins yet.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {careerWins.map((win) => (
        <CareerWinCard key={win.id} careerWin={win} />
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/pages/strategist/CareerVaultTab.test.tsx`
Expected: PASS, all 3 tests green -- including the read-only guarantee.

- [ ] **Step 5: Wire the tab into `StrategistMemberWorkspacePage.tsx`**

Add the import near the top of the file, alongside the other lucide-react icons (add `Trophy` to the existing multi-icon import list) and add:

```typescript
import { CareerVaultTab } from './CareerVaultTab'
```

Extend the `TabKey` union:

```typescript
type TabKey = 'snapshot' | 'opportunities' | 'applications' | 'resumes' | 'cover_letters' | 'notes' | 'follow_ups' | 'messages' | 'timeline' | 'career_vault'
```

Add one entry to the `tabs` array, immediately after the existing `notes` entry:

```typescript
  { key: 'notes', label: 'Career Notes', icon: ClipboardList },
  { key: 'career_vault', label: 'Career Vault', icon: Trophy },
```

Add one render line, immediately after the existing `notes` tab-content line:

```typescript
      {activeTab === 'notes' && <NotesTab memberId={memberId!} strategistId={user?.id || ''} />}
      {activeTab === 'career_vault' && <CareerVaultTab memberId={memberId!} />}
```

- [ ] **Step 6: Run `tsc` and the full suite to confirm the wiring compiles and nothing else broke**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no new errors, no regressions. (No new page-level test is added for `StrategistMemberWorkspacePage.tsx` itself -- see the design note above; the new logic is fully covered by `CareerVaultTab.test.tsx`, and this two-line wiring diff carries negligible independent risk.)

- [ ] **Step 7: Commit**

```bash
git add src/pages/strategist/CareerVaultTab.tsx src/pages/strategist/CareerVaultTab.test.tsx src/pages/strategist/StrategistMemberWorkspacePage.tsx
git commit -m "feat(career-vault): add read-only strategist Career Vault tab"
```

---

## Task 12: Search Readiness regression test + final full-suite pass

**Files:**
- Create: `src/lib/profile.searchReadinessRegression.test.ts`
- No other files modified (verification-only task).

**Interfaces:**
- Consumes: `calculateSearchReadiness` (existing, unmodified) from `src/lib/profile.ts`.
- Produces: nothing new -- a locked-down characterization test guarding Global Constraints' Search Readiness rule for every future change to this codebase, not just this project.

- [ ] **Step 1: Write the regression test**

```typescript
// src/lib/profile.searchReadinessRegression.test.ts
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

// Characterization test locking down that Search Readiness's field list
// and weights are untouched by the Career Vault project (spec section
// 12 / plan Global Constraints). If this test ever needs to change, that
// change must be deliberate and reviewed on its own -- not an incidental
// side effect of unrelated work.
const EXPECTED_FIELDS = [
  'full_name', 'phone', 'location', 'headline', 'summary', 'employment_history',
  'education', 'skills', 'preferred_jobs', 'preferred_industries', 'salary_min',
  'remote_preference', 'schedule_preference', 'work_style', 'career_goals',
  'strengths', 'motivators', 'application_authorized', 'electronic_consent',
]

describe('calculateSearchReadiness -- Career Vault non-regression', () => {
  it("readinessChecks' field list is unchanged (byte-for-byte field names, in order)", () => {
    const source = fs.readFileSync(path.resolve(__dirname, 'profile.ts'), 'utf-8')
    const fieldMatches = [...source.matchAll(/field: '([a-z_]+)'/g)].map((m) => m[1])
    expect(fieldMatches).toEqual(EXPECTED_FIELDS)
  })

  it('src/lib/profile.ts never imports anything from the careerVault module tree', () => {
    const source = fs.readFileSync(path.resolve(__dirname, 'profile.ts'), 'utf-8')
    expect(source).not.toMatch(/careerVault/)
  })
})
```

- [ ] **Step 2: Run the test to verify it passes against the current, untouched `profile.ts`**

Run: `npx vitest run src/lib/profile.searchReadinessRegression.test.ts`
Expected: PASS. If this fails, something in Tasks 1-11 touched `profile.ts` or its field list -- stop and investigate before proceeding; do not adjust this test to make it pass.

- [ ] **Step 3: Commit the regression test**

```bash
git add src/lib/profile.searchReadinessRegression.test.ts
git commit -m "test(career-vault): lock down Search Readiness field list against regression"
```

- [ ] **Step 4: Run the entire existing test suite**

Run: `npx vitest run`
Expected: PASS -- every test in the repository, not just the new ones, including the full Job Discovery Hardening and Forward DNA suites from prior projects.

- [ ] **Step 5: Run the TypeScript compiler**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 6: Run the production build**

Run: `npm run build` (or the project's equivalent Vite build script)
Expected: clean build, no errors.

- [ ] **Step 7: Manual/staging RLS verification checklist (cannot be automated in this sandbox -- no live Supabase/DB access, consistent with every prior migration in this project's history)**

Against a staging Supabase instance with the Task 1 migration applied,
as real (or seeded) test accounts, verify:

- [ ] A member can SELECT/INSERT/UPDATE/DELETE only their own `career_wins` and `career_win_capabilities` rows.
- [ ] A member cannot SELECT another member's `career_wins`/`career_win_capabilities` rows.
- [ ] An unassigned strategist (no active `strategist_assignments` row for that member) cannot SELECT that member's rows.
- [ ] An assigned, active strategist CAN SELECT that member's rows, but an INSERT/UPDATE/DELETE attempt from that strategist's session FAILS.
- [ ] An admin (JWT `app_metadata.role = 'admin'`) CAN SELECT any member's rows, but an INSERT/UPDATE/DELETE attempt FAILS (read-only holds even for admin).
- [ ] Attempting to insert a `career_win_capabilities` row with `suggested_state = 'supported'` is rejected by the CHECK constraint, from any role.

- [ ] **Step 8: Manual mobile-viewport check**

Open `/career-vault` on an actual mobile-width viewport (or device
emulation) and confirm the "What happened?" screen requires only the
one textarea to reach "Continue", and the review screen's checkbox
list + optional role picker remain usable without horizontal scrolling
-- flagged in spec section 16 as a risk needing real on-device
confirmation, not something a unit test can verify.

- [ ] **Step 9: Update the spec's status line**

In `docs/superpowers/specs/2026-09-01-career-vault-capability-engine-design.md`,
change the header status line to record that implementation is
complete and verified, once Steps 1-8 above are all green.

- [ ] **Step 10: Final commit**

```bash
git add -A
git commit -m "chore(career-vault): final regression pass -- full suite green, tsc clean, RLS verified"
```

---

## Self-Review (performed by the plan author, 2026-09-01)

**1. Spec coverage.** Walked every numbered section of
`docs/superpowers/specs/2026-09-01-career-vault-capability-engine-design.md`
against this plan:

| Spec section | Covered by |
|---|---|
| §4.1/§4.2 schema | Task 1 |
| §6 deterministic interpreter | Task 3 |
| §7/§7.1 capability model + locked decisions | Task 4 (engine), Task 6 (upgrade-only write, `demonstrated`-only constraint) |
| §8 confirmation flow | Task 6, Task 7 |
| §9 evidence/provenance | Task 5 (`getCareerWinsWithCapabilities` two-query join), Task 8 (renders capability + `inference_reason` via title attribute) |
| §10 Forward DNA integration | Task 6 (writes to the one channel, `career_skills.state`), Task 10 (teaser card, no data-model change to Forward DNA itself) |
| §11 strategist/admin integration | Task 11 |
| §12 Search Readiness protection | Global Constraints + Task 12's regression test |
| §13 files expected to change | File Structure table mirrors this list exactly |
| §14 migration strategy | Task 1 |
| §15 testing strategy | Distributed across every task's test steps; anti-fabrication suite specifically in Task 3; RLS checklist in Task 12 |
| §16 risks | Addressed through design choices in the relevant tasks (e.g. upgrade-only logic in Task 6 mitigates the drift risk; no task independently "re-litigates" §16, which is correct -- it's a risk register, not a to-do list) |
| §17 scope check (locked) | Global Constraints explicitly forbids each excluded item; no task implements any of them |
| §19 locked decisions record | Task 1's CHECK constraint and Task 6's hardcoded `'demonstrated'` literal are the direct implementation of both locked decisions |

**Two spec items intentionally NOT converted into tasks, with reasoning
(per your own new instruction to keep v1 tightly focused on only what's
technically necessary for the core flow):**

- Spec §9/§13 mentions an *optional* expandable "Evidence" disclosure
  inside the existing `SkillEvidenceCard.tsx`, explicitly marked
  optional in the spec's own file list. The core Career Win ->
  Capability Engine -> Forward DNA flow is fully functional and fully
  explainable via Task 8's `CareerWinCard` (which already shows the
  `inference_reason` as a tooltip) without this addition. Since it is
  explicitly optional in the spec and not technically necessary to
  complete the core loop, it is deferred rather than built now --
  consistent with your instruction not to pull in anything beyond what
  the core flow requires. It can be added as a small follow-up task
  later without touching any table or CRUD module.
- Spec §5/§13 mentions an *optional* shortcut button on `DashboardPage.tsx`
  in addition to the `/forward-dna` teaser. Same reasoning: the
  `/career-vault` nav item (Task 9) plus the Forward DNA teaser (Task
  10) already give every member two independent, always-visible paths
  to Career Vault; a third entry point on the dashboard is additive
  polish, not a requirement of the core flow, so it is deferred.

**2. Placeholder scan.** Searched every task for "TBD", "similar to
Task N", "implement later", "add appropriate error handling", or any
step describing behavior without showing the code. None found -- every
step that produces code shows the exact code; every verification step
names the exact command and expected result; the two manual-only steps
in Task 12 (RLS checklist, mobile-viewport check) are legitimately
unautomatable in this sandbox (no live Supabase/device lab), not lazy
placeholders, and each has a concrete, checkable list of assertions.

**3. Type/name consistency.** Verified across all 12 tasks:

- `CreateCareerWinInput` fields (`originalStatement`, `employmentEntryId`,
  `evidenceType`, `category`, `metricType`, `metricValue`, `metricRaw`)
  are identical between Task 5's definition and Task 7's call site.
- `ConfirmCapabilityInput` fields (`careerWinId`, `skillName`, `source`,
  `inferenceReason`) are identical between Task 6's definition and
  Task 7's call site.
- `CareerWinWithCapabilities` is defined once in Task 5 and imported
  with the same name/shape in Task 8, Task 9, and Task 11 -- no
  competing definition anywhere.
- `CareerWinCard`'s `onDelete?: () => void` optionality is defined once
  in Task 8 and its two call sites (Task 9 passes it, Task 11
  deliberately does not) both match that exact signature.
- `getCareerWinsWithCapabilities(userId, client?)` signature is
  identical at its Task 5 definition and both its Task 9 and Task 11
  call sites.
- `suggested_state` is the literal string `'demonstrated'` everywhere
  it appears (Task 1's CHECK constraint, Task 2's type, Task 6's insert
  payload) -- no task ever introduces `'supported'` as a possible value
  for this column.

**Result: no gaps, no placeholders, no naming drift found.** This plan
is ready for execution once you approve it.

## Requesting Execution Approval

This plan is now complete and matches the locked spec. Per the
Global Constraints and Task 12's final step, executing all 12 tasks
will deliver the full Career Vault -> Capability Engine -> Forward DNA
evidence flow with zero changes to Search Readiness, FreshFit, or the
core Forward DNA data model, and zero AI/LLM integration.

**No implementation has begun.** Awaiting your explicit go-ahead
before any task in this plan is executed.

