# Sub-Project 2: Homepage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `src/pages/LandingPage.tsx` around the 5-layer positioning hierarchy (Identity → Intelligence → Action → Human Judgment → Progress → Final CTA), replacing the current Concierge Editorial copy, and build the new homepage-specific composite primitives the brief needs that Sub-Project 1 deliberately deferred.

**Architecture:** Six new presentational primitives live in a new `src/components/homepage/` directory (content-shaped, not page-agnostic, matching the existing convention where `FridayReportCard`/`OpportunityPreviewCard` live directly under `src/components/`). All are pure, prop-driven, sample-data components with zero Supabase/auth wiring — same pattern as the existing `FridayReportCard isSample` and `OpportunityPreviewCard` "Sample" badge. `LandingPage.tsx` itself is then rewritten in one atomic task (it is one page telling one narrative — splitting the rewrite across multiple tasks would leave the page in an incoherent half-state that isn't meaningfully reviewable on its own, mirroring how Sub-Project 1 treated "migrate this whole page" as one task each).

**Tech Stack:** React 18 + TypeScript + Vite + Tailwind CSS v4 (`@theme` tokens from Sub-Project 1) + Vitest + React Testing Library + `lucide-react` icons + `react-router-dom`.

**Spec:** `docs/superpowers/specs/2026-09-06-redesign-subproject2-homepage-design.md`

## Global Constraints

- Whole homepage stays on the Sub-Project 1 dark token system (`bg-bg`, `bg-surface-elevated`, `bg-surface-subtle`, `bg-surface-card`, `text-ink`, `text-ink-muted`, `border-border`, `primary-*`) — no literal white/`#fff`/light-gray background anywhere on this page.
- Every homepage claim must point at a real route/feature per the spec's terminology map. Do not fabricate trusted-by logos or testimonials.
- Preserve `"A better search needs better judgment."` — moves to the new Human Judgment section headline, do not delete it.
- Do not touch `/about`, `/how-it-works`, `/services`, `/pricing`, `/faq`, `/career-compass`, `/dashboard`, `/opportunity-engine`, `/achievement-vault`, `/forward-dna`, `/career-profile`, or any strategist/admin page.
- Do not merge or port code from the `homepage-redesign-phase1` branch.
- No backend, schema, FreshFit/Forward Score scoring-logic changes.
- After every task: `npx tsc --noEmit`, `npm test -- --run`, and `npm run build` must all pass before moving on.
- Positioning guardrail: never imply "AI replaces career coaches" nor "career coaches with some software" — technology provides intelligence/organization/personalization/momentum, strategists provide judgment/context/accountability/support.

---

## Task 1: `MetricCard` primitive

**Files:**
- Create: `src/components/homepage/MetricCard.tsx`
- Test: `src/components/homepage/MetricCard.test.tsx`

**Interfaces:**
- Produces: `MetricCard({ icon: LucideIcon, label: string, value: string, delta?: string })` — a small stat card. Consumed by Task 8 (Progress section) and reused inside Task 6 (hero visual floating cards).

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/homepage/MetricCard.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TrendingUp } from 'lucide-react'
import { MetricCard } from './MetricCard'

