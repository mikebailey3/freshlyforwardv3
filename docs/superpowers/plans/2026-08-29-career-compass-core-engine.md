# Career Compass Core Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the deterministic, fully unit-tested core of Career Compass —
domain types, the 24-item Archetype question bank, the 9-item Forward
Readiness question bank, and the three pure scoring/recommendation engines —
with zero UI or database dependency, so it is independently reviewable and
testable before any persistence or UI work begins.

**Architecture:** Six small, single-responsibility TypeScript modules under
`src/lib/careerCompass/` (plus a types file and two data files), following
the existing `lib/freshFitScore.ts` style: pure functions, no I/O, no LLM
calls, fully deterministic and explainable. Every module is unit-tested with
Vitest before the next module is built on top of it.

**Tech Stack:** TypeScript, Vitest (already configured in this repo via
`vitest.config.ts` / `vitest.setup.ts` — no new dependencies).

**Spec:** `docs/superpowers/specs/2026-08-29-career-compass-design.md`

## Global Constraints

- No new npm dependencies (spec section 9 / product brief: "do not
  introduce unnecessary dependencies").
- Code calculates, AI interprets — every function in this plan is pure and
  deterministic; no network or AI calls anywhere in this plan's scope.
- Plan recommendations must only ever output one of the four real plan
  slugs (`career-kickstart`, `founding-member`, `career-growth`,
  `career-concierge`) or `null` (no plan) — never an invented plan name.
- Identical input must always produce identical output (spec section 6/11
  — reproducibility is an acceptance criterion, not a nice-to-have).
- Existing `src/types/index.ts` is already 818 lines. This plan adds a
  **new** `src/types/careerCompass.ts` file instead of growing that file
  further — a deliberate deviation from the product brief's literal
  wording ("modify types/index.ts"), made to keep files focused per this
  project's own file-size discipline. Nothing in `types/index.ts` is
  touched by this plan.
- Follow existing repo conventions: co-located `*.test.ts` files (see
  `src/components/FridayReportCard.test.tsx` for the pattern), Vitest
  `describe`/`it`, no emojis in code, comments, or commit messages.

---

## Task 1: Domain Types

**Files:**
- Create: `src/types/careerCompass.ts`

**Interfaces:**
- Produces: `DimensionKey`, `ArchetypeKey`, `ArchetypeQuestion`,
  `ArchetypeAnswer`, `ArchetypeAnswers`, `DimensionScores`,
  `ArchetypeScores`, `ArchetypeResult`, `ReadinessDimensionKey`,
  `ReadinessBarrierKey`, `TransitionType`, `ReadinessOption`,
  `ReadinessQuestion`, `ReadinessAnswers`, `ReadinessResult`,
  `RecommendedPlanSlug`, `PlanRecommendation` — every later task in this
  plan imports from this file and only this file for types.

This is a types-only file (no runtime behavior), so there is nothing to
unit test beyond "it compiles." The verification step is `tsc`, not
Vitest.

- [ ] **Step 1: Write the types file**

```ts
// src/types/careerCompass.ts

// ============================================================
// Part A — Career Archetype
// ============================================================

export type DimensionKey =
  | 'peopleFocus'
  | 'leadershipDrive'
  | 'structurePreference'
  | 'ambiguityTolerance'
  | 'analyticalOrientation'
  | 'workPace'

export type ArchetypeKey =
  | 'driver'
  | 'connector'
  | 'strategist'
  | 'builder'
  | 'explorer'
  | 'creator'

export interface ArchetypeQuestion {
  id: string
  text: string
  dimension: DimensionKey
  reverseScored: boolean
  weight: number
}

export type ArchetypeAnswer = 1 | 2 | 3 | 4 | 5

export type ArchetypeAnswers = Record<string, ArchetypeAnswer>

export type DimensionScores = Record<DimensionKey, number>

export type ArchetypeScores = Record<ArchetypeKey, number>

export interface ArchetypeResult {
  dimensionScores: DimensionScores
  archetypeScores: ArchetypeScores
  primaryArchetype: ArchetypeKey
  secondaryArchetype: ArchetypeKey
}

// ============================================================
// Part B — Forward Readiness
// ============================================================

export type ReadinessDimensionKey =
  | 'careerDirection'
  | 'resumePositioning'
  | 'searchStrategy'
  | 'applicationResults'
  | 'interviewConfidence'

export type ReadinessBarrierKey =
  | 'careerDirection'
  | 'resumePositioning'
  | 'searchStrategy'
  | 'applicationConversion'
  | 'interviewPerformance'

export type TransitionType =
  | 'first_job'
  | 'industry_change'
  | 'career_change'
  | 'advancement'
  | 'returning'

export interface ReadinessOption {
  label: string
  value: number
  transitionValue?: TransitionType
}

export interface ReadinessQuestion {
  id: string
  text: string
  dimension: ReadinessDimensionKey | 'supportNeed' | 'urgency' | 'transitionType'
  options: ReadinessOption[]
}

/** Maps a readiness question id to the index of the option the user chose. */
export type ReadinessAnswers = Record<string, number>

export interface ReadinessResult {
  dimensionScores: {
    careerDirection: number
    resumePositioning: number
    searchStrategy: number
    applicationResults: number
    interviewConfidence: number
  }
  supportNeed: number
  urgency: number
  transitionType: TransitionType | null
  isComplexTransition: boolean
  overallScore: number
  primaryBarrier: ReadinessBarrierKey
  secondaryBarrier: ReadinessBarrierKey
}

// ============================================================
// Recommendation Engine
// ============================================================

export type RecommendedPlanSlug =
  | 'career-kickstart'
  | 'founding-member'
  | 'career-growth'
  | 'career-concierge'
  | null

export interface PlanRecommendation {
  planSlug: RecommendedPlanSlug
  serviceFitPct: number
  reasons: string[]
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors related to `src/types/careerCompass.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/types/careerCompass.ts
git commit -m "feat(career-compass): add domain types"
```

---

## Task 2: Question Banks

**Files:**
- Create: `src/data/careerCompassQuestions.ts`
- Create: `src/data/careerCompassQuestions.test.ts`
- Create: `src/data/forwardReadinessQuestions.ts`
- Create: `src/data/forwardReadinessQuestions.test.ts`

**Interfaces:**
- Consumes: `ArchetypeQuestion`, `DimensionKey`, `ReadinessQuestion` from
  `src/types/careerCompass.ts` (Task 1).
- Produces: `archetypeQuestions: ArchetypeQuestion[]` (24 items),
  `forwardReadinessQuestions: ReadinessQuestion[]` (9 items) — every later
  task imports these two arrays by name.

- [ ] **Step 1: Write the failing structural tests for the archetype bank**

```ts
// src/data/careerCompassQuestions.test.ts
import { describe, it, expect } from 'vitest'
import { archetypeQuestions } from './careerCompassQuestions'
import type { DimensionKey } from '@/types/careerCompass'

const DIMENSIONS: DimensionKey[] = [
  'peopleFocus', 'leadershipDrive', 'structurePreference',
  'ambiguityTolerance', 'analyticalOrientation', 'workPace',
]

describe('archetypeQuestions', () => {
  it('has exactly 24 questions', () => {
    expect(archetypeQuestions).toHaveLength(24)
  })

  it('has exactly 4 questions per dimension', () => {
    for (const dim of DIMENSIONS) {
      const count = archetypeQuestions.filter((q) => q.dimension === dim).length
      expect(count).toBe(4)
    }
  })

  it('has unique question ids', () => {
    const ids = archetypeQuestions.map((q) => q.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('has at least one reverse-scored item per dimension (bias reduction)', () => {
    for (const dim of DIMENSIONS) {
      const reverseCount = archetypeQuestions.filter(
        (q) => q.dimension === dim && q.reverseScored
      ).length
      expect(reverseCount).toBeGreaterThan(0)
    }
  })

  it('gives every question a positive weight', () => {
    for (const q of archetypeQuestions) {
      expect(q.weight).toBeGreaterThan(0)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/careerCompassQuestions.test.ts`
Expected: FAIL — `careerCompassQuestions` module does not exist yet.

- [ ] **Step 3: Write the archetype question bank**

```ts
// src/data/careerCompassQuestions.ts
import type { ArchetypeQuestion } from '@/types/careerCompass'

export const archetypeQuestions: ArchetypeQuestion[] = [
  // People Focus
  { id: 'cc_people_01', text: "I get energy from working closely with other people.", dimension: 'peopleFocus', reverseScored: false, weight: 1 },
  { id: 'cc_people_02', text: "I'd rather spend most of my workday focused on my own tasks than in meetings with others.", dimension: 'peopleFocus', reverseScored: true, weight: 1 },
  { id: 'cc_people_03', text: "Building relationships with clients or teammates matters more to me than working alone.", dimension: 'peopleFocus', reverseScored: false, weight: 1 },
  { id: 'cc_people_04', text: "Being around people all day tends to drain me more than it excites me.", dimension: 'peopleFocus', reverseScored: true, weight: 1 },

  // Leadership Drive
  { id: 'cc_lead_01', text: "I like being the person who's accountable for how something turns out.", dimension: 'leadershipDrive', reverseScored: false, weight: 1 },
  { id: 'cc_lead_02', text: "I'm comfortable directing other people's work, not just my own.", dimension: 'leadershipDrive', reverseScored: false, weight: 1 },
  { id: 'cc_lead_03', text: "I'd rather contribute great individual work than manage a team.", dimension: 'leadershipDrive', reverseScored: true, weight: 1 },
  { id: 'cc_lead_04', text: "When a group can't decide, I naturally step up and make the call.", dimension: 'leadershipDrive', reverseScored: false, weight: 1 },

  // Structure Preference
  { id: 'cc_struct_01', text: "I do my best work when expectations and processes are clearly defined.", dimension: 'structurePreference', reverseScored: false, weight: 1 },
  { id: 'cc_struct_02', text: "I like knowing exactly what my day will look like before it starts.", dimension: 'structurePreference', reverseScored: false, weight: 1 },
  { id: 'cc_struct_03', text: "I get bored in jobs that follow the same routine every day.", dimension: 'structurePreference', reverseScored: true, weight: 1 },
  { id: 'cc_struct_04', text: "Clear rules and steps help me feel confident, not restricted.", dimension: 'structurePreference', reverseScored: false, weight: 1 },

  // Ambiguity / Risk Tolerance
  { id: 'cc_ambig_01', text: "I'm comfortable making decisions even when I don't have all the information.", dimension: 'ambiguityTolerance', reverseScored: false, weight: 1 },
  { id: 'cc_ambig_02', text: "I enjoy work where the path forward isn't fully mapped out yet.", dimension: 'ambiguityTolerance', reverseScored: false, weight: 1 },
  { id: 'cc_ambig_03', text: "Sudden changes at work stress me out more than they excite me.", dimension: 'ambiguityTolerance', reverseScored: true, weight: 1 },
  { id: 'cc_ambig_04', text: "I'd rather take a calculated risk than wait for a sure thing.", dimension: 'ambiguityTolerance', reverseScored: false, weight: 1 },

  // Analytical <-> Creative Orientation
  { id: 'cc_analyt_01', text: "I trust a well-reasoned analysis more than a hunch, even a good one.", dimension: 'analyticalOrientation', reverseScored: false, weight: 1 },
  { id: 'cc_analyt_02', text: "I'd rather invent a new approach than follow a proven process.", dimension: 'analyticalOrientation', reverseScored: true, weight: 1 },
  { id: 'cc_analyt_03', text: "Numbers and data make a case more convincing to me than a compelling story.", dimension: 'analyticalOrientation', reverseScored: false, weight: 1 },
  { id: 'cc_analyt_04', text: "I enjoy brainstorming original ideas more than optimizing something that already works.", dimension: 'analyticalOrientation', reverseScored: true, weight: 1 },

  // Work Pace / Energy
  { id: 'cc_pace_01', text: "I thrive when I'm juggling multiple priorities at once.", dimension: 'workPace', reverseScored: false, weight: 1 },
  { id: 'cc_pace_02', text: "I like environments where progress and results are visible right away.", dimension: 'workPace', reverseScored: false, weight: 1 },
  { id: 'cc_pace_03', text: "I prefer a slower, more deliberate pace where I can focus deeply on one thing.", dimension: 'workPace', reverseScored: true, weight: 1 },
  { id: 'cc_pace_04', text: "A little healthy competition motivates me to perform better.", dimension: 'workPace', reverseScored: false, weight: 1 },
]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/data/careerCompassQuestions.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Write the failing structural tests for the readiness bank**

```ts
// src/data/forwardReadinessQuestions.test.ts
import { describe, it, expect } from 'vitest'
import { forwardReadinessQuestions } from './forwardReadinessQuestions'

describe('forwardReadinessQuestions', () => {
  it('has exactly 9 questions', () => {
    expect(forwardReadinessQuestions).toHaveLength(9)
  })

  it('has unique question ids', () => {
    const ids = forwardReadinessQuestions.map((q) => q.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('gives every question at least 4 options', () => {
    for (const q of forwardReadinessQuestions) {
      expect(q.options.length).toBeGreaterThanOrEqual(4)
    }
  })

  it('covers every scored readiness dimension at least once', () => {
    const dims = forwardReadinessQuestions.map((q) => q.dimension)
    for (const dim of ['careerDirection', 'searchStrategy', 'applicationResults', 'interviewConfidence', 'supportNeed', 'urgency']) {
      expect(dims).toContain(dim)
    }
  })

  it('covers resumePositioning with two questions (reliability check)', () => {
    const count = forwardReadinessQuestions.filter((q) => q.dimension === 'resumePositioning').length
    expect(count).toBe(2)
  })

  it('has a transitionType question whose options each carry a transitionValue', () => {
    const q = forwardReadinessQuestions.find((q) => q.dimension === 'transitionType')
    expect(q).toBeDefined()
    for (const opt of q!.options) {
      expect(opt.transitionValue).toBeDefined()
    }
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run src/data/forwardReadinessQuestions.test.ts`
Expected: FAIL — module does not exist yet.

- [ ] **Step 7: Write the readiness question bank**

```ts
// src/data/forwardReadinessQuestions.ts
import type { ReadinessQuestion } from '@/types/careerCompass'

export const forwardReadinessQuestions: ReadinessQuestion[] = [
  {
    id: 'rf_career_direction',
    text: 'Which best describes your current career direction?',
    dimension: 'careerDirection',
    options: [
      { label: 'I know exactly what role I want.', value: 100 },
      { label: 'I have a general direction.', value: 66 },
      { label: "I'm considering several paths.", value: 33 },
      { label: "I'm not sure what I should pursue.", value: 0 },
    ],
  },
  {
    id: 'rf_resume_quality',
    text: 'How well does your resume represent what you have accomplished?',
    dimension: 'resumePositioning',
    options: [
      { label: 'Very well', value: 100 },
      { label: 'Pretty well', value: 75 },
      { label: "I'm not sure", value: 50 },
      { label: 'It needs work', value: 25 },
      { label: 'I need significant help', value: 0 },
    ],
  },
  {
    id: 'rf_search_strategy',
    text: 'How confident are you in where and how to search for your next role?',
    dimension: 'searchStrategy',
    options: [
      { label: 'Very confident, I have a clear strategy', value: 100 },
      { label: 'Somewhat confident', value: 66 },
      { label: "I'm mostly guessing", value: 33 },
      { label: "I don't know where to start", value: 0 },
    ],
  },
  {
    id: 'rf_application_results',
    text: 'Which best describes your recent applications?',
    dimension: 'applicationResults',
    options: [
      { label: "I'm getting a good response.", value: 100 },
      { label: "I'm getting interviews but not offers.", value: 60 },
      { label: "I haven't started applying yet.", value: 50 },
      { label: "I'm applying but getting few responses.", value: 25 },
      { label: "I don't know which opportunities to pursue.", value: 10 },
    ],
  },
  {
    id: 'rf_interview_confidence',
    text: 'How confident do you feel going into interviews?',
    dimension: 'interviewConfidence',
    options: [
      { label: 'Very confident', value: 100 },
      { label: 'Fairly confident', value: 70 },
      { label: 'A little nervous', value: 40 },
      { label: 'Not confident at all', value: 10 },
    ],
  },
  {
    id: 'rf_resume_recency',
    text: "When's the last time you updated your resume for the roles you're targeting now?",
    dimension: 'resumePositioning',
    options: [
      { label: "Recently, and it's tailored to what I'm targeting.", value: 100 },
      { label: "It's a bit outdated but still usable.", value: 50 },
      { label: "I honestly don't remember.", value: 20 },
      { label: "I don't have a resume I'm confident in yet.", value: 0 },
    ],
  },
  {
    id: 'rf_support_need',
    text: 'How much hands-on help would you ideally like with your search?',
    dimension: 'supportNeed',
    options: [
      { label: "Give me the tools and I'll handle it.", value: 0 },
      { label: "Give me recommendations and I'll do the work.", value: 33 },
      { label: 'Work alongside me.', value: 66 },
      { label: "I'd like someone actively managing my search for me.", value: 100 },
    ],
  },
  {
    id: 'rf_urgency',
    text: 'How quickly are you hoping to make a move?',
    dimension: 'urgency',
    options: [
      { label: 'Immediately, I need something now.', value: 100 },
      { label: 'Within the next 1-3 months.', value: 66 },
      { label: 'In the next 6 months or so.', value: 33 },
      { label: 'No rush, just exploring.', value: 0 },
    ],
  },
  {
    id: 'rf_transition_type',
    text: 'Which best describes your situation?',
    dimension: 'transitionType',
    options: [
      { label: 'Entering the workforce for the first time', value: 0, transitionValue: 'first_job' },
      { label: 'Changing industries', value: 0, transitionValue: 'industry_change' },
      { label: 'Changing careers entirely', value: 0, transitionValue: 'career_change' },
      { label: 'Seeking advancement in my current field', value: 0, transitionValue: 'advancement' },
      { label: 'Returning to work after time away', value: 0, transitionValue: 'returning' },
    ],
  },
]
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx vitest run src/data/forwardReadinessQuestions.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 9: Commit**

```bash
git add src/data/careerCompassQuestions.ts src/data/careerCompassQuestions.test.ts src/data/forwardReadinessQuestions.ts src/data/forwardReadinessQuestions.test.ts
git commit -m "feat(career-compass): add archetype and readiness question banks"
```

---

## Task 3: Scoring Core (reverse-scoring + dimension normalization)

**Files:**
- Create: `src/lib/careerCompass/scoring.ts`
- Create: `src/lib/careerCompass/scoring.test.ts`

**Interfaces:**
- Consumes: `ArchetypeQuestion`, `ArchetypeAnswers`, `DimensionScores`,
  `ArchetypeAnswer` from `src/types/careerCompass.ts`.
- Produces: `scoreAnswer(answer, reverseScored): number`,
  `calculateDimensionScores(questions, answers): DimensionScores` — Task 4
  (archetype engine) calls `calculateDimensionScores` directly.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/careerCompass/scoring.test.ts
import { describe, it, expect } from 'vitest'
import { scoreAnswer, calculateDimensionScores } from './scoring'
import type { ArchetypeQuestion, ArchetypeAnswers } from '@/types/careerCompass'

const fixtureQuestions: ArchetypeQuestion[] = [
  { id: 'q1', text: 't1', dimension: 'peopleFocus', reverseScored: false, weight: 1 },
  { id: 'q2', text: 't2', dimension: 'peopleFocus', reverseScored: true, weight: 1 },
  { id: 'q3', text: 't3', dimension: 'workPace', reverseScored: false, weight: 1 },
]

describe('scoreAnswer', () => {
  it('returns the raw answer for a normal question', () => {
    expect(scoreAnswer(4, false)).toBe(4)
  })

  it('reverses the answer for a reverse-scored question (6 - answer)', () => {
    expect(scoreAnswer(5, true)).toBe(1)
    expect(scoreAnswer(1, true)).toBe(5)
    expect(scoreAnswer(3, true)).toBe(3)
  })
})

describe('calculateDimensionScores', () => {
  it('normalizes a single answered dimension to 0-100', () => {
    const answers: ArchetypeAnswers = { q1: 5, q2: 5, q3: 3 }
    const result = calculateDimensionScores(fixtureQuestions, answers)
    // q1 scored 5, q2 reverse-scored to 1 -> sum 6, count 2 -> (6/10)*100 = 60
    expect(result.peopleFocus).toBe(60)
    // q3 scored 3, count 1 -> (3/5)*100 = 60
    expect(result.workPace).toBe(60)
  })

  it('returns 0 for a dimension with no answered questions', () => {
    const answers: ArchetypeAnswers = { q1: 5 }
    const result = calculateDimensionScores(fixtureQuestions, answers)
    expect(result.structurePreference).toBe(0)
    expect(result.leadershipDrive).toBe(0)
  })

  it('excludes missing answers from the average rather than treating them as zero', () => {
    // only q1 answered in peopleFocus (q2 is missing) -> should be (5/5)*100 = 100, not diluted
    const answers: ArchetypeAnswers = { q1: 5 }
    const result = calculateDimensionScores(fixtureQuestions, answers)
    expect(result.peopleFocus).toBe(100)
  })

  it('is fully deterministic across repeated calls with identical input', () => {
    const answers: ArchetypeAnswers = { q1: 4, q2: 2, q3: 5 }
    const first = calculateDimensionScores(fixtureQuestions, answers)
    const second = calculateDimensionScores(fixtureQuestions, answers)
    expect(first).toEqual(second)
  })

  it('always returns all six dimension keys, even if unused by the fixture', () => {
    const result = calculateDimensionScores(fixtureQuestions, {})
    expect(Object.keys(result).sort()).toEqual(
      ['ambiguityTolerance', 'analyticalOrientation', 'leadershipDrive', 'peopleFocus', 'structurePreference', 'workPace']
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/careerCompass/scoring.test.ts`
Expected: FAIL — module does not exist yet.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/careerCompass/scoring.ts
import type { ArchetypeQuestion, ArchetypeAnswers, ArchetypeAnswer, DimensionScores, DimensionKey } from '@/types/careerCompass'

const ALL_DIMENSIONS: DimensionKey[] = [
  'peopleFocus', 'leadershipDrive', 'structurePreference',
  'ambiguityTolerance', 'analyticalOrientation', 'workPace',
]

/**
 * Applies reverse-scoring where required. Normal answers pass through
 * unchanged; reverse-scored answers are flipped around the midpoint of a
 * 1-5 scale (6 - answer), e.g. a "Strongly Agree" (5) on a reverse-worded
 * item counts the same as a "Strongly Disagree" (1) on a normal one.
 */
export function scoreAnswer(answer: ArchetypeAnswer, reverseScored: boolean): number {
  return reverseScored ? 6 - answer : answer
}

/**
 * Aggregates answered questions into a 0-100 score per dimension.
 * Unanswered questions are excluded from both the sum and the count
 * (never treated as a zero answer), and a dimension with zero answered
 * questions returns 0 rather than NaN.
 */
export function calculateDimensionScores(
  questions: ArchetypeQuestion[],
  answers: ArchetypeAnswers
): DimensionScores {
  const totals: Partial<Record<DimensionKey, { sum: number; count: number }>> = {}

  for (const question of questions) {
    const answer = answers[question.id]
    if (answer === undefined) continue

    const scored = scoreAnswer(answer, question.reverseScored)
    const bucket = totals[question.dimension] ?? { sum: 0, count: 0 }
    bucket.sum += scored
    bucket.count += 1
    totals[question.dimension] = bucket
  }

  const result = {} as DimensionScores
  for (const dimension of ALL_DIMENSIONS) {
    const bucket = totals[dimension]
    result[dimension] = bucket && bucket.count > 0
      ? Math.round((bucket.sum / (bucket.count * 5)) * 100)
      : 0
  }
  return result
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/careerCompass/scoring.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/careerCompass/scoring.ts src/lib/careerCompass/scoring.test.ts
git commit -m "feat(career-compass): add reverse-scoring and dimension normalization"
```

---

## Task 4: Archetype Engine

**Files:**
- Create: `src/lib/careerCompass/archetypeEngine.ts`
- Create: `src/lib/careerCompass/archetypeEngine.test.ts`

**Interfaces:**
- Consumes: `calculateDimensionScores` from `./scoring` (Task 3);
  `archetypeQuestions` from `@/data/careerCompassQuestions` (Task 2);
  `DimensionScores`, `ArchetypeScores`, `ArchetypeKey`, `ArchetypeResult`,
  `ArchetypeAnswers` from `@/types/careerCompass`.
- Produces: `calculateArchetypeScores(dimensions): ArchetypeScores`,
  `determinePrimarySecondary(scores): { primary, secondary }`,
  `runArchetypeAssessment(questions, answers): ArchetypeResult` — the
  results UI (a later plan) calls `runArchetypeAssessment` directly.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/careerCompass/archetypeEngine.test.ts
import { describe, it, expect } from 'vitest'
import { calculateArchetypeScores, determinePrimarySecondary, runArchetypeAssessment } from './archetypeEngine'
import { archetypeQuestions } from '@/data/careerCompassQuestions'
import type { DimensionScores, ArchetypeScores, ArchetypeAnswers } from '@/types/careerCompass'

describe('calculateArchetypeScores', () => {
  const dims: DimensionScores = {
    peopleFocus: 50,
    leadershipDrive: 80,
    structurePreference: 40,
    ambiguityTolerance: 60,
    analyticalOrientation: 70,
    workPace: 90,
  }

  it('computes Driver as the weighted sum of leadership, pace, people, and ambiguity', () => {
    const scores = calculateArchetypeScores(dims)
    // 80*.35 + 90*.25 + 50*.15 + 60*.25 = 28 + 22.5 + 7.5 + 15 = 73
    expect(scores.driver).toBe(73)
  })

  it('computes Connector as the weighted sum favoring people focus', () => {
    const scores = calculateArchetypeScores(dims)
    // 50*.45 + 80*.20 + 60*.15 + 90*.20 = 22.5 + 16 + 9 + 18 = 65.5 -> rounds to 66
    expect(scores.connector).toBe(66)
  })

  it('returns all six archetype keys', () => {
    const scores = calculateArchetypeScores(dims)
    expect(Object.keys(scores).sort()).toEqual(
      ['builder', 'connector', 'creator', 'driver', 'explorer', 'strategist']
    )
  })
})

describe('determinePrimarySecondary', () => {
  it('picks the two highest-scoring archetypes', () => {
    const scores: ArchetypeScores = { driver: 90, connector: 40, strategist: 30, builder: 20, explorer: 10, creator: 5 }
    const { primary, secondary } = determinePrimarySecondary(scores)
    expect(primary).toBe('driver')
    expect(secondary).toBe('connector')
  })

  it('breaks ties using the fixed priority order [driver, connector, strategist, builder, explorer, creator]', () => {
    const scores: ArchetypeScores = { driver: 70, connector: 70, strategist: 50, builder: 40, explorer: 30, creator: 20 }
    const { primary, secondary } = determinePrimarySecondary(scores)
    expect(primary).toBe('driver')
    expect(secondary).toBe('connector')
  })
})

describe('runArchetypeAssessment', () => {
  it('produces identical dimension scores across repeated calls with identical answers (reproducibility)', () => {
    const answers: ArchetypeAnswers = Object.fromEntries(
      archetypeQuestions.map((q) => [q.id, 3 as const])
    )
    const first = runArchetypeAssessment(archetypeQuestions, answers)
    const second = runArchetypeAssessment(archetypeQuestions, answers)
    expect(first).toEqual(second)
  })

  it('gives every dimension a score of 60 when every answer is neutral (3)', () => {
    // A neutral (3) answer scores 3 whether normal or reverse-scored
    // (6 - 3 = 3), so every dimension should land at (3/5)*100 = 60
    // regardless of the normal/reverse mix.
    const answers: ArchetypeAnswers = Object.fromEntries(
      archetypeQuestions.map((q) => [q.id, 3 as const])
    )
    const result = runArchetypeAssessment(archetypeQuestions, answers)
    for (const score of Object.values(result.dimensionScores)) {
      expect(score).toBe(60)
    }
  })

  it('always assigns a primary and secondary archetype', () => {
    const answers: ArchetypeAnswers = Object.fromEntries(
      archetypeQuestions.map((q) => [q.id, 5 as const])
    )
    const result = runArchetypeAssessment(archetypeQuestions, answers)
    expect(result.primaryArchetype).toBeDefined()
    expect(result.secondaryArchetype).toBeDefined()
    expect(result.primaryArchetype).not.toBe(result.secondaryArchetype)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/careerCompass/archetypeEngine.test.ts`
Expected: FAIL — module does not exist yet.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/careerCompass/archetypeEngine.ts
import { calculateDimensionScores } from './scoring'
import type {
  DimensionScores, ArchetypeScores, ArchetypeKey, ArchetypeResult,
  ArchetypeQuestion, ArchetypeAnswers,
} from '@/types/careerCompass'

const ARCHETYPE_PRIORITY: ArchetypeKey[] = [
  'driver', 'connector', 'strategist', 'builder', 'explorer', 'creator',
]

/**
 * Weighted combinations of the six dimension scores. Each archetype's
 * weights sum to 1.0 and every input is already 0-100, so outputs land
 * naturally in 0-100 with no separate re-normalization step.
 */
export function calculateArchetypeScores(d: DimensionScores): ArchetypeScores {
  return {
    driver: Math.round(
      d.leadershipDrive * 0.35 + d.workPace * 0.25 + d.peopleFocus * 0.15 + d.ambiguityTolerance * 0.25
    ),
    connector: Math.round(
      d.peopleFocus * 0.45 + d.leadershipDrive * 0.20 + d.ambiguityTolerance * 0.15 + d.workPace * 0.20
    ),
    strategist: Math.round(
      d.analyticalOrientation * 0.40 + d.structurePreference * 0.30 + (100 - d.peopleFocus) * 0.15 + (100 - d.workPace) * 0.15
    ),
    builder: Math.round(
      d.structurePreference * 0.45 + (100 - d.ambiguityTolerance) * 0.30 + d.leadershipDrive * 0.15 + d.peopleFocus * 0.10
    ),
    explorer: Math.round(
      d.ambiguityTolerance * 0.40 + (100 - d.structurePreference) * 0.30 + d.workPace * 0.15 + d.peopleFocus * 0.15
    ),
    creator: Math.round(
      (100 - d.analyticalOrientation) * 0.40 + d.ambiguityTolerance * 0.25 + (100 - d.peopleFocus) * 0.20 + (100 - d.structurePreference) * 0.15
    ),
  }
}

/**
 * Primary = highest score, secondary = second highest. Ties are broken
 * deterministically by ARCHETYPE_PRIORITY: Array.prototype.sort is
 * stable (guaranteed since ES2019), so archetypes with equal scores
 * keep their original ARCHETYPE_PRIORITY order rather than being
 * reordered arbitrarily.
 */
export function determinePrimarySecondary(scores: ArchetypeScores): { primary: ArchetypeKey; secondary: ArchetypeKey } {
  const sorted = [...ARCHETYPE_PRIORITY].sort((a, b) => scores[b] - scores[a])
  return { primary: sorted[0], secondary: sorted[1] }
}

export function runArchetypeAssessment(
  questions: ArchetypeQuestion[],
  answers: ArchetypeAnswers
): ArchetypeResult {
  const dimensionScores = calculateDimensionScores(questions, answers)
  const archetypeScores = calculateArchetypeScores(dimensionScores)
  const { primary, secondary } = determinePrimarySecondary(archetypeScores)
  return {
    dimensionScores,
    archetypeScores,
    primaryArchetype: primary,
    secondaryArchetype: secondary,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/careerCompass/archetypeEngine.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/careerCompass/archetypeEngine.ts src/lib/careerCompass/archetypeEngine.test.ts
git commit -m "feat(career-compass): add archetype scoring engine"
```

---

## Task 5: Forward Readiness Engine

**Files:**
- Create: `src/lib/careerCompass/readinessEngine.ts`
- Create: `src/lib/careerCompass/readinessEngine.test.ts`

**Interfaces:**
- Consumes: `forwardReadinessQuestions` from
  `@/data/forwardReadinessQuestions` (Task 2); `ReadinessQuestion`,
  `ReadinessAnswers`, `ReadinessResult`, `ReadinessBarrierKey` from
  `@/types/careerCompass`.
- Produces: `calculateReadiness(questions, answers): ReadinessResult` —
  Task 6 (recommendation engine) consumes a `ReadinessResult` directly.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/careerCompass/readinessEngine.test.ts
import { describe, it, expect } from 'vitest'
import { calculateReadiness } from './readinessEngine'
import { forwardReadinessQuestions } from '@/data/forwardReadinessQuestions'
import type { ReadinessAnswers } from '@/types/careerCompass'

function optionIndex(questionId: string, label: string): number {
  const q = forwardReadinessQuestions.find((q) => q.id === questionId)!
  const idx = q.options.findIndex((o) => o.label === label)
  if (idx === -1) throw new Error(`Option not found: ${questionId} / ${label}`)
  return idx
}

describe('calculateReadiness', () => {
  it('averages the two resume questions into a single resumePositioning score', () => {
    const answers: ReadinessAnswers = {
      rf_resume_quality: optionIndex('rf_resume_quality', 'It needs work'), // 25
      rf_resume_recency: optionIndex('rf_resume_recency', "It's a bit outdated but still usable."), // 50
    }
    const result = calculateReadiness(forwardReadinessQuestions, answers)
    expect(result.dimensionScores.resumePositioning).toBe(38) // round((25+50)/2)
  })

  it('excludes unanswered questions rather than treating them as zero (defaults dimension to 0 only when truly unanswered)', () => {
    const result = calculateReadiness(forwardReadinessQuestions, {})
    expect(result.dimensionScores.careerDirection).toBe(0)
    expect(result.dimensionScores.resumePositioning).toBe(0)
  })

  it('computes the overall score as the documented weighted average', () => {
    const answers: ReadinessAnswers = {
      rf_career_direction: optionIndex('rf_career_direction', 'I know exactly what role I want.'), // 100
      rf_resume_quality: optionIndex('rf_resume_quality', 'Very well'), // 100
      rf_resume_recency: optionIndex('rf_resume_recency', "Recently, and it's tailored to what I'm targeting."), // 100
      rf_search_strategy: optionIndex('rf_search_strategy', 'Very confident, I have a clear strategy'), // 100
      rf_application_results: optionIndex('rf_application_results', "I'm getting a good response."), // 100
      rf_interview_confidence: optionIndex('rf_interview_confidence', 'Very confident'), // 100
    }
    const result = calculateReadiness(forwardReadinessQuestions, answers)
    expect(result.overallScore).toBe(100)
  })

  it('flags a complex transition for career_change but not for advancement', () => {
    const careerChange = calculateReadiness(forwardReadinessQuestions, {
      rf_transition_type: optionIndex('rf_transition_type', 'Changing careers entirely'),
    })
    expect(careerChange.transitionType).toBe('career_change')
    expect(careerChange.isComplexTransition).toBe(true)

    const advancement = calculateReadiness(forwardReadinessQuestions, {
      rf_transition_type: optionIndex('rf_transition_type', 'Seeking advancement in my current field'),
    })
    expect(advancement.transitionType).toBe('advancement')
    expect(advancement.isComplexTransition).toBe(false)
  })

  it('identifies the lowest-scoring dimension as the primary barrier', () => {
    const answers: ReadinessAnswers = {
      rf_career_direction: optionIndex('rf_career_direction', 'I know exactly what role I want.'), // 100
      rf_resume_quality: optionIndex('rf_resume_quality', 'I need significant help'), // 0
      rf_resume_recency: optionIndex('rf_resume_recency', "I don't have a resume I'm confident in yet."), // 0
      rf_search_strategy: optionIndex('rf_search_strategy', 'Very confident, I have a clear strategy'), // 100
      rf_application_results: optionIndex('rf_application_results', "I'm getting a good response."), // 100
      rf_interview_confidence: optionIndex('rf_interview_confidence', 'Very confident'), // 100
    }
    const result = calculateReadiness(forwardReadinessQuestions, answers)
    expect(result.primaryBarrier).toBe('resumePositioning')
  })

  it('breaks barrier ties using the fixed priority order', () => {
    // Leave every scored question unanswered -> every dimension is 0,
    // a full tie. Priority order is
    // [careerDirection, resumePositioning, searchStrategy, applicationConversion, interviewPerformance].
    const result = calculateReadiness(forwardReadinessQuestions, {})
    expect(result.primaryBarrier).toBe('careerDirection')
    expect(result.secondaryBarrier).toBe('resumePositioning')
  })

  it('is fully deterministic across repeated calls with identical input', () => {
    const answers: ReadinessAnswers = { rf_career_direction: 1, rf_support_need: 2 }
    const first = calculateReadiness(forwardReadinessQuestions, answers)
    const second = calculateReadiness(forwardReadinessQuestions, answers)
    expect(first).toEqual(second)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/careerCompass/readinessEngine.test.ts`
Expected: FAIL — module does not exist yet.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/careerCompass/readinessEngine.ts
import type {
  ReadinessQuestion, ReadinessAnswers, ReadinessResult, ReadinessBarrierKey,
} from '@/types/careerCompass'

/**
 * Fixed left-to-right tie-break order for both the readiness overall
 * score inputs and the barrier detector. Never reordered based on data.
 */
const BARRIER_PRIORITY: ReadinessBarrierKey[] = [
  'careerDirection', 'resumePositioning', 'searchStrategy',
  'applicationConversion', 'interviewPerformance',
]

function getOptionValue(questions: ReadinessQuestion[], answers: ReadinessAnswers, questionId: string): number | null {
  const question = questions.find((q) => q.id === questionId)
  const optionIndex = answers[questionId]
  if (!question || optionIndex === undefined) return null
  const option = question.options[optionIndex]
  return option ? option.value : null
}

function averageDefined(values: (number | null)[]): number {
  const defined = values.filter((v): v is number => v !== null)
  if (defined.length === 0) return 0
  return Math.round(defined.reduce((sum, v) => sum + v, 0) / defined.length)
}

export function calculateReadiness(
  questions: ReadinessQuestion[],
  answers: ReadinessAnswers
): ReadinessResult {
  const careerDirection = getOptionValue(questions, answers, 'rf_career_direction') ?? 0
  const resumeQuality = getOptionValue(questions, answers, 'rf_resume_quality')
  const resumeRecency = getOptionValue(questions, answers, 'rf_resume_recency')
  const resumePositioning = averageDefined([resumeQuality, resumeRecency])
  const searchStrategy = getOptionValue(questions, answers, 'rf_search_strategy') ?? 0
  const applicationResults = getOptionValue(questions, answers, 'rf_application_results') ?? 0
  const interviewConfidence = getOptionValue(questions, answers, 'rf_interview_confidence') ?? 0
  const supportNeed = getOptionValue(questions, answers, 'rf_support_need') ?? 0
  const urgency = getOptionValue(questions, answers, 'rf_urgency') ?? 0

  const transitionQuestion = questions.find((q) => q.id === 'rf_transition_type')
  const transitionOptionIndex = answers['rf_transition_type']
  const transitionType = transitionQuestion && transitionOptionIndex !== undefined
    ? transitionQuestion.options[transitionOptionIndex]?.transitionValue ?? null
    : null
  const isComplexTransition = transitionType !== null && transitionType !== 'advancement'

  const overallScore = Math.round(
    careerDirection * 0.25 +
    resumePositioning * 0.25 +
    searchStrategy * 0.20 +
    applicationResults * 0.15 +
    interviewConfidence * 0.15
  )

  const barrierScores: Record<ReadinessBarrierKey, number> = {
    careerDirection,
    resumePositioning,
    searchStrategy,
    applicationConversion: applicationResults,
    interviewPerformance: interviewConfidence,
  }

  // Stable sort ascending by score: ties preserve BARRIER_PRIORITY's
  // original order, which is exactly the desired deterministic tie-break.
  const sortedBarriers = [...BARRIER_PRIORITY].sort(
    (a, b) => barrierScores[a] - barrierScores[b]
  )

  return {
    dimensionScores: { careerDirection, resumePositioning, searchStrategy, applicationResults, interviewConfidence },
    supportNeed,
    urgency,
    transitionType,
    isComplexTransition,
    overallScore,
    primaryBarrier: sortedBarriers[0],
    secondaryBarrier: sortedBarriers[1],
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/careerCompass/readinessEngine.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/careerCompass/readinessEngine.ts src/lib/careerCompass/readinessEngine.test.ts
git commit -m "feat(career-compass): add forward readiness engine"
```

---

## Task 6: Plan Recommendation Engine

**Files:**
- Create: `src/lib/careerCompass/recommendationEngine.ts`
- Create: `src/lib/careerCompass/recommendationEngine.test.ts`

**Interfaces:**
- Consumes: `ReadinessResult`, `ReadinessBarrierKey`,
  `RecommendedPlanSlug`, `PlanRecommendation` from
  `@/types/careerCompass`.
- Produces: `recommendPlan(readiness): PlanRecommendation` — the results
  UI (a later plan) calls this directly with the output of
  `calculateReadiness` from Task 5.

- [ ] **Step 1: Write the failing tests (the 4 required scenarios plus service-fit bounds)**

```ts
// src/lib/careerCompass/recommendationEngine.test.ts
import { describe, it, expect } from 'vitest'
import { recommendPlan } from './recommendationEngine'
import type { ReadinessResult } from '@/types/careerCompass'

function makeReadiness(overrides: Partial<ReadinessResult>): ReadinessResult {
  return {
    dimensionScores: {
      careerDirection: 50, resumePositioning: 50, searchStrategy: 50,
      applicationResults: 50, interviewConfidence: 50,
    },
    supportNeed: 50,
    urgency: 33,
    transitionType: null,
    isComplexTransition: false,
    overallScore: 50,
    primaryBarrier: 'careerDirection',
    secondaryBarrier: 'resumePositioning',
    ...overrides,
  }
}

describe('recommendPlan', () => {
  it('Scenario 1: clear direction + poor resume + low support need -> Career Kickstart', () => {
    const readiness = makeReadiness({
      dimensionScores: {
        careerDirection: 90, resumePositioning: 20, searchStrategy: 70,
        applicationResults: 70, interviewConfidence: 70,
      },
      supportNeed: 0,
      overallScore: 64,
      primaryBarrier: 'resumePositioning',
      secondaryBarrier: 'searchStrategy',
    })
    const result = recommendPlan(readiness)
    expect(result.planSlug).toBe('career-kickstart')
    expect(result.reasons.length).toBeGreaterThan(0)
  })

  it('Scenario 2: unclear direction + moderate search needs + wants guidance -> Founding Member', () => {
    const readiness = makeReadiness({
      dimensionScores: {
        careerDirection: 30, resumePositioning: 60, searchStrategy: 40,
        applicationResults: 50, interviewConfidence: 60,
      },
      supportNeed: 50,
      overallScore: 44,
      primaryBarrier: 'careerDirection',
      secondaryBarrier: 'searchStrategy',
    })
    const result = recommendPlan(readiness)
    expect(result.planSlug).toBe('founding-member')
  })

  it('Scenario 3: high support need + complex transition + wants managed assistance -> Career Concierge', () => {
    const readiness = makeReadiness({
      supportNeed: 100,
      isComplexTransition: true,
      transitionType: 'career_change',
      urgency: 66,
      overallScore: 40,
      primaryBarrier: 'careerDirection',
      secondaryBarrier: 'resumePositioning',
    })
    const result = recommendPlan(readiness)
    expect(result.planSlug).toBe('career-concierge')
  })

  it('Scenario 4: strong readiness + low support requirement -> no forced purchase', () => {
    const readiness = makeReadiness({
      dimensionScores: {
        careerDirection: 85, resumePositioning: 95, searchStrategy: 85,
        applicationResults: 90, interviewConfidence: 88,
      },
      supportNeed: 0,
      overallScore: 88,
      primaryBarrier: 'careerDirection',
      secondaryBarrier: 'searchStrategy',
    })
    const result = recommendPlan(readiness)
    expect(result.planSlug).toBeNull()
  })

  it('recommends Career Growth when interview performance is the primary barrier', () => {
    const readiness = makeReadiness({
      supportNeed: 40,
      overallScore: 55,
      primaryBarrier: 'interviewPerformance',
      secondaryBarrier: 'searchStrategy',
    })
    const result = recommendPlan(readiness)
    expect(result.planSlug).toBe('career-growth')
  })

  it('never returns a service fit above 97 or below 0', () => {
    const strong = recommendPlan(makeReadiness({ supportNeed: 100, isComplexTransition: true, transitionType: 'career_change' }))
    expect(strong.serviceFitPct).toBeLessThanOrEqual(97)
    expect(strong.serviceFitPct).toBeGreaterThanOrEqual(0)

    const free = recommendPlan(makeReadiness({
      dimensionScores: { careerDirection: 85, resumePositioning: 95, searchStrategy: 85, applicationResults: 90, interviewConfidence: 88 },
      supportNeed: 0, overallScore: 88, primaryBarrier: 'careerDirection', secondaryBarrier: 'searchStrategy',
    }))
    expect(free.serviceFitPct).toBe(0) // no plan recommended -> fit is not applicable
  })

  it('is fully deterministic across repeated calls with identical input', () => {
    const readiness = makeReadiness({ supportNeed: 50 })
    expect(recommendPlan(readiness)).toEqual(recommendPlan(readiness))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/careerCompass/recommendationEngine.test.ts`
Expected: FAIL — module does not exist yet.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/careerCompass/recommendationEngine.ts
import type { ReadinessResult, RecommendedPlanSlug, PlanRecommendation, ReadinessBarrierKey } from '@/types/careerCompass'

type ConcretePlanSlug = Exclude<RecommendedPlanSlug, null>

const BARRIERS_ADDRESSED_BY_PLAN: Record<ConcretePlanSlug, ReadinessBarrierKey[]> = {
  'career-kickstart': ['resumePositioning'],
  'founding-member': ['careerDirection', 'searchStrategy', 'applicationConversion'],
  'career-growth': ['interviewPerformance', 'applicationConversion'],
  'career-concierge': ['careerDirection', 'resumePositioning', 'searchStrategy', 'applicationConversion', 'interviewPerformance'],
}

export function recommendPlan(readiness: ReadinessResult): PlanRecommendation {
  const { dimensionScores, supportNeed, urgency, isComplexTransition, overallScore, primaryBarrier, secondaryBarrier } = readiness
  const barriers = [primaryBarrier, secondaryBarrier]
  const resumeIsBarrier = barriers.includes('resumePositioning')
  const interviewIsBarrier = barriers.includes('interviewPerformance')

  let planSlug: RecommendedPlanSlug
  const reasons: string[] = []

  if (supportNeed <= 33 && overallScore >= 75 && !resumeIsBarrier) {
    planSlug = null
    reasons.push('Your readiness is strong across the board.', "You've told us you'd rather handle this yourself.")
  } else if (supportNeed <= 33 && resumeIsBarrier && dimensionScores.careerDirection >= 60) {
    planSlug = 'career-kickstart'
    reasons.push('You know where you want to go.', 'Your biggest opportunity is how your experience is presented.')
  } else if (supportNeed >= 80 && isComplexTransition) {
    planSlug = 'career-concierge'
    reasons.push("You're navigating a complex career transition.", 'You want fully managed, hands-on support.')
  } else if (interviewIsBarrier || (supportNeed >= 67 && !isComplexTransition) || urgency >= 100) {
    planSlug = 'career-growth'
    reasons.push(
      interviewIsBarrier
        ? 'Interview performance is your biggest opportunity right now.'
        : "You're ready for more active, hands-on help."
    )
  } else {
    planSlug = 'founding-member'
    reasons.push("You'd benefit from ongoing guidance and hand-selected opportunities.")
  }

  return { planSlug, serviceFitPct: calculateServiceFit(readiness, planSlug), reasons }
}

/**
 * Deterministic, explainable service-fit heuristic (same philosophy as
 * lib/freshFitScore.ts): a base score plus bonus points for each matched
 * criterion, capped below 100 so the product never claims a perfect fit.
 */
function calculateServiceFit(readiness: ReadinessResult, planSlug: RecommendedPlanSlug): number {
  if (planSlug === null) return 0

  let fit = 70

  const supportBandMatches =
    (planSlug === 'career-kickstart' && readiness.supportNeed <= 33) ||
    (planSlug === 'founding-member' && readiness.supportNeed > 33 && readiness.supportNeed <= 66) ||
    (planSlug === 'career-growth' && readiness.supportNeed > 33) ||
    (planSlug === 'career-concierge' && readiness.supportNeed >= 80)
  if (supportBandMatches) fit += 10

  if (BARRIERS_ADDRESSED_BY_PLAN[planSlug].includes(readiness.primaryBarrier)) fit += 10
  if (readiness.urgency >= 66) fit += 5
  if ((planSlug === 'career-concierge') === readiness.isComplexTransition) fit += 5

  return Math.min(97, fit)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/careerCompass/recommendationEngine.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Add the barrel export**

```ts
// src/lib/careerCompass/index.ts
export * from './scoring'
export * from './archetypeEngine'
export * from './readinessEngine'
export * from './recommendationEngine'
export * from '@/types/careerCompass'
```

- [ ] **Step 6: Run the full Career Compass test suite together**

Run: `npx vitest run src/lib/careerCompass src/data/careerCompassQuestions.test.ts src/data/forwardReadinessQuestions.test.ts`
Expected: PASS (all tests from Tasks 2-6, no regressions)

- [ ] **Step 7: Run the whole existing test suite to confirm no regressions elsewhere**

Run: `npx vitest run`
Expected: PASS (all pre-existing tests plus every Career Compass test)

- [ ] **Step 8: Commit**

```bash
git add src/lib/careerCompass/recommendationEngine.ts src/lib/careerCompass/recommendationEngine.test.ts src/lib/careerCompass/index.ts
git commit -m "feat(career-compass): add plan recommendation engine and barrel export"
```

---

## What This Plan Does Not Cover (intentionally, per the spec's own phasing)

This plan stops at a complete, tested, pure-function core. It does **not**
touch persistence (`supabase/migrations/...`, `session.ts`), routing/UI
(`CareerCompass*Page.tsx`), dashboard/nav integration, account-claim logic,
AI interpretation, or analytics. Those map to the spec's Implementation
Sequence Tasks 7-15 and should be their own follow-on plan(s) once this one
is reviewed and merged, so each increment stays independently testable —
per the spec's section 10 risk notes and this project's YAGNI discipline.
