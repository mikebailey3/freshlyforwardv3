# Concierge Editorial Redesign — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the "Concierge Editorial" design system foundation (typography token, shared Friday Report card component) and validate it end-to-end on two representative screens: the Landing page hero (Persuade mode, full expression) and the Dashboard page (Operate mode, quieter sibling).

**Architecture:** Additive, not a global reskin. A new `--font-display` Tailwind theme token and a new `FridayReportCard` component are introduced without touching the existing `--font-serif`/`.cs-*`/`.button` systems that the other 51 not-yet-touched pages still depend on. Only `LandingPage.tsx`'s hero section and the whole of `DashboardPage.tsx` are visually rebuilt. Everything else on those two pages/the rest of the site is untouched until Phase 2/3 (separate future plans, per the spec).

**Tech Stack:** React + TypeScript + Vite + Tailwind v4 (CSS-first `@theme` config, no `tailwind.config.js`). This plan also introduces the repo's **first automated test** (Vitest + React Testing Library) for `FridayReportCard`, since it has real conditional rendering logic worth locking down — everything else in this plan is pure visual/markup change verified by `tsc && vite build` + manual browser check, matching this project's existing (test-framework-free) verification convention.

**Spec:** `docs/superpowers/specs/2026-08-28-concierge-editorial-redesign-design.md`

## Global Constraints

- Brand colors unchanged: navy `#071a31`, brand green `#078a58` (existing `--color-primary-*` scale in `src/index.css`). Do not introduce new brand colors.
- DM Sans stays the body typeface. Space Mono stays but accent-only (metadata/timestamps/labels), never structural page furniture.
- `tsc && vite build` (i.e. `npm run build`) must pass clean after every task before it is considered done.
- WCAG 2.2 AA is the floor: every new interactive element (pill buttons, the report card) needs visible focus states and sufficient contrast; do not regress the existing skip-link/`:focus-visible`/`prefers-reduced-motion` support in `src/index.css`.
- No fabricated data. `FridayReportCard` must only render fields that exist on the real `FridayReport` type (`src/types/index.ts:264`) — do not invent a "search progress %" or "top recommendation job" field just to match the reference mockup's exact visual; the mockup is directional inspiration, not a schema.
- Scope is exactly: `src/index.css` (tokens only), `index.html` (font link only), `src/components/ui.tsx` (new addition only, no edits to existing exports), new `src/components/FridayReportCard.tsx` (+ its test), `src/pages/LandingPage.tsx` (hero section only), `src/pages/DashboardPage.tsx` (whole file). No other file changes belong in this plan.

---

### Task 1: Add the `font-display` design token

**Files:**
- Modify: `index.html` (font `<link>` tag)
- Modify: `src/index.css:1-6` (the `@theme` block's font tokens)

**Interfaces:**
- Produces: a new Tailwind utility class `font-display` (from `--font-display`), usable by any component going forward. Does not change what `font-serif` or `font-mono` currently render.

- [ ] **Step 1: Add the Fraunces font request to the Google Fonts link**

In `index.html`, find:

```html
    <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@500;700;800&family=DM+Sans:wght@400;500;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
```

Replace with:

```html
    <link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@500;600;700&family=Manrope:wght@500;700;800&family=DM+Sans:wght@400;500;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
```

- [ ] **Step 2: Add the `--font-display` theme token**

In `src/index.css`, find:

```css
@theme {
  --font-serif: 'Manrope', 'DM Sans', sans-serif;
  --font-mono: 'Space Mono', ui-monospace, monospace;
```

Replace with:

```css
@theme {
  --font-serif: 'Manrope', 'DM Sans', sans-serif;
  --font-display: 'Fraunces', 'Georgia', serif;
  --font-mono: 'Space Mono', ui-monospace, monospace;
```

- [ ] **Step 3: Verify the build**

Run: `npm run build`
Expected: succeeds with no TypeScript or build errors (this task only adds CSS/HTML, nothing that can fail type-checking, but confirms nothing is malformed).

- [ ] **Step 4: Commit**

```bash
git add index.html src/index.css
git commit -m "Add font-display design token (Fraunces) for Concierge Editorial redesign"
```

---

### Task 2: Build the shared `FridayReportCard` component (TDD)

**Files:**
- Create: `src/components/FridayReportCard.tsx`
- Create: `src/components/FridayReportCard.test.tsx`
- Modify: `package.json` (add `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom` as devDependencies; add a `test` script)
- Create: `vitest.config.ts`

**Interfaces:**
- Consumes: `FridayReport` type from `@/types` (`src/types/index.ts:264`).
- Produces: `FridayReportCard` component and `FridayReportCardData` type, both exported from `src/components/FridayReportCard.tsx`, for Task 3 (Landing hero) to consume. Signature:
  `export function FridayReportCard({ report, isSample }: { report: FridayReportCardData; isSample?: boolean }): JSX.Element`

- [ ] **Step 1: Install test dependencies**

Run: `npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom`

- [ ] **Step 2: Add the Vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/vitest.setup.ts',
  },
})
```

Create `src/vitest.setup.ts`:

```ts
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 3: Add the `test` script**