describe('MetricCard', () => {
  it('renders label, value, and icon on the semantic card surface', () => {
    render(<MetricCard icon={TrendingUp} label="Active Applications" value="8" />)
    const value = screen.getByText('8')
    expect(value).toBeInTheDocument()
    expect(screen.getByText('Active Applications')).toBeInTheDocument()
    expect(value.closest('div')?.className).toContain('bg-surface-card')
  })

  it('renders an optional delta line', () => {
    render(<MetricCard icon={TrendingUp} label="Active Applications" value="8" delta="+3 this week" />)
    expect(screen.getByText('+3 this week')).toBeInTheDocument()
  })

  it('omits the delta line when not provided', () => {
    render(<MetricCard icon={TrendingUp} label="Active Applications" value="8" />)
    expect(screen.queryByText(/this week/)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/components/homepage/MetricCard.test.tsx`
Expected: FAIL — `./MetricCard` does not exist.

- [ ] **Step 3: Write the implementation**

```tsx
// src/components/homepage/MetricCard.tsx
import type { LucideIcon } from 'lucide-react'

export interface MetricCardProps {
  icon: LucideIcon
  label: string
  value: string
  delta?: string
}

/** A small stat card for the homepage's Progress (layer 5) section and the
 * hero's floating product-visual cards. Sample/illustrative data only --
 * never wired to a real member's data on this public page. */
export function MetricCard({ icon: Icon, label, value, delta }: MetricCardProps) {
  return (
    <div className="rounded-2xl border border-border bg-surface-card p-5">
      <Icon className="h-5 w-5 text-primary-400" aria-hidden="true" />
      <p className="mt-3 font-mono text-2xl font-bold text-ink">{value}</p>
      <p className="mt-1 text-sm text-ink-muted">{label}</p>
      {delta && <p className="mt-2 text-xs font-semibold text-primary-400">{delta}</p>}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/components/homepage/MetricCard.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/homepage/MetricCard.tsx src/components/homepage/MetricCard.test.tsx
git commit -m "feat(homepage): add MetricCard primitive"
```

---

## Task 2: `FreshFitBadge` primitive

**Files:**
- Create: `src/components/homepage/FreshFitBadge.tsx`
- Test: `src/components/homepage/FreshFitBadge.test.tsx`

**Interfaces:**
- Consumes: `getFreshFitTier`, `FRESHFIT_TIER_LABELS`, `FRESHFIT_TIER_STYLES` from `@/lib/freshFitScore/tiers` (existing, unchanged).
- Produces: `FreshFitBadge({ score: number })`. Consumed by Task 8 (Opportunity Intelligence highlight).

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/homepage/FreshFitBadge.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FreshFitBadge } from './FreshFitBadge'

describe('FreshFitBadge', () => {
  it('shows the score and the Strong Match label for a high score', () => {
    render(<FreshFitBadge score={86} />)
    expect(screen.getByText(/86/)).toBeInTheDocument()
    expect(screen.getByText(/Strong Match/)).toBeInTheDocument()
  })

  it('shows the Fair Match label for a mid score', () => {
    render(<FreshFitBadge score={45} />)
    expect(screen.getByText(/Fair Match/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/components/homepage/FreshFitBadge.test.tsx`
Expected: FAIL — `./FreshFitBadge` does not exist.

- [ ] **Step 3: Write the implementation**

```tsx
// src/components/homepage/FreshFitBadge.tsx
import { getFreshFitTier, FRESHFIT_TIER_LABELS, FRESHFIT_TIER_STYLES } from '@/lib/freshFitScore/tiers'

export interface FreshFitBadgeProps {
  score: number
}

/** Thin presentational wrapper over the existing FreshFit tier utilities --
 * reuses the same thresholds/labels/styles as the Opportunity Engine pages
 * so the homepage never drifts out of sync with the real scoring tiers. */
export function FreshFitBadge({ score }: FreshFitBadgeProps) {
  const tier = getFreshFitTier(score)
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-xs font-semibold ${FRESHFIT_TIER_STYLES[tier]}`}
    >
      FreshFit {score} &middot; {FRESHFIT_TIER_LABELS[tier]}
    </span>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/components/homepage/FreshFitBadge.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/homepage/FreshFitBadge.tsx src/components/homepage/FreshFitBadge.test.tsx
git commit -m "feat(homepage): add FreshFitBadge primitive"
```

---

## Task 3: `ProfileStrengthCard` primitive

**Files:**
- Create: `src/components/homepage/ProfileStrengthCard.tsx`
- Test: `src/components/homepage/ProfileStrengthCard.test.tsx`

**Interfaces:**
- Consumes: `CircularProgress` from `@/components/CircularProgress` (existing, unchanged: `{ value, size?, strokeWidth?, label? }`).
- Produces: `ProfileStrengthCard({ name, headline, strength, forwardScore })`. Consumed by Task 9 (Forward Profile support inside the Intelligence section, if used) — standalone, testable independently.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/homepage/ProfileStrengthCard.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProfileStrengthCard } from './ProfileStrengthCard'

describe('ProfileStrengthCard', () => {
  it('renders the name, headline, and forward score', () => {
    render(<ProfileStrengthCard name="Jordan R." headline="Product Marketing Manager" strength={91} forwardScore={78} />)
    expect(screen.getByText('Jordan R.')).toBeInTheDocument()
    expect(screen.getByText('Product Marketing Manager')).toBeInTheDocument()
    expect(screen.getByText('78')).toBeInTheDocument()
  })

  it('labels itself as a sample', () => {
    render(<ProfileStrengthCard name="Jordan R." headline="Product Marketing Manager" strength={91} forwardScore={78} />)
    expect(screen.getByText('Sample')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/components/homepage/ProfileStrengthCard.test.tsx`
Expected: FAIL — `./ProfileStrengthCard` does not exist.

- [ ] **Step 3: Write the implementation**

```tsx
// src/components/homepage/ProfileStrengthCard.tsx
import { CircularProgress } from '@/components/CircularProgress'

export interface ProfileStrengthCardProps {
  name: string
  headline: string
  strength: number
  forwardScore: number
}

/** Sample Forward Profile summary for the homepage's Intelligence section.
 * Never wired to real member data -- explicitly labeled Sample, matching
 * the FridayReportCard/OpportunityPreviewCard convention. */
export function ProfileStrengthCard({ name, headline, strength, forwardScore }: ProfileStrengthCardProps) {
  return (
    <div className="rounded-2xl border border-border bg-surface-card p-6">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-wide text-primary-400">Forward Profile</span>
        <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-ink-muted">
          Sample
        </span>
      </div>
      <h3 className="mt-4 font-display text-lg font-semibold text-ink">{name}</h3>
      <p className="text-sm text-ink-muted">{headline}</p>
      <div className="mt-5 flex items-center gap-6 border-t border-border pt-5">
        <CircularProgress value={strength} size={64} strokeWidth={6} label="Strength" />
        <div>
          <p className="font-mono text-2xl font-bold text-ink">{forwardScore}</p>
          <p className="text-xs text-ink-muted">Forward Score</p>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/components/homepage/ProfileStrengthCard.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/homepage/ProfileStrengthCard.tsx src/components/homepage/ProfileStrengthCard.test.tsx
git commit -m "feat(homepage): add ProfileStrengthCard primitive"
```

---

## Task 4: `CurrentFocusCard` primitive

**Files:**
- Create: `src/components/homepage/CurrentFocusCard.tsx`
- Test: `src/components/homepage/CurrentFocusCard.test.tsx`

**Interfaces:**
- Consumes: `Link` from `react-router-dom` (existing).
- Produces: `CurrentFocusCard({ title, evidence, progressLabel, ctaLabel, ctaTo })`. Consumed by Task 9 (Action / layer 3 section).

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/homepage/CurrentFocusCard.test.tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { CurrentFocusCard } from './CurrentFocusCard'

describe('CurrentFocusCard', () => {
  it('renders the focus title, evidence, progress, and CTA link', () => {
    render(
      <MemoryRouter>
        <CurrentFocusCard
          title="Strengthen your leadership accomplishments"
          evidence="Your target roles emphasize team performance and measurable results, but only 6 of your 13 accomplishments currently include metrics."
          progressLabel="2 of 3 complete"
          ctaLabel="Continue This Focus"
          ctaTo="/signup"
        />
      </MemoryRouter>
    )
    expect(screen.getByText('Strengthen your leadership accomplishments')).toBeInTheDocument()
    expect(screen.getByText(/only 6 of your 13 accomplishments/)).toBeInTheDocument()
    expect(screen.getByText('2 of 3 complete')).toBeInTheDocument()
    const cta = screen.getByRole('link', { name: /Continue This Focus/ })
    expect(cta).toHaveAttribute('href', '/signup')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/components/homepage/CurrentFocusCard.test.tsx`
Expected: FAIL — `./CurrentFocusCard` does not exist.

- [ ] **Step 3: Write the implementation**

```tsx
// src/components/homepage/CurrentFocusCard.tsx
import { Link } from 'react-router-dom'
import { ArrowRight, Target } from 'lucide-react'

export interface CurrentFocusCardProps {
  title: string
  evidence: string
  progressLabel: string
  ctaLabel: string
  ctaTo: string
}

/** Sample "current focus" module for the homepage's Action (layer 3)
 * section -- illustrates the evidence -> progress -> next-action pattern
 * without claiming to reflect any specific real member. */
export function CurrentFocusCard({ title, evidence, progressLabel, ctaLabel, ctaTo }: CurrentFocusCardProps) {
  return (
    <div className="rounded-2xl border border-border bg-surface-card p-7">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wide text-primary-400">
          <Target className="h-3.5 w-3.5" aria-hidden="true" /> Current Focus
        </span>
        <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-ink-muted">
          Sample
        </span>
      </div>
      <h3 className="mt-4 font-display text-xl font-semibold text-ink">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-muted">{evidence}</p>
      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-ink-muted">{progressLabel}</p>
      <Link
        to={ctaTo}
        className="mt-5 inline-flex items-center gap-2 font-mono text-sm font-semibold text-primary-400 hover:text-primary-300"
      >
        {ctaLabel} <ArrowRight size={16} />
      </Link>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/components/homepage/CurrentFocusCard.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/homepage/CurrentFocusCard.tsx src/components/homepage/CurrentFocusCard.test.tsx
git commit -m "feat(homepage): add CurrentFocusCard primitive"
```

---

## Task 5: `ForwardScoreCard` primitive

**Files:**
- Create: `src/components/homepage/ForwardScoreCard.tsx`
- Test: `src/components/homepage/ForwardScoreCard.test.tsx`

**Interfaces:**
- Consumes: `CircularProgress` from `@/components/CircularProgress` (existing, unchanged).
- Produces: `ForwardScoreCard({ score, delta })`. Consumed by Task 9 (Progress / layer 5 section).

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/homepage/ForwardScoreCard.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ForwardScoreCard } from './ForwardScoreCard'

describe('ForwardScoreCard', () => {
  it('renders the score and delta', () => {
    render(<ForwardScoreCard score={78} delta="+6 this month" />)
    expect(screen.getByText('78')).toBeInTheDocument()
    expect(screen.getByText('+6 this month')).toBeInTheDocument()
    expect(screen.getByText('Forward Score')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/components/homepage/ForwardScoreCard.test.tsx`
Expected: FAIL — `./ForwardScoreCard` does not exist.

- [ ] **Step 3: Write the implementation**

```tsx
// src/components/homepage/ForwardScoreCard.tsx
import { CircularProgress } from '@/components/CircularProgress'

export interface ForwardScoreCardProps {
  score: number
  delta: string
}

/** Sample Forward Score summary for the homepage's Progress (layer 5)
 * section. Reuses the existing CircularProgress ring so the visual
 * language matches the real Dashboard's score presentation. */
export function ForwardScoreCard({ score, delta }: ForwardScoreCardProps) {
  return (
    <div className="flex items-center gap-5 rounded-2xl border border-border bg-surface-card p-6">
      <CircularProgress value={score} size={72} strokeWidth={7} label="Forward Score" />
      <div>
        <p className="font-mono text-xs font-semibold uppercase tracking-wide text-ink-muted">Forward Score</p>
        <p className="mt-1 font-mono text-3xl font-bold text-ink">{score}</p>
        <p className="mt-1 text-xs font-semibold text-primary-400">{delta}</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/components/homepage/ForwardScoreCard.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/homepage/ForwardScoreCard.tsx src/components/homepage/ForwardScoreCard.test.tsx
git commit -m "feat(homepage): add ForwardScoreCard primitive"
```

---

## Task 6: `HeroProductVisual` composite

**Files:**
- Create: `src/components/homepage/HeroProductVisual.tsx`
- Test: `src/components/homepage/HeroProductVisual.test.tsx`

**Interfaces:**
- Consumes: `CircularProgress` from `@/components/CircularProgress` (existing).
- Produces: `HeroProductVisual()` (no props — self-contained sample composition). Consumed by Task 9 (Hero / layer 1 section).

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/homepage/HeroProductVisual.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { HeroProductVisual } from './HeroProductVisual'

describe('HeroProductVisual', () => {
  it('renders the FreshFit score centerpiece', () => {
    render(<HeroProductVisual />)
    expect(screen.getByText('82%')).toBeInTheDocument()
  })

  it('renders a sample-preview caption for screen readers and sighted users alike', () => {
    render(<HeroProductVisual />)
    expect(screen.getByText('Sample dashboard preview')).toBeInTheDocument()
  })

  it('renders the floating supporting cards', () => {
    render(<HeroProductVisual />)
    expect(screen.getByText('Top Opportunity')).toBeInTheDocument()
    expect(screen.getByText('Profile Strength')).toBeInTheDocument()
    expect(screen.getByText('Goal Progress')).toBeInTheDocument()
    expect(screen.getByText('Achievement Vault')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/components/homepage/HeroProductVisual.test.tsx`
Expected: FAIL — `./HeroProductVisual` does not exist.

- [ ] **Step 3: Write the implementation**

```tsx
// src/components/homepage/HeroProductVisual.tsx
import { Award, Briefcase, Target, TrendingUp } from 'lucide-react'
import { CircularProgress } from '@/components/CircularProgress'

const FLOATING_CARDS = [
  { icon: Briefcase, label: 'Top Opportunity', value: 'Strong Match', position: 'left-0 top-6' },
  { icon: TrendingUp, label: 'Profile Strength', value: '78 · Good', position: 'right-0 top-0' },
  { icon: Target, label: 'Goal Progress', value: '75% on track', position: 'bottom-20 left-2' },
  { icon: Award, label: 'Achievement Vault', value: '23 assets', position: 'bottom-6 right-2' },
] as const

/**
 * The hero's product-as-proof composition: a FreshFit score ring centerpiece,
 * a handful of floating sample stat cards, and a glowing CSS/SVG trajectory
 * path -- deliberately no raster image (see Redesign_Project.txt's
 * performance guidance: prefer gradients/borders/glows over shipped images).
 * Entire composition is decorative/illustrative; the one sr-only caption
 * plus the visible "Sample dashboard preview" caption (same copy already
 * used in HowItWorksPage.tsx) are the only things a screen reader announces
 * here, so this never reads as a real embedded dashboard.
 */
export function HeroProductVisual() {
  return (
    <div>
      <div className="relative mx-auto aspect-square w-full max-w-md" aria-hidden="true">
        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-primary-950/0 via-primary-500/10 to-primary-400/20 blur-2xl" />

        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 400 400" fill="none">
          <path
            d="M40 340 C 140 340, 160 220, 260 200 S 360 100, 360 60"
            stroke="url(#heroPathGlow)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <defs>
            <linearGradient id="heroPathGlow" x1="40" y1="340" x2="360" y2="60" gradientUnits="userSpaceOnUse">
              <stop stopColor="var(--color-primary-600)" stopOpacity="0.15" />
              <stop offset="1" stopColor="var(--color-primary-400)" stopOpacity="0.9" />
            </linearGradient>
          </defs>
        </svg>

        <div className="absolute inset-0 flex items-center justify-center">
          <div className="rounded-full border border-border bg-surface-card/90 p-6 shadow-2xl shadow-primary-500/20 backdrop-blur">
            <CircularProgress value={82} size={140} strokeWidth={10} label="FreshFit Score" />
          </div>
        </div>

        {FLOATING_CARDS.map(({ icon: Icon, label, value, position }) => (
          <div
            key={label}
            className={`absolute ${position} hidden w-36 rounded-xl border border-border bg-surface-card/95 p-3 shadow-lg backdrop-blur sm:block`}
          >
            <Icon className="h-4 w-4 text-primary-400" aria-hidden="true" />
            <p className="mt-1.5 text-[11px] font-semibold text-ink-muted">{label}</p>
            <p className="text-sm font-bold text-ink">{value}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-center font-mono text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
        Sample dashboard preview
      </p>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/components/homepage/HeroProductVisual.test.tsx`
Expected: PASS

- [ ] **Step 5: Run full verification**

Run: `npx tsc --noEmit && npm test -- --run && npm run build`
Expected: all PASS. All 6 new primitives exist and are unused so far — that's expected, Task 9 wires them in.

- [ ] **Step 6: Commit**

```bash
git add src/components/homepage/HeroProductVisual.tsx src/components/homepage/HeroProductVisual.test.tsx
git commit -m "feat(homepage): add HeroProductVisual composite (score ring, floating cards, glowing path)"
```

---

## Task 7: Remove Concierge Editorial copy, keep file structurally valid

**Files:**
- Modify: `src/pages/LandingPage.tsx` (full content replacement in the next task — this task is a checkpoint-friendly seam, see below)

This task is intentionally a no-op checkpoint: **skip directly to Task 8**, which performs the full rewrite in one commit. (Splitting "delete old content" and "add new content" into two separate commits on the same file would leave an intermediate broken/half-narrative state with no independent value — see this plan's Architecture note on why the rewrite is one atomic task.)

---

## Task 8: Rewrite `LandingPage.tsx` around the 5-layer hierarchy

**Files:**
- Modify: `src/pages/LandingPage.tsx` (full replacement)
- Test: `src/pages/LandingPage.test.tsx` (rewritten in Task 9, not this task — this task only needs the app to build; do not skip Task 9)

**Interfaces:**
- Consumes: `Card`, `LinkButton`, `ProgressBar`, `SectionHeader` from `@/components/ui` barrel (all existing, unchanged — import via the barrel, matching every other page in this codebase, not deep per-file paths); `MetricCard`, `FreshFitBadge`, `ProfileStrengthCard`, `CurrentFocusCard`, `ForwardScoreCard`, `HeroProductVisual` from `@/components/homepage` (Tasks 1-6, each imported from its own file since `src/components/homepage/` has no barrel `index.ts` — not needed for six page-specific, single-consumer components); `OpportunityPreviewCard` from `@/components/OpportunityPreviewCard` (existing, unchanged); `ForwardFeedWidget` from `@/components/ForwardFeedWidget` (existing, unchanged, kept as-is).

- [ ] **Step 1: Replace the entire file**

```tsx
// src/pages/LandingPage.tsx
import {
  ArrowRight,
  Award,
  Compass,
  Dna,
  LayoutDashboard,
  MessageCircleMore,
  ShieldCheck,
} from 'lucide-react'
import { Card, LinkButton, ProgressBar, SectionHeader } from '@/components/ui'
import { ForwardFeedWidget } from '@/components/ForwardFeedWidget'
import { OpportunityPreviewCard } from '@/components/OpportunityPreviewCard'
import { HeroProductVisual } from '@/components/homepage/HeroProductVisual'
import { CurrentFocusCard } from '@/components/homepage/CurrentFocusCard'
import { ForwardScoreCard } from '@/components/homepage/ForwardScoreCard'
import { MetricCard } from '@/components/homepage/MetricCard'
import { FreshFitBadge } from '@/components/homepage/FreshFitBadge'

// Layer 2 (Personalized Intelligence) pillars. Each links to a real,
// existing member-only route -- unauthenticated visitors land on /signup
// instead, since none of these routes are reachable pre-auth. See the
// Sub-Project 2 spec's terminology map for why these four names/routes
// were chosen over the brief's idealized "Career Vault"/"Forward Profile"
// wording (the real routes are "Achievement Vault" and split across
// CareerProfilePage + ForwardDnaPage).
const pillars = [
  {
    icon: Dna,
    title: 'Understand',
    copy: 'Your Forward Profile and Forward DNA capture your experience, skills, and direction -- not just a resume upload.',
  },
  {
    icon: Award,
    title: 'Build',
    copy: 'Your Achievement Vault turns real accomplishments into organized, reusable evidence.',
  },
  {
    icon: Compass,
    title: 'Discover',
    copy: 'The Opportunity Engine surfaces roles that fit, scored by FreshFit against your real profile.',
  },
  {
    icon: LayoutDashboard,
    title: 'Advance',
    copy: 'Your Forward Score and dashboard track applications, interviews, and momentum in one place.',
  },
]

export function LandingPage() {
  return (
    <main className="callsheet">
      {/* Layer 1: Career Operating System (identity) */}
      <section className="bg-bg py-14 lg:py-24">
        <div className="shell grid items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="font-mono text-eyebrow font-semibold uppercase tracking-[0.13em] text-primary-400">
              A brighter career ahead
            </p>
            <h1 className="mt-3 font-display text-4xl font-semibold leading-[1.1] text-ink sm:text-5xl lg:text-6xl">
              Change the way you move your <span className="text-primary-400">career forward.</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-ink-muted">
              FreshlyForward is your career operating system: it understands your experience, shows you which
              opportunities actually fit, and gives you a clear next move -- with real strategists supporting you
              where judgment matters most.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <LinkButton to="/signup">
                Get started free <ArrowRight size={18} />
              </LinkButton>
              <LinkButton to="/how-it-works" variant="secondary">
                See how it works
              </LinkButton>
            </div>
            <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2" aria-label="Platform highlights">
              <span className="text-sm font-medium text-ink-muted">Personalized for your career</span>
              <span className="text-sm font-medium text-ink-muted">AI-powered career intelligence</span>
              <span className="text-sm font-medium text-ink-muted">Human strategists when you need them</span>
            </div>
          </div>
          <HeroProductVisual />
        </div>
      </section>

      {/* Layer 2: Personalized Intelligence */}
      <section className="bg-surface-elevated py-16 lg:py-24" aria-labelledby="intelligence-title">
        <div className="shell">
          <SectionHeader
            eyebrow="Personalized intelligence"
            title="More than a job search tool. A complete career operating system."
            description="FreshlyForward connects career identity, opportunity intelligence, career assets, and progress tracking -- built around your experience, not a generic search query."
          />
          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            {pillars.map(({ icon: Icon, title, copy }) => (
              <Card key={title} className="flex flex-col gap-3">
                <Icon className="h-6 w-6 text-primary-400" aria-hidden="true" />
                <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
                <p className="text-sm leading-relaxed text-ink-muted">{copy}</p>
                <LinkButton to="/signup" variant="secondary">
                  Start free <ArrowRight size={16} />
                </LinkButton>
                <p className="text-xs text-ink-muted">Sign in required</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Layer 3: Action (Current Focus) */}
      <section className="bg-surface-subtle py-16 lg:py-24" aria-labelledby="focus-title">
        <div className="shell grid items-center gap-12 lg:grid-cols-2">
          <SectionHeader
            eyebrow="Action"
            title="Your next move should be obvious."
            description="FreshlyForward reads your career data, identifies the highest-value priority, and gives you one clear next action -- not a wall of tools to figure out yourself."
          />
          <CurrentFocusCard
            title="Strengthen your leadership accomplishments"
            evidence="Your target roles emphasize team performance and measurable results, but only 6 of your 13 accomplishments currently include metrics."
            progressLabel="2 of 3 complete"
            ctaLabel="Continue this focus"
            ctaTo="/signup"
          />
        </div>
      </section>

      {/* Layer 4: Human Judgment -- repurposed hero headline, see spec */}
      <section className="bg-bg py-16 lg:py-24" aria-labelledby="judgment-title">
        <div className="shell max-w-3xl text-center">
          <p className="font-mono text-eyebrow font-semibold uppercase tracking-[0.13em] text-primary-400">
            Human judgment
          </p>
          <h2 id="judgment-title" className="mt-3 font-display text-3xl font-semibold leading-tight text-ink sm:text-4xl">
            A better search needs better judgment.
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-ink-muted">
            Technology gives you intelligence, organization, and momentum. Your strategist gives you judgment,
            context, and accountability when a decision actually matters -- reviewing your Friday progress reports,
            answering questions in Messages, and helping you prepare for interviews. FreshlyForward isn't a
            platform that replaced career professionals with software, and it isn't a career service with a
            website bolted on. It's both, working together.
          </p>
          <div className="mt-6 flex items-center justify-center gap-2 text-sm font-medium text-ink-muted">
            <MessageCircleMore className="h-4 w-4 text-primary-400" aria-hidden="true" />
            <ShieldCheck className="h-4 w-4 text-primary-400" aria-hidden="true" />
            <span>Real strategists, available inside your dashboard</span>
          </div>
        </div>
      </section>

      {/* Layer 5: Progress */}
      <section className="bg-surface-elevated py-16 lg:py-24" aria-labelledby="progress-title">
        <div className="shell">
          <SectionHeader
            eyebrow="Progress"
            title="See your career moving forward."
            description="Sample illustration -- your dashboard connects Forward Score, applications, and Career Vault progress into one view."
          />
          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            <ForwardScoreCard score={78} delta="+6 this month" />
            <MetricCard icon={Compass} label="New Opportunities" value="12" delta="+3 this week" />
            <MetricCard icon={Award} label="Achievement Vault" value="14/20" delta="+4 this month" />
          </div>
          <ProgressBar value={75} label="Goal progress" className="mt-8 max-w-md" />
        </div>
      </section>

      {/* Supporting proof point: Opportunity Intelligence */}
      <section className="bg-surface-subtle py-16 lg:py-24" aria-labelledby="opportunity-title">
        <div className="shell grid items-center gap-12 lg:grid-cols-2">
          <SectionHeader
            eyebrow="Opportunity intelligence"
            title="Know which opportunities are actually worth your time."
            description="FreshFit scores every opportunity against your real profile -- strengths, gaps, and seniority fit included, not just keyword matching."
          />
          <div>
            <FreshFitBadge score={86} />
            <div className="mt-4">
              <OpportunityPreviewCard
                role="Regional Account Manager"
                company="Sample Company"
                location="Remote"
                fitNote="Strong alignment on leadership scope and quota ownership; one gap flagged in data-analytics tooling."
                status="reviewed"
              />
            </div>
          </div>
        </div>
      </section>

      <ForwardFeedWidget />

      {/* TODO(social-proof): homepage currently has zero third-party validation.
          No real testimonials or partner logos exist on record for this
          project as of the Sub-Project 2 homepage rewrite -- do not fill this
          gap with fabricated quotes or logos. Before the next marketing push,
          add 2-3 real client quotes/outcomes here (name + result, with
          permission) or a real placement/client-count stat. */}

      <section className="closing-cta cs-final-call">
        <div className="shell closing-inner">
          <div>
            <span className="cs-stamp cs-stamp-light" aria-hidden="true">
              Get started
            </span>
            <h2>Your next opportunity is closer than you think.</h2>
            <p className="mt-3 max-w-md text-white/80">
              Build your Forward Profile and let FreshlyForward turn your experience into direction, opportunities,
              and momentum.
            </p>
          </div>
          <LinkButton to="/signup" variant="light">
            Get started free <ArrowRight size={18} />
          </LinkButton>
        </div>
      </section>
    </main>
  )
}
```

- [ ] **Step 2: Run full verification**

Run: `npx tsc --noEmit && npm test -- --run && npm run build`
Expected: `tsc` passes. `LandingPage.test.tsx` (still the old Concierge-Editorial-era test file at this point) will very likely FAIL here — that is expected and is fixed in Task 9, not this task. Confirm the *build* still succeeds and there are no TypeScript errors; do not attempt to make the old test file pass by editing this new markup back toward the old copy.

- [ ] **Step 3: Commit**

```bash
git add src/pages/LandingPage.tsx
git commit -m "refactor(homepage): rewrite LandingPage around the 5-layer positioning hierarchy

Replaces the Concierge Editorial narrative with the blended Career-OS/
human-judgment hierarchy locked in the Sub-Project 2 spec. LandingPage.test.tsx
still reflects the old copy at this commit -- fixed in the next commit,
kept separate so this diff is reviewable purely as markup/copy, not
entangled with test-assertion changes."
```

---

## Task 9: Rewrite `LandingPage.test.tsx` and verify guardrails

**Files:**
- Modify: `src/pages/LandingPage.test.tsx` (full replacement)

**Interfaces:**
- Consumes: `LandingPage` from `./LandingPage` (Task 8).

- [ ] **Step 1: Read the existing test file to preserve any still-relevant setup**

Run: `cat src/pages/LandingPage.test.tsx` (or open it) — note existing router/provider wrapper conventions used elsewhere in this test suite (e.g. `MemoryRouter`, any Supabase mock) before replacing, so the new file keeps the same wrapper pattern rather than inventing a new one.

- [ ] **Step 2: Replace the test file**

```tsx
// src/pages/LandingPage.test.tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { LandingPage } from './LandingPage'

function renderLanding() {
  return render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>
  )
}

describe('LandingPage', () => {
  it('leads with Career Operating System identity, not the old concierge copy', () => {
    renderLanding()
    expect(screen.getByText(/career forward\./)).toBeInTheDocument()
    expect(screen.queryByText(/human-led career concierge/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/No AI mass applications/i)).not.toBeInTheDocument()
  })

  it('preserves "A better search needs better judgment." as the Human Judgment section headline', () => {
    renderLanding()
    expect(screen.getByText('A better search needs better judgment.')).toBeInTheDocument()
  })

  it('does not position the platform as AI-replaces-coaches or coaches-with-a-website', () => {
    renderLanding()
    expect(screen.queryByText(/replaced career professionals/)).not.toBeInTheDocument()
    const judgmentCopy = screen.getByText(/Technology gives you intelligence/)
    expect(judgmentCopy.textContent).toMatch(/working together/)
  })

  it('does not include fabricated trusted-by logos or testimonials', () => {
    renderLanding()
    expect(screen.queryByText(/trusted by/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Amazon|Deloitte|Accenture/)).not.toBeInTheDocument()
  })

  it('labels every sample product card as a sample', () => {
    renderLanding()
    const sampleLabels = screen.getAllByText('Sample')
    expect(sampleLabels.length).toBeGreaterThan(0)
    expect(screen.getByText('Sample dashboard preview')).toBeInTheDocument()
  })

  it('every primary CTA points at a real route', () => {
    renderLanding()
    const signupLinks = screen.getAllByRole('link', { name: /get started free/i })
    signupLinks.forEach((link) => expect(link).toHaveAttribute('href', '/signup'))
    expect(screen.getByRole('link', { name: /see how it works/i })).toHaveAttribute('href', '/how-it-works')
  })

  it('renders the four Personalized Intelligence pillars linking to sign-up with a sign-in-required note', () => {
    renderLanding()
    expect(screen.getByText('Understand')).toBeInTheDocument()
    expect(screen.getByText('Build')).toBeInTheDocument()
    expect(screen.getByText('Discover')).toBeInTheDocument()
    expect(screen.getByText('Advance')).toBeInTheDocument()
    expect(screen.getAllByText('Sign in required').length).toBe(4)
  })

  it('renders the Progress section with a Forward Score and metrics', () => {
    renderLanding()
    expect(screen.getByText('Forward Score')).toBeInTheDocument()
    expect(screen.getByText('New Opportunities')).toBeInTheDocument()
  })

  it('renders the Opportunity Intelligence proof point with a FreshFit badge', () => {
    renderLanding()
    expect(screen.getByText(/FreshFit 86/)).toBeInTheDocument()
    expect(screen.getByText('Regional Account Manager')).toBeInTheDocument()
  })

  it('keeps the social-proof gap honest rather than fabricating testimonials', () => {
    renderLanding()
    // No visible testimonial quote/star-rating markup should exist.
    expect(screen.queryByText(/|stars|testimonial/i)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run the test file**

Run: `npm test -- --run src/pages/LandingPage.test.tsx`
Expected: PASS. If any assertion fails because the copy in Task 8 phrased something slightly differently (e.g. exact wording of the judgment-section paragraph), adjust the **test** to match Task 8's actual shipped copy only if the copy still satisfies every rule in this plan's Global Constraints and the spec's positioning guardrail -- otherwise fix the copy in `LandingPage.tsx`, not the test.

- [ ] **Step 4: Run full verification**

Run: `npx tsc --noEmit && npm test -- --run && npm run build`
Expected: all PASS — full suite, not just this file.

- [ ] **Step 5: Commit**

```bash
git add src/pages/LandingPage.test.tsx
git commit -m "test(homepage): rewrite LandingPage tests for the 5-layer hierarchy and positioning guardrails"
```

---

## Task 10: Final verification, screenshots, and review doc

**Files:**
- Create: `docs/superpowers/reviews/screenshots/subproject2-homepage/` (screenshot directory)
- Create: `docs/superpowers/reviews/2026-09-06-redesign-subproject2-homepage-review.md`

- [ ] **Step 1: Run full verification one more time from a clean state**

Run: `npx tsc --noEmit && npm test -- --run && npm run build`
Expected: all PASS.

- [ ] **Step 2: Capture screenshots**

Use the existing `scripts/visualReviewScreenshots.mjs` (already supports `SCREENSHOT_OUT_DIR` per Sub-Project 1 Task 33) to capture `/` at desktop and mobile widths into `docs/superpowers/reviews/screenshots/subproject2-homepage/`. If the execution environment's browser runtime is unavailable (as it was for this plan's research phase), note that explicitly in the review doc rather than skipping silently, same convention as Sub-Project 1's review.

- [ ] **Step 3: Write the review doc**

Cover: which of the spec's 5 layers shipped and where in the file, confirmation both preserved copy lines landed correctly, confirmation no fabricated logos/testimonials were introduced, confirmation every CTA resolves to a real route, verification command output, and screenshot links (or the environment-limitation note).

- [ ] **Step 4: Commit and push**

```bash
git add docs/superpowers/reviews/2026-09-06-redesign-subproject2-homepage-review.md docs/superpowers/reviews/screenshots/subproject2-homepage/
git commit -m "docs: Sub-Project 2 (Homepage) final review and deliverables summary"
git push origin main
```

Then verify: `git fetch --quiet && git rev-parse HEAD && git rev-parse origin/main` — confirm they match before reporting success.

## Stop-gate

Per the spec: Sub-Project 3 (ForwardOS Dashboard) does not begin until the owner reviews the implemented homepage (code + screenshots) against the spec and gives explicit approval.