In `package.json`, find:

```json
    "preview": "vite preview",
```

Replace with:

```json
    "preview": "vite preview",
    "test": "vitest run",
```

- [ ] **Step 4: Write the failing test**

Create `src/components/FridayReportCard.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FridayReportCard, type FridayReportCardData } from './FridayReportCard'

const baseReport: FridayReportCardData = {
  title: 'Week 5 Progress Report',
  report_date: '2026-05-09',
  summary: 'Strong week — three new roles authorized for application.',
  opportunities_reviewed: 18,
  applications_submitted: 3,
  interviews_scheduled: 1,
  next_steps: 'Finalize tailored resume\nSubmit application\nSchedule follow-up',
}

describe('FridayReportCard', () => {
  it('renders the report title and stat counts', () => {
    render(<FridayReportCard report={baseReport} />)
    expect(screen.getByText('Week 5 Progress Report')).toBeInTheDocument()
    expect(screen.getByText('18')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('splits next_steps into a list of individual steps', () => {
    render(<FridayReportCard report={baseReport} />)
    expect(screen.getByText('Finalize tailored resume')).toBeInTheDocument()
    expect(screen.getByText('Submit application')).toBeInTheDocument()
    expect(screen.getByText('Schedule follow-up')).toBeInTheDocument()
  })

  it('renders a fallback message when next_steps is null', () => {
    render(<FridayReportCard report={{ ...baseReport, next_steps: null }} />)
    expect(screen.getByText('No next steps recorded yet.')).toBeInTheDocument()
  })

  it('shows a "Sample Report" badge only when isSample is true', () => {
    const { rerender } = render(<FridayReportCard report={baseReport} />)
    expect(screen.queryByText('Sample Report')).not.toBeInTheDocument()
    rerender(<FridayReportCard report={baseReport} isSample />)
    expect(screen.getByText('Sample Report')).toBeInTheDocument()
  })
})
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `npm run test`
Expected: FAIL — `./FridayReportCard` module not found (component doesn't exist yet).

- [ ] **Step 6: Write the component**

Create `src/components/FridayReportCard.tsx`:

```tsx
import type { FridayReport } from '@/types'

export type FridayReportCardData = Pick<
  FridayReport,
  | 'title'
  | 'report_date'
  | 'summary'
  | 'opportunities_reviewed'
  | 'applications_submitted'
  | 'interviews_scheduled'
  | 'next_steps'
>

export interface FridayReportCardProps {
  report: FridayReportCardData
  isSample?: boolean
}

export function FridayReportCard({ report, isSample = false }: FridayReportCardProps) {
  const steps = report.next_steps
    ? report.next_steps.split('\n').map((s) => s.trim()).filter(Boolean)
    : []

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-primary-700">
          Friday Report
        </p>
        {isSample && (
          <span className="rounded-full border border-neutral-300 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase text-neutral-500">
            Sample Report
          </span>
        )}
      </div>
      <p className="mt-1 font-mono text-xs text-neutral-500">
        {new Date(report.report_date).toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })}
      </p>

      <h3 className="mt-4 font-display text-lg font-semibold text-neutral-900">{report.title}</h3>
      <p className="mt-2 text-sm text-neutral-600">{report.summary}</p>

      <div className="mt-5 grid grid-cols-3 gap-3 border-t border-neutral-100 pt-4">
        <Stat label="Opportunities Reviewed" value={report.opportunities_reviewed} />
        <Stat label="Applications Submitted" value={report.applications_submitted} />
        <Stat label="Interviews Scheduled" value={report.interviews_scheduled} />
      </div>

      <div className="mt-5 border-t border-neutral-100 pt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Next Steps</p>
        {steps.length > 0 ? (
          <ul className="mt-2 space-y-1.5">
            {steps.map((step) => (
              <li key={step} className="flex items-start gap-2 text-sm text-neutral-700">
                <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary-500" />
                {step}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-neutral-500">No next steps recorded yet.</p>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="font-mono text-2xl font-bold text-neutral-900">{value}</p>
      <p className="text-[11px] text-neutral-500">{label}</p>
    </div>
  )
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npm run test`
Expected: PASS, all 4 tests green.

- [ ] **Step 8: Verify the full build still passes**

Run: `npm run build`
Expected: succeeds with no TypeScript errors.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/vitest.setup.ts src/components/FridayReportCard.tsx src/components/FridayReportCard.test.tsx
git commit -m "Add shared FridayReportCard component with its first test"
```

---

### Task 3: Rebuild the Landing page hero (Persuade mode, full expression)

**Files:**
- Modify: `src/components/ui.tsx` (add new export, do not touch existing `LinkButton`/`SectionHeading`)
- Modify: `src/pages/LandingPage.tsx` (hero section only — the `<section className="cs-hero shell">...</section>` block; every other section on this page is untouched in this task)

**Interfaces:**
- Consumes: `FridayReportCard`/`FridayReportCardData` from Task 2.
- Produces: `PillLinkButton` exported from `src/components/ui.tsx`, for later phases to reuse — does not replace `LinkButton`, which the rest of the (not-yet-touched) site still uses.

- [ ] **Step 1: Add a new pill-shaped button primitive**

In `src/components/ui.tsx`, add this export at the end of the file (leave `LinkButton` and `SectionHeading` untouched):

```tsx
type PillLinkButtonProps = {
  to: string
  children: ReactNode
  variant?: 'primary' | 'secondary'
}

export function PillLinkButton({ to, children, variant = 'primary' }: PillLinkButtonProps) {
  const styles =
    variant === 'primary'
      ? 'bg-primary-600 text-white hover:bg-primary-700'
      : 'border-2 border-neutral-900 text-neutral-900 hover:bg-neutral-900 hover:text-white'
  return (
    <Link
      to={to}
      className={`inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-colors ${styles}`}
    >
      {children}
    </Link>
  )
}
```

- [ ] **Step 2: Add the sample data and new imports**

In `src/pages/LandingPage.tsx`, find the import block at the top:

```tsx
import { LinkButton, SectionHeading } from '@/components/ui'
import { ForwardFeedWidget } from '@/components/ForwardFeedWidget'
```

Replace with:

```tsx
import { LinkButton, PillLinkButton, SectionHeading } from '@/components/ui'
import { ForwardFeedWidget } from '@/components/ForwardFeedWidget'
import { FridayReportCard, type FridayReportCardData } from '@/components/FridayReportCard'
```

`LinkButton` stays imported and used — the rest of `LandingPage.tsx` (manifest section, contrast section, schedule section, service preview, closing CTA) still uses it and is untouched in this task.

Then, right before `export function LandingPage() {`, add the sample data (clearly labeled as a sample, never implied as a real member's report — this directly serves `PRODUCT.md`'s "no fabricated evidence" principle by making the sample-ness structural, not just a copy note):

```tsx
const sampleReport: FridayReportCardData = {
  title: 'Sample: Week 5 Progress Report',
  report_date: '2026-05-09',
  summary: 'This is what your strategist sends you every Friday — real numbers, a real recommendation, and a clear next step.',
  opportunities_reviewed: 18,
  applications_submitted: 3,
  interviews_scheduled: 1,
  next_steps: 'Finalize tailored resume\nSubmit application\nSchedule follow-up',
}
```

- [ ] **Step 3: Replace the hero section in `LandingPage.tsx`**

Find (the entire hero `<section>`, from `<section className="cs-hero shell">` through its closing `</section>`, currently lines 39–63):

```tsx
      <section className="cs-hero shell">
        <div className="cs-masthead">
          <span>FRESHLYFORWARD</span>
          <span>CALL SHEET</span>
          <span>STRATEGIST: ASSIGNED</span>
          <span>STATUS: IN PRODUCTION</span>
        </div>
        <div className="cs-hero-grid">
          <div className="cs-hero-copy reveal">
            <h1>We search. We apply. <span>You move forward.</span></h1>
            <p className="hero-lede">A real person manages the details of your job search—from strategy and tailored applications to interview preparation and ongoing support.</p>
            <div className="hero-actions">
              <LinkButton to="/signup">Get started <ArrowRight size={18} /></LinkButton>
              <LinkButton to="/how-it-works" variant="secondary">See how it works</LinkButton>
            </div>
            <div className="cs-manifest-strip" aria-label="Service assurances">
              <span><Check size={16} /> Human-led</span>
              <span><Check size={16} /> No mass applying</span>
              <span><Check size={16} /> Pause anytime</span>
            </div>
          </div>
          <div className="cs-contact-sheet reveal reveal-delay">
            <img src="/images/headshot.png?v=2" alt="FreshlyForward founder and career strategist" />
            <div className="cs-caption">
              <p>"Your search deserves focus, judgment, and a person who knows your story."</p>
              <div className="cs-caption-meta">
                <strong>Mike Bailey</strong>
                <span>FOUNDER &amp; STRATEGIST · FRAME 01</span>
              </div>
            </div>
          </div>
        </div>
      </section>
```

Replace with:

```tsx
      <section className="shell py-12 lg:py-20">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <h1 className="font-display text-4xl font-semibold leading-tight text-[var(--navy)] sm:text-5xl lg:text-6xl">
              A better search needs better judgment.
            </h1>
            <p className="mt-6 max-w-lg text-lg text-neutral-600">
              FreshlyForward is a human-led career concierge. We do the searching,
              vet the opportunities, and guide every step forward.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <PillLinkButton to="/signup">
                Get started <ArrowRight size={18} />
              </PillLinkButton>
              <PillLinkButton to="/how-it-works" variant="secondary">
                See how it works
              </PillLinkButton>
            </div>
            <div className="mt-6 flex flex-wrap gap-4" aria-label="Service assurances">
              <span className="flex items-center gap-1.5 text-sm font-medium text-neutral-600">
                <Check size={16} className="text-primary-600" /> Human-led
              </span>
              <span className="flex items-center gap-1.5 text-sm font-medium text-neutral-600">
                <Check size={16} className="text-primary-600" /> No mass applying
              </span>
              <span className="flex items-center gap-1.5 text-sm font-medium text-neutral-600">
                <Check size={16} className="text-primary-600" /> Pause anytime
              </span>
            </div>
          </div>
          <FridayReportCard report={sampleReport} isSample />
        </div>
      </section>
```

- [ ] **Step 4: Remove the now-unused `cs-masthead`/hero-only CSS (leave everything else in `index.css` alone)**

In `src/index.css`, delete only these two rules (the masthead bar and hero-photo "contact sheet" frame, which no longer have any consumer after Step 2 — every other `.cs-*` rule stays, since the rest of `LandingPage.tsx` still uses them):

```css
.cs-masthead { display: flex; flex-wrap: wrap; gap: 10px 22px; margin-bottom: 34px; padding-bottom: 14px; border-bottom: 1px dashed var(--line); font-family: 'Space Mono', monospace; font-size: .7rem; font-weight: 700; letter-spacing: .07em; text-transform: uppercase; color: #6b7789; }
.cs-masthead span:first-child { color: var(--navy); }
```

and:

```css
.cs-contact-sheet { position: relative; align-self: stretch; min-height: 480px; padding: 14px 14px 0; border: 1px solid var(--line); border-radius: 6px; background: #fbfaf6; box-shadow: var(--shadow); }
.cs-contact-sheet img { display: block; width: 100%; height: 380px; object-fit: cover; object-position: 50% 22%; border: 1px solid var(--line); filter: saturate(.92) contrast(1.02); }
.cs-caption { padding: 16px 4px 18px; }
.cs-caption p { margin: 0 0 12px; color: var(--navy); font-size: .92rem; font-style: italic; }
.cs-caption-meta { display: flex; flex-wrap: wrap; align-items: baseline; gap: 10px; font-family: 'Space Mono', monospace; font-size: .68rem; letter-spacing: .04em; text-transform: uppercase; color: var(--green-dark); }
.cs-caption-meta strong { font-family: 'Manrope', sans-serif; font-size: .82rem; text-transform: none; letter-spacing: 0; color: var(--navy); }
```

Leave `.cs-hero`, `.cs-hero-grid`, `.cs-hero-copy`, `.hero-lede`, `.hero-actions`, `.cs-manifest-strip` in place even though the hero no longer uses them directly — double-check with a grep in Step 5 before deciding whether any are still referenced elsewhere (e.g. by responsive media-query blocks); if a rule's grep shows zero remaining usages anywhere in `src/`, delete it too, otherwise leave it.

- [ ] **Step 5: Verify no dangling references**

Run: `grep -rn "cs-masthead\|cs-contact-sheet\|cs-caption" freshlyforwardv3/src`
Expected: no matches (confirms the deleted CSS had no other consumers).

- [ ] **Step 6: Verify the build**

Run: `npm run build`
Expected: succeeds, no TypeScript errors, no unresolved imports.

- [ ] **Step 7: Manual visual check**

Run: `npm run dev`, open the printed local URL, view `/`. Confirm: serif headline renders, the Friday Report card appears on the right with a visible "Sample Report" badge, both CTA buttons are pill-shaped, the rest of the page (manifest table, contrast section, schedule, etc.) still renders in the old Call Sheet style unchanged (expected — those are Phase 2 work). Also tab through the hero with keyboard only: both pill buttons must show the existing green `:focus-visible` outline (from `src/index.css`) — nothing in this task should suppress it.

- [ ] **Step 8: Commit**

```bash
git add src/components/ui.tsx src/pages/LandingPage.tsx src/index.css
git commit -m "Rebuild Landing page hero in Concierge Editorial direction"
```

---

### Task 4: Rebuild the Dashboard page (Operate mode, quieter sibling)

**Files:**
- Modify: `src/pages/DashboardPage.tsx` (entire file — it's already Tailwind-utility-based from this session's earlier Operate-mode pass, so this is a token/class swap, not a rewrite)

**Interfaces:**
- Consumes: `--font-display` token from Task 1. Does not consume `FridayReportCard` (Dashboard shows stat cards/tips/tools, not a Friday Report — that wiring is Phase 3 work on `FridayReportsPage`, out of scope here per the spec).

- [ ] **Step 1: Promote only the page-level heading to the new serif**

In `src/pages/DashboardPage.tsx`, find:

```tsx
        <h1 className="font-serif text-2xl font-semibold text-neutral-900 sm:text-3xl">
```

Replace with:

```tsx
        <h1 className="font-display text-2xl font-semibold text-neutral-900 sm:text-3xl">
```

- [ ] **Step 2: Demote the three section sub-headings back to plain text weight**

Per the spec's Operate-mode rule ("serif reserved for page-level `h1` titles only, not every card"), find each of these three (they currently use `font-serif`, which should only be used for true page titles going forward):

```tsx
          <h2 className="font-serif text-base font-semibold text-neutral-900">Recommended for You</h2>
```

```tsx
          <h2 className="font-serif text-base font-semibold text-neutral-900">Your Progress This Week</h2>
```

```tsx
        <h2 className="font-serif text-base font-semibold text-neutral-900">The Forward Feed</h2>
```

Replace each `font-serif` with nothing (just remove that class, keeping the rest):

```tsx
          <h2 className="text-base font-semibold text-neutral-900">Recommended for You</h2>
```

```tsx
          <h2 className="text-base font-semibold text-neutral-900">Your Progress This Week</h2>
```

```tsx
        <h2 className="text-base font-semibold text-neutral-900">The Forward Feed</h2>
```

- [ ] **Step 3: Soften the stat-card container and section cards to the new default (rounded + subtle shadow)**

Find:

```tsx
      <div className="border border-neutral-200">
```

Replace with:

```tsx
      <div className="rounded-xl border border-neutral-200 shadow-sm">
```

Find (the tip/motivation box):

```tsx
        <div className="border border-dashed border-neutral-300 bg-[var(--cream)] p-5 lg:col-span-2">
```

Replace with:

```tsx
        <div className="rounded-xl border border-dashed border-neutral-300 bg-[var(--cream)] p-5 lg:col-span-2">
```

Find (the "Upcoming" box):

```tsx
        <div className="border border-neutral-200 bg-white p-5">
```

Replace with:

```tsx
        <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
```

Find (both occurrences — "Recommended for You" and "Your Progress This Week" boxes share this exact class string):

```tsx
        <div className="border border-neutral-200 bg-white p-6">
```

Replace **both** occurrences with:

```tsx
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
```

Find (the Forward Feed box):

```tsx
      <div className="mt-6 border border-neutral-200 bg-white p-6">
```

Replace with:

```tsx
      <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
```

Find (the Quick Access Tools box):

```tsx
      <div className="mt-6 border border-neutral-200 bg-white p-6">
```

(this is the second occurrence of that exact string — the Forward Feed box above is the first; make sure both are replaced per the previous step, this one identically)

Replace with:

```tsx
      <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
```

- [ ] **Step 4: Soften the individual tool tiles and blog-teaser cards to match**

Find:

```tsx
              <Link key={post.id} to={`/forward-feed/${post.slug}`} className="border border-neutral-200 border-l-4 border-l-primary-600 p-4 transition-colors hover:border-l-primary-800">
```

Replace with:

```tsx
              <Link key={post.id} to={`/forward-feed/${post.slug}`} className="rounded-lg border border-neutral-200 border-l-4 border-l-primary-600 p-4 transition-colors hover:border-l-primary-800">
```

Find:

```tsx
              <div className="flex h-11 w-11 items-center justify-center border border-neutral-200 bg-neutral-50">
```

Replace with:

```tsx
              <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50">
```

- [ ] **Step 5: Verify the build**

Run: `npm run build`
Expected: succeeds, no TypeScript errors.

- [ ] **Step 6: Verify no accidental serif leftovers**

Run: `grep -n "font-serif" freshlyforwardv3/src/pages/DashboardPage.tsx`
Expected: zero matches (the page-level `h1` now uses `font-display`; nothing else on this page should use `font-serif` per the quieter-Operate rule).

- [ ] **Step 7: Manual visual check**

Run: `npm run dev` (if not already running), sign in via the dev auth bypass, open `/dashboard`. Confirm: page greeting uses the new serif, all card-like containers have visible rounded corners and a subtle shadow (not flat/sharp), sub-heading text is no longer serif, everything is still legible and functional (links work, progress bars render). Also tab through the stat-card links and quick-access tool tiles with keyboard only: the existing green `:focus-visible` outline must still appear on each — the new rounded/shadow classes must not clip or hide it.

- [ ] **Step 8: Commit**

```bash
git add src/pages/DashboardPage.tsx
git commit -m "Rebuild Dashboard page in Concierge Editorial direction (Operate-mode quiet sibling)"
```

---

### Task 5: Full-repo verification and wrap-up

**Files:** none (verification only)

- [ ] **Step 1: Run the full build**

Run: `npm run build`
Expected: succeeds clean.

- [ ] **Step 2: Run the test suite**

Run: `npm run test`
Expected: all `FridayReportCard` tests pass.

- [ ] **Step 3: Full-repo grep for scope leakage**

Run: `grep -rln "font-display\|FridayReportCard\|PillLinkButton" freshlyforwardv3/src`
Expected: matches only in `src/index.css`, `src/components/ui.tsx`, `src/components/FridayReportCard.tsx`, `src/components/FridayReportCard.test.tsx`, `src/pages/LandingPage.tsx`, `src/pages/DashboardPage.tsx` (the latter for `font-display` only). No other files should appear — if any do, scope crept beyond this plan and needs review before proceeding.

- [ ] **Step 4: Confirm dev-auth-bypass file is not staged**

Run: `git status --short`
Expected: `src/context/AuthContext.tsx` does not appear in the list (this repo has a recurring history of it accidentally getting staged via `git add -A`; every task in this plan used explicit file paths in `git add`, not `-A`, specifically to avoid this).
