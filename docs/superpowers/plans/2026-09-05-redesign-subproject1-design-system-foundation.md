# FreshlyForward Redesign — Sub-Project 1: Design System Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish one semantic navy/green design-token system (Tailwind tokens + legacy `:root` CSS variables), a small set of page-agnostic UI primitives, and an internal `/internal/design-system` showcase route — migrating every hardcoded literal-neutral/light-tuned color reference in the codebase onto that system, in bounded verified batches, with zero changes to business logic, routes, or page layout/copy.

**Architecture:** Two token layers already exist and both need remapping: (1) Tailwind v4 `@theme` custom properties in `src/index.css` consumed as Tailwind utility classes (`bg-primary-600`, `text-neutral-900`) across `.tsx` files, and (2) a separate legacy `:root` CSS variable block (`--navy`, `--cream`, `--green`, etc.) consumed by ~150 hand-rolled marketing CSS classes in the same file. Both get remapped to the new dark navy/green palette. New primitives live in a fresh `src/components/ui/` directory (the existing `src/components/ui.tsx` stays as-is — it holds marketing-CSS-class components and is migrated for its literal Tailwind classes only, not restructured). The showcase route is a new, unlinked page registered directly in `App.tsx`'s existing flat `<Routes>` block.

**Tech Stack:** React 18 + TypeScript + Vite + Tailwind CSS v4 (`@theme` tokens) + Vitest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-05-redesign-subproject1-design-system-foundation-design.md`

## Global Constraints

- Do not alter backend logic, database schema, FreshFit/Forward Score scoring logic, Supabase queries, auth, or routes other than adding the one new `/internal/design-system` route.
- Do not change any page's JSX structure, copy, or information hierarchy — migration tasks change **class names only** on existing markup.
- Do not build `CurrentFocusCard`, `ForwardScoreCard`, `OpportunityCard`, `ProfileStrengthCard`, or any other content-specific composite component in this plan — explicitly deferred to later sub-projects.
- No blind find/replace across files. Every substitution is reviewed against the semantic role table below in context.
- After every task: `npx tsc --noEmit`, `npm test -- --run`, and `npm run build` must all pass before moving on.
- Preserve intentional literal-color exceptions (document them, don't silently keep them).
- Sub-Project 2 (Homepage) does not begin until the owner reviews this sub-project's deliverables.

## Semantic Role Reference (used by every migration task below)

Tailwind utility-class substitutions (from literal → semantic):

| Literal (before) | Semantic (after) | Role |
|---|---|---|
| `bg-white` | `bg-surface-card` | Card surface |
| `bg-neutral-50` | `bg-surface-subtle` | Subtle/nested surface |
| `hover:bg-neutral-50`, `hover:bg-neutral-100` | `hover:bg-surface-hover` | Interactive hover surface |
| `bg-neutral-900` (solid dark fill, e.g. buttons) | `bg-primary-600` | Primary action fill (already green-tuned) |
| `border-neutral-200`, `border-neutral-300` | `border-border` | Border/divider |
| `text-neutral-900`, `text-neutral-800` | `text-ink` | Primary text |
| `text-neutral-500`, `text-neutral-600`, `text-neutral-400` | `text-ink-muted` | Secondary/muted text |
| `text-white` on a `bg-neutral-900`/`bg-primary-*` fill | `text-ink` (soft white already) | Text on filled surface |

Accent-scale pairings tuned for light backgrounds (light-tuned text+border pair → dark-tuned pair), found via case-by-case inspection per file — e.g. `border-success-300 text-success-700` (dark text, light border — assumes white background) becomes `border-success-600 text-success-300` (light text, mid-tone border — reads correctly on the new dark card surface). Apply the same light→dark flip direction to `primary-*`, `warning-*`, and `error-*` pairings found during each batch.

## Task 1: Tailwind semantic color and typography tokens

**Files:**
- Modify: `src/index.css:3-83` (the `@theme` block)
- Test: `src/index.css.tokens.test.ts` (new — a lightweight smoke test asserting the built CSS contains the new custom properties)

**Interfaces:**
- Produces: Tailwind utility classes `bg-canvas`... note: per the locked spec, token names are `--color-bg`, `--color-surface-elevated`, `--color-surface-card`, `--color-surface-subtle`, `--color-surface-hover`, `--color-ink`, `--color-ink-muted`, `--color-border`, which generate utilities `bg-bg`, `bg-surface-elevated`, `bg-surface-card`, `bg-surface-subtle`, `hover:bg-surface-hover`, `text-ink`, `text-ink-muted`, `border-border`. Also produces `--text-display`, `--text-h1`, `--text-h2`, `--text-h3`, `--text-body`, `--text-body-sm`, `--text-label`, `--text-eyebrow` → utilities `text-display`, `text-h1`, `text-h2`, `text-h3`, `text-body`, `text-body-sm`, `text-label`, `text-eyebrow`. All later tasks (primitives, migration batches) consume these exact class names.

- [ ] **Step 1: Write the failing smoke test**

```ts
// src/index.css.tokens.test.ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('semantic design tokens', () => {
  const css = readFileSync(new URL('./index.css', import.meta.url), 'utf-8')

  it('defines the new surface and ink tokens', () => {
    expect(css).toMatch(/--color-bg:\s*#031421/)
    expect(css).toMatch(/--color-surface-elevated:\s*#062235/)
    expect(css).toMatch(/--color-surface-card:\s*#0A2B3A/)
    expect(css).toMatch(/--color-surface-subtle:\s*#0E3444/)
    expect(css).toMatch(/--color-surface-hover:\s*#123044/)
    expect(css).toMatch(/--color-ink:\s*#F4F7FA/)
    expect(css).toMatch(/--color-ink-muted:\s*#8FA3B8/)
    expect(css).toMatch(/--color-border:\s*#16374A/)
  })

  it('retunes the primary accent scale to the fresh green', () => {
    expect(css).toMatch(/--color-primary-400:\s*#50F28C/)
    expect(css).toMatch(/--color-primary-600:\s*#2DCE75/)
  })

  it('defines the shared typography scale', () => {
    expect(css).toMatch(/--text-display:/)
    expect(css).toMatch(/--text-eyebrow:/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/index.css.tokens.test.ts`
Expected: FAIL — none of the new tokens exist yet.

- [ ] **Step 3: Replace the `@theme` block**

Replace the entire `@theme { ... }` block (`src/index.css:3-83`) with:

```css
@theme {
  --font-serif: 'Manrope', 'DM Sans', sans-serif;
  --font-display: 'Fraunces', 'Georgia', serif;
  --font-mono: 'Space Mono', ui-monospace, monospace;

  /* Semantic surfaces & ink — FreshlyForward dark navy/green redesign */
  --color-bg: #031421;
  --color-surface-elevated: #062235;
  --color-surface-card: #0A2B3A;
  --color-surface-subtle: #0E3444;
  --color-surface-hover: #123044;
  --color-ink: #F4F7FA;
  --color-ink-muted: #8FA3B8;
  --color-border: #16374A;

  /* Shared typography scale */
  --text-display: clamp(2.75rem, 6vw, 5.5rem);
  --text-h1: clamp(2.25rem, 4.5vw, 3.75rem);
  --text-h2: clamp(1.75rem, 3.5vw, 2.75rem);
  --text-h3: 1.25rem;
  --text-body: 1rem;
  --text-body-sm: 0.875rem;
  --text-label: 0.8125rem;
  --text-eyebrow: 0.76rem;

  /* FreshlyForward fresh-green accent (was dark workhorse green, now tuned for dark surfaces) */
  --color-primary-50: #E8FDF1;
  --color-primary-100: #C6FADB;
  --color-primary-200: #91F5BC;
  --color-primary-300: #6EF2A0;
  --color-primary-400: #50F28C;
  --color-primary-500: #3ADB79;
  --color-primary-600: #2DCE75;
  --color-primary-700: #229C5B;
  --color-primary-800: #1A7A47;
  --color-primary-900: #145C36;
  --color-primary-950: #0A2E1B;

  /* Complementary blue-teal, retuned lighter for dark surfaces */
  --color-secondary-50: #EAF3FD;
  --color-secondary-100: #C6E0FA;
  --color-secondary-200: #93C4F5;
  --color-secondary-300: #5FA5EE;
  --color-secondary-400: #3A8AE0;
  --color-secondary-500: #2670C7;
  --color-secondary-600: #1D59A3;
  --color-secondary-700: #17457F;
  --color-secondary-800: #12345F;
  --color-secondary-900: #0D2544;
  --color-secondary-950: #071527;

  /* Warm gold accent — unchanged, not part of this redesign's scope */
  --color-accent-50: #fefce8;
  --color-accent-100: #fdf6d8;
  --color-accent-200: #fbecad;
  --color-accent-300: #f8dd75;
  --color-accent-400: #f0c94a;
  --color-accent-500: #e0af2e;
  --color-accent-600: #d4af37;
  --color-accent-700: #a9821f;
  --color-accent-800: #85631c;
  --color-accent-900: #6f521c;
  --color-accent-950: #402b0d;

  /* Positive / success — retuned lighter for dark surfaces */
  --color-success-50: #E8FBEF;
  --color-success-100: #C3F5D6;
  --color-success-200: #91EDB7;
  --color-success-300: #5EE499;
  --color-success-400: #39D67F;
  --color-success-500: #22C06B;
  --color-success-600: #1AA25A;
  --color-success-700: #158548;
  --color-success-800: #106637;
  --color-success-900: #0B4A28;
  --color-success-950: #062A17;

  /* Caution / needs-attention — retuned lighter for dark surfaces */
  --color-warning-50: #FFF8E8;
  --color-warning-100: #FEECC0;
  --color-warning-200: #FDDD8D;
  --color-warning-300: #FBC85A;
  --color-warning-400: #F7B02E;
  --color-warning-500: #E89A1A;
  --color-warning-600: #C77E12;
  --color-warning-700: #A2650F;
  --color-warning-800: #7D4E0C;
  --color-warning-900: #5C3908;
  --color-warning-950: #331F04;

  /* Negative / error — retuned lighter for dark surfaces */
  --color-error-50: #FDEDEE;
  --color-error-100: #FAD0D3;
  --color-error-200: #F4A3A9;
  --color-error-300: #EC747D;
  --color-error-400: #E24C57;
  --color-error-500: #D22F3B;
  --color-error-600: #B4212C;
  --color-error-700: #8F1922;
  --color-error-800: #6E141B;
  --color-error-900: #4F0F14;
  --color-error-950: #2C070A;
}
```

All hex values are provisional defaults per the locked spec; refine only if the Task 33 visual/contrast QA pass finds a legibility problem, and note any adjustment against this task.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/index.css.tokens.test.ts`
Expected: PASS

- [ ] **Step 5: Run full verification**

Run: `npx tsc --noEmit && npm test -- --run && npm run build`
Expected: all PASS. The build will visually break every page at this point — expected and temporary; Task 2 begins fixing the legacy CSS side immediately, and JSX migration batches fix the rest. Do not stop here to "fix" anything outside this task's file.

- [ ] **Step 6: Commit**

```bash
git add src/index.css src/index.css.tokens.test.ts
git commit -m "feat(design-system): add semantic navy/green Tailwind tokens and type scale"
```

---

## Task 2: Audit and migrate legacy `index.css` `:root` variables and their consumers

This is the task added after discovering that ~150 hand-rolled marketing CSS classes (`.site-header`, `.button-primary`, `.page-hero`, `.pricing-card`, `.auth-page`, etc.) derive their colors entirely from a separate `:root` block, not the Tailwind `@theme` tokens from Task 1. Skipping this leaves the public marketing site light while the product app goes dark.

**Files:**
- Modify: `src/index.css:86-98` (the `:root` block)
- Modify: `src/index.css:104` (body), and every literal `white`/`#fff`/`rgba(255,...)` line identified below
- Test: extend `src/index.css.tokens.test.ts`

**Interfaces:**
- Consumes: nothing from Task 1 (this is the parallel legacy system).
- Produces: `--navy`, `--navy-soft`, `--green`, `--green-dark`, `--green-light`, `--mint`, `--cream`, `--line`, `--ink-soft`, `--ink` (new), `--white`, `--shadow` — same variable names as today except one addition (`--ink`), so all ~150 consuming class declarations keep working without name changes, only value changes plus the specific literal-color fixes below.

### Step 1: Write the failing tests

```ts
// append to src/index.css.tokens.test.ts
describe('legacy :root variables', () => {
  const css = readFileSync(new URL('./index.css', import.meta.url), 'utf-8')

  it('flips --navy to the new deep-navy background role', () => {
    expect(css).toMatch(/--navy:\s*#031421/)
  })

  it('adds a dedicated --ink variable for text now that --navy is a background', () => {
    expect(css).toMatch(/--ink:\s*#F4F7FA/)
  })

  it('retunes --cream and --mint from light warm tints to dark surfaces', () => {
    expect(css).toMatch(/--cream:\s*#0A2B3A/)
    expect(css).toMatch(/--mint:\s*#0E3444/)
  })

  it('body reads text/background from variables, not hardcoded literals', () => {
    expect(css).toMatch(/body\s*\{[^}]*color:\s*var\(--ink\)/)
    expect(css).toMatch(/body\s*\{[^}]*background:\s*var\(--navy\)/)
    expect(css).not.toMatch(/body\s*\{[^}]*background:\s*#fff/)
  })

  it('removes hardcoded literal white/#fff card backgrounds in favor of --cream', () => {
    expect(css).not.toMatch(/\.pricing-card\s*\{[^}]*background:\s*white/)
    expect(css).not.toMatch(/\.contact-card\s*\{[^}]*background:\s*white/)
  })
})
```

### Step 2: Run tests to verify they fail

Run: `npm test -- --run src/index.css.tokens.test.ts`
Expected: FAIL on every new assertion.

### Step 3: Inventory (already done — use this table, don't re-derive)

Dual-purpose / role-separation needed:

| Variable | Current role(s) | New role |
|---|---|---|
| `--navy` | body text color AND intentional dark backgrounds (`.contrast-section`, `.skip-link`) | **Background only** — becomes `#031421`. All `color: var(--navy)` (text) usages must switch to the new `--ink` variable instead. |
| *(new)* `--ink` | — | Primary text color on dark backgrounds: `#F4F7FA` |

`color: var(--navy)` usages that must become `color: var(--ink)` (13 locations, `src/index.css`): lines 104 (`body`), 137 (`.menu-button`), 145 (`.button-light`), 149 (`.cs-masthead span:first-child`), 178 (`.contrast-positive`), 206 (`.service-stack strong`), 261 (`.page-hero-mark`, two props), 275 (`.editorial-aside`), 309 (`.about-portrait > div`), 319 (`.about-checklist`), 331 (`.contact-detail strong`), 335 (`.contact-form label, .auth-card label`), 336 (`.contact-form input...`).

Literal hardcoded backgrounds/colors that must become variable references (26 locations, `src/index.css`), each mapped to a role:

| Line(s) | Selector | Literal found | New reference |
|---|---|---|---|
| 104 | `body` | `background: #fff` | `background: var(--navy)` |
| 120 | `.skip-link` | `color: white` | `color: var(--ink)` (background already `var(--navy)`, correct) |
| 126 | `.site-header` | `background: rgba(255,255,255,.92)` | `background: rgba(6,34,53,.92)` (translucent `--navy-soft`) |
| 141 | `.button-primary` | `color: white` | `color: var(--ink)` |
| 143 | `.button-secondary` | `background: white` | `background: transparent` (border+text carry the accent; card-style secondary buttons live on `--cream` contexts, not white) |
| 145 | `.button-light` | `background: white` | `background: var(--cream)` |
| 161 | `.cs-manifest-table` | `background: white` | `background: var(--cream)` |
| 169 | `.contrast-section` | `color: white` | `color: var(--ink)` |
| 176 | `.contrast-muted` | `background: rgba(255,255,255,.07)` | keep as-is — already a low-opacity overlay, works on dark (intentional exception) |
| 178 | `.contrast-positive` | `background: white` | `background: var(--mint)` |
| 201 | `.service-stack` | `background: white` | `background: var(--cream)` |
| 213 | `.forward-feed-card` | `background: white` | `background: var(--cream)` |
| 230 | `.blog-filter-pill` | `color: #526074; background: white` | `color: var(--ink-soft); background: var(--cream)` |
| 232 | `.blog-filter-pill.active` | `color: white` | `color: var(--navy)` (active pill uses green fill, needs dark text for contrast — intentional exception, documented) |
| 245 | `.closing-cta` | `color: white` | `color: var(--ink)` |
| 261 | `.page-hero-mark` | `background: white` | `background: var(--cream)` |
| 265 | `.feature-grid` | `background: white` | `background: var(--cream)` |
| 283 | `.pricing-card` | `background: white` | `background: var(--cream)` |
| 307 | `.about-portrait` | `background: white` | `background: var(--cream)` |
| 315 | `.values-grid` | `background: white` | `background: var(--cream)` |
| 319 | `.about-checklist` | `background: white` | `background: var(--cream)` |
| 332 | `.contact-card` | `background: white` | `background: var(--cream)` |
| 336 | `.contact-form input...` | `background: white` | `background: var(--navy-soft)` (form fields sit one step darker than their card) |
| 363 | `.authorization-grid` | `background: white` | `background: var(--cream)` |
| 379 | `.auth-card` | `background: white` | `background: var(--cream)` |
| 411 | `.site-header nav` (mobile) | `background: white` | `background: var(--navy)` |

### Step 4: Replace the `:root` block (`src/index.css:86-98`)

```css
:root {
  --navy: #031421;
  --navy-soft: #062235;
  --ink: #F4F7FA;
  --green: #50F28C;
  --green-dark: #2DCE75;
  --green-light: #103b2a;
  --mint: #0E3444;
  --cream: #0A2B3A;
  --line: #16374A;
  --ink-soft: #8FA3B8;
  --white: #F4F7FA;
  --shadow: 0 22px 60px rgba(0, 0, 0, .45);
  --radius: 22px;
}
```

### Step 5: Apply the two substitution tables above

Go through each line listed in the inventory tables and make exactly the listed change — `color: var(--navy)` → `color: var(--ink)`, and each literal background per its mapped variable. Leave `.contrast-muted` and `.blog-filter-pill.active` exactly as noted (documented intentional exceptions — add a one-line CSS comment above each explaining why, e.g. `/* intentional: active pill keeps dark text for contrast against the green fill */`).

### Step 6: Run tests to verify they pass

Run: `npm test -- --run src/index.css.tokens.test.ts`
Expected: PASS

### Step 7: Focused verification (per the owner's explicit requirement for this task)

Run in order:
1. `npx tsc --noEmit` — expect PASS (no `.tsx` changes in this task, should be unaffected)
2. `npm test -- --run` — expect full suite PASS
3. `npm run build` — expect PASS
4. Start `npm run dev`, open `/about` (representative public page) in a browser, visually confirm: dark navy background, light text, cards render as dark surfaces (`--cream`), no white flashes, nav still readable. Screenshot and save to `docs/superpowers/reviews/screenshots/subproject1-task2-public-about.png`.
5. Sign in and open `/dashboard` (representative authenticated page) — this page uses Tailwind literal classes (migrated in later tasks, not this one), so it will still show light card surfaces; confirm it isn't *also* broken/unreadable (e.g., no white-on-white or navy-on-navy text) — the goal here is "no half-dark/half-light breakage," not full completion. Screenshot and save to `docs/superpowers/reviews/screenshots/subproject1-task2-dashboard-before-migration.png`.

### Step 8: Commit

```bash
git add src/index.css src/index.css.tokens.test.ts
git commit -m "feat(design-system): migrate legacy :root variables and marketing CSS to dark navy/green"
```

---

## Task 3: Primitive — `SectionEyebrow`

**Files:**
- Create: `src/components/ui/SectionEyebrow.tsx`
- Create: `src/components/ui/SectionEyebrow.test.tsx`
- Create: `src/components/ui/index.ts` (barrel — created here, extended by later primitive tasks)

**Interfaces:**
- Produces: `SectionEyebrow({ children: ReactNode, className?: string })` — exported from `src/components/ui/index.ts`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/ui/SectionEyebrow.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SectionEyebrow } from './SectionEyebrow'

describe('SectionEyebrow', () => {
  it('renders its label text', () => {
    render(<SectionEyebrow>Career Intelligence</SectionEyebrow>)
    expect(screen.getByText('Career Intelligence')).toBeInTheDocument()
  })

  it('uses the primary accent color and eyebrow type scale', () => {
    render(<SectionEyebrow>Career Intelligence</SectionEyebrow>)
    const el = screen.getByText('Career Intelligence')
    expect(el.className).toContain('text-eyebrow')
    expect(el.className).toContain('text-primary-400')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/components/ui/SectionEyebrow.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
// src/components/ui/SectionEyebrow.tsx
import type { ReactNode } from 'react'

type SectionEyebrowProps = {
  children: ReactNode
  className?: string
}

export function SectionEyebrow({ children, className = '' }: SectionEyebrowProps) {
  return (
    <p className={`text-eyebrow font-semibold uppercase tracking-[0.13em] text-primary-400 ${className}`}>
      {children}
    </p>
  )
}
```

```ts
// src/components/ui/index.ts
export { SectionEyebrow } from './SectionEyebrow'
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/components/ui/SectionEyebrow.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/SectionEyebrow.tsx src/components/ui/SectionEyebrow.test.tsx src/components/ui/index.ts
git commit -m "feat(design-system): add SectionEyebrow primitive"
```

---

## Task 4: Primitive — `SectionHeader`

**Files:**
- Create: `src/components/ui/SectionHeader.tsx`
- Create: `src/components/ui/SectionHeader.test.tsx`
- Modify: `src/components/ui/index.ts`

**Interfaces:**
- Consumes: `SectionEyebrow` from Task 3 (`src/components/ui/SectionEyebrow.tsx`).
- Produces: `SectionHeader({ eyebrow?: string, title: string, description?: string, align?: 'left' | 'center', className?: string })`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/ui/SectionHeader.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SectionHeader } from './SectionHeader'

describe('SectionHeader', () => {
  it('renders title, eyebrow, and description', () => {
    render(<SectionHeader eyebrow="Focus" title="Your Next Move" description="Here is what matters this week." />)
    expect(screen.getByText('Focus')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Your Next Move' })).toBeInTheDocument()
    expect(screen.getByText('Here is what matters this week.')).toBeInTheDocument()
  })

  it('renders without eyebrow or description', () => {
    render(<SectionHeader title="Applications" />)
    expect(screen.getByRole('heading', { name: 'Applications' })).toBeInTheDocument()
  })

  it('centers content when align is center', () => {
    render(<SectionHeader title="Applications" align="center" />)
    expect(screen.getByRole('heading').closest('div')?.className).toContain('text-center')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/components/ui/SectionHeader.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
// src/components/ui/SectionHeader.tsx
import { SectionEyebrow } from './SectionEyebrow'

type SectionHeaderProps = {
  eyebrow?: string
  title: string
  description?: string
  align?: 'left' | 'center'
  className?: string
}

export function SectionHeader({ eyebrow, title, description, align = 'left', className = '' }: SectionHeaderProps) {
  const alignClass = align === 'center' ? 'mx-auto text-center' : 'text-left'
  return (
    <div className={`max-w-2xl ${alignClass} ${className}`}>
      {eyebrow && <SectionEyebrow className="mb-3">{eyebrow}</SectionEyebrow>}
      <h2 className="text-h2 font-display text-ink">{title}</h2>
      {description && <p className="mt-3 text-body text-ink-muted">{description}</p>}
    </div>
  )
}
```

```ts
// add to src/components/ui/index.ts
export { SectionHeader } from './SectionHeader'
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/components/ui/SectionHeader.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/SectionHeader.tsx src/components/ui/SectionHeader.test.tsx src/components/ui/index.ts
git commit -m "feat(design-system): add SectionHeader primitive"
```

---

## Task 5: Primitives — `CTAButton` and `SecondaryButton`

**Files:**
- Create: `src/components/ui/CTAButton.tsx`
- Create: `src/components/ui/CTAButton.test.tsx`
- Create: `src/components/ui/SecondaryButton.tsx`
- Create: `src/components/ui/SecondaryButton.test.tsx`
- Modify: `src/components/ui/index.ts`

**Interfaces:**
- Produces: `CTAButton({ children: ReactNode, onClick?: () => void, type?: 'button' | 'submit', disabled?: boolean, className?: string })` and `SecondaryButton` with the identical prop shape.

- [ ] **Step 1: Write the failing tests**

```tsx
// src/components/ui/CTAButton.test.tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CTAButton } from './CTAButton'

describe('CTAButton', () => {
  it('renders children and fires onClick', () => {
    const onClick = vi.fn()
    render(<CTAButton onClick={onClick}>Take Career Compass</CTAButton>)
    fireEvent.click(screen.getByRole('button', { name: 'Take Career Compass' }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('uses the primary accent fill', () => {
    render(<CTAButton>Go</CTAButton>)
    expect(screen.getByRole('button').className).toContain('bg-primary-600')
  })

  it('respects disabled', () => {
    render(<CTAButton disabled>Go</CTAButton>)
    expect(screen.getByRole('button')).toBeDisabled()
  })
})
```

```tsx
// src/components/ui/SecondaryButton.test.tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SecondaryButton } from './SecondaryButton'

describe('SecondaryButton', () => {
  it('renders children and fires onClick', () => {
    const onClick = vi.fn()
    render(<SecondaryButton onClick={onClick}>See How It Works</SecondaryButton>)
    fireEvent.click(screen.getByRole('button', { name: 'See How It Works' }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('uses a bordered transparent style, not a solid fill', () => {
    render(<SecondaryButton>Go</SecondaryButton>)
    const cls = screen.getByRole('button').className
    expect(cls).toContain('border-border')
    expect(cls).not.toContain('bg-primary-600')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run src/components/ui/CTAButton.test.tsx src/components/ui/SecondaryButton.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

```tsx
// src/components/ui/CTAButton.tsx
import type { ReactNode } from 'react'

type CTAButtonProps = {
  children: ReactNode
  onClick?: () => void
  type?: 'button' | 'submit'
  disabled?: boolean
  className?: string
}

export function CTAButton({ children, onClick, type = 'button', disabled = false, className = '' }: CTAButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-full bg-primary-600 px-6 py-3 text-sm font-semibold text-ink transition-colors hover:bg-primary-500 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  )
}
```

```tsx
// src/components/ui/SecondaryButton.tsx
import type { ReactNode } from 'react'

type SecondaryButtonProps = {
  children: ReactNode
  onClick?: () => void
  type?: 'button' | 'submit'
  disabled?: boolean
  className?: string
}

export function SecondaryButton({ children, onClick, type = 'button', disabled = false, className = '' }: SecondaryButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-full border border-border bg-transparent px-6 py-3 text-sm font-semibold text-ink transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  )
}
```

```ts
// add to src/components/ui/index.ts
export { CTAButton } from './CTAButton'
export { SecondaryButton } from './SecondaryButton'
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run src/components/ui/CTAButton.test.tsx src/components/ui/SecondaryButton.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/CTAButton.tsx src/components/ui/CTAButton.test.tsx src/components/ui/SecondaryButton.tsx src/components/ui/SecondaryButton.test.tsx src/components/ui/index.ts
git commit -m "feat(design-system): add CTAButton and SecondaryButton primitives"
```

---

## Task 6: Primitive — `Card`

**Files:**
- Create: `src/components/ui/Card.tsx`
- Create: `src/components/ui/Card.test.tsx`
- Modify: `src/components/ui/index.ts`

**Interfaces:**
- Produces: `Card({ children: ReactNode, className?: string, padded?: boolean })`. Later migration batches and future sub-projects use this as the base surface instead of hand-rolled `bg-white border` divs.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/ui/Card.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Card } from './Card'

describe('Card', () => {
  it('renders children on the semantic card surface', () => {
    render(<Card>Content</Card>)
    const el = screen.getByText('Content')
    expect(el.parentElement?.className).toContain('bg-surface-card')
  })

  it('applies padding by default and can opt out', () => {
    render(<Card padded={false}>Content</Card>)
    expect(screen.getByText('Content').parentElement?.className).not.toContain('p-6')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/components/ui/Card.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
// src/components/ui/Card.tsx
import type { ReactNode } from 'react'

type CardProps = {
  children: ReactNode
  className?: string
  padded?: boolean
}

export function Card({ children, className = '', padded = true }: CardProps) {
  return (
    <div className={`rounded-2xl border border-border bg-surface-card ${padded ? 'p-6' : ''} ${className}`}>
      {children}
    </div>
  )
}
```

```ts
// add to src/components/ui/index.ts
export { Card } from './Card'
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/components/ui/Card.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/Card.tsx src/components/ui/Card.test.tsx src/components/ui/index.ts
git commit -m "feat(design-system): add Card primitive"
```

---

## Task 7: Primitive — `ProgressBar`

**Files:**
- Create: `src/components/ui/ProgressBar.tsx`
- Create: `src/components/ui/ProgressBar.test.tsx`
- Modify: `src/components/ui/index.ts`

**Interfaces:**
- Produces: `ProgressBar({ value: number, max?: number, label?: string, className?: string })`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/ui/ProgressBar.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProgressBar } from './ProgressBar'

describe('ProgressBar', () => {
  it('exposes an accessible progressbar role with correct bounds', () => {
    render(<ProgressBar value={43} label="Profile completeness" />)
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '43')
    expect(bar).toHaveAttribute('aria-valuemax', '100')
  })

  it('renders the label and rounded percentage', () => {
    render(<ProgressBar value={43} label="Profile completeness" />)
    expect(screen.getByText('Profile completeness')).toBeInTheDocument()
    expect(screen.getByText('43%')).toBeInTheDocument()
  })

  it('clamps values outside 0-max', () => {
    render(<ProgressBar value={150} max={100} />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '150')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/components/ui/ProgressBar.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
// src/components/ui/ProgressBar.tsx
type ProgressBarProps = {
  value: number
  max?: number
  label?: string
  className?: string
}

export function ProgressBar({ value, max = 100, label, className = '' }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div className={className}>
      {label && (
        <div className="mb-1.5 flex justify-between text-label text-ink-muted">
          <span>{label}</span>
          <span>{Math.round(pct)}%</span>
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        className="h-2 w-full overflow-hidden rounded-full bg-surface-subtle"
      >
        <div className="h-full rounded-full bg-primary-500 transition-[width]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
```

```ts
// add to src/components/ui/index.ts
export { ProgressBar } from './ProgressBar'
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/components/ui/ProgressBar.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/ProgressBar.tsx src/components/ui/ProgressBar.test.tsx src/components/ui/index.ts
git commit -m "feat(design-system): add ProgressBar primitive"
```

---

## Task 8: Primitive — `Tabs`

**Files:**
- Create: `src/components/ui/Tabs.tsx`
- Create: `src/components/ui/Tabs.test.tsx`
- Modify: `src/components/ui/index.ts`

**Interfaces:**
- Produces: `Tabs({ tabs: { id: string; label: string }[], activeId: string, onChange: (id: string) => void, className?: string })`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/ui/Tabs.test.tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Tabs } from './Tabs'

const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'applications', label: 'Applications' },
]

describe('Tabs', () => {
  it('marks the active tab as selected', () => {
    render(<Tabs tabs={tabs} activeId="overview" onChange={() => {}} />)
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Applications' })).toHaveAttribute('aria-selected', 'false')
  })

  it('calls onChange with the clicked tab id', () => {
    const onChange = vi.fn()
    render(<Tabs tabs={tabs} activeId="overview" onChange={onChange} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Applications' }))
    expect(onChange).toHaveBeenCalledWith('applications')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/components/ui/Tabs.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
// src/components/ui/Tabs.tsx
type Tab = { id: string; label: string }

type TabsProps = {
  tabs: Tab[]
  activeId: string
  onChange: (id: string) => void
  className?: string
}

export function Tabs({ tabs, activeId, onChange, className = '' }: TabsProps) {
  return (
    <div role="tablist" className={`flex gap-1 border-b border-border ${className}`}>
      {tabs.map((tab) => {
        const active = tab.id === activeId
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={`border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
              active ? 'border-primary-400 text-ink' : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
```

```ts
// add to src/components/ui/index.ts
export { Tabs } from './Tabs'
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/components/ui/Tabs.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/Tabs.tsx src/components/ui/Tabs.test.tsx src/components/ui/index.ts
git commit -m "feat(design-system): add Tabs primitive"
```

---

## Task 9: Primitive — `FilterChip`

**Files:**
- Create: `src/components/ui/FilterChip.tsx`
- Create: `src/components/ui/FilterChip.test.tsx`
- Modify: `src/components/ui/index.ts`

**Interfaces:**
- Produces: `FilterChip({ label: string, active?: boolean, onClick?: () => void, className?: string })`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/ui/FilterChip.test.tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FilterChip } from './FilterChip'

describe('FilterChip', () => {
  it('reflects active state via aria-pressed', () => {
    render(<FilterChip label="Remote" active />)
    expect(screen.getByRole('button', { name: 'Remote' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('calls onClick when clicked', () => {
    const onClick = vi.fn()
    render(<FilterChip label="Remote" onClick={onClick} />)
    fireEvent.click(screen.getByRole('button', { name: 'Remote' }))
    expect(onClick).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/components/ui/FilterChip.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
// src/components/ui/FilterChip.tsx
type FilterChipProps = {
  label: string
  active?: boolean
  onClick?: () => void
  className?: string
}

export function FilterChip({ label, active = false, onClick, className = '' }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
        active
          ? 'border-primary-400 bg-primary-950 text-primary-300'
          : 'border-border text-ink-muted hover:border-primary-400 hover:text-ink'
      } ${className}`}
    >
      {label}
    </button>
  )
}
```

```ts
// add to src/components/ui/index.ts
export { FilterChip } from './FilterChip'
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/components/ui/FilterChip.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/FilterChip.tsx src/components/ui/FilterChip.test.tsx src/components/ui/index.ts
git commit -m "feat(design-system): add FilterChip primitive"
```

---

## Task 10: Primitive — `EmptyState`

**Files:**
- Create: `src/components/ui/EmptyState.tsx`
- Create: `src/components/ui/EmptyState.test.tsx`
- Modify: `src/components/ui/index.ts`

**Interfaces:**
- Produces: `EmptyState({ icon?: ReactNode, title: string, description?: string, action?: ReactNode, className?: string })`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/ui/EmptyState.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EmptyState } from './EmptyState'

describe('EmptyState', () => {
  it('renders title, description, and action', () => {
    render(<EmptyState title="No applications yet" description="Submit a job to get started." action={<button>Submit a job</button>} />)
    expect(screen.getByText('No applications yet')).toBeInTheDocument()
    expect(screen.getByText('Submit a job to get started.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Submit a job' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/components/ui/EmptyState.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
// src/components/ui/EmptyState.tsx
import type { ReactNode } from 'react'

type EmptyStateProps = {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({ icon, title, description, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-surface-subtle px-6 py-12 text-center ${className}`}>
      {icon && <div className="text-ink-muted">{icon}</div>}
      <p className="text-base font-semibold text-ink">{title}</p>
      {description && <p className="max-w-sm text-sm text-ink-muted">{description}</p>}
      {action}
    </div>
  )
}
```

```ts
// add to src/components/ui/index.ts
export { EmptyState } from './EmptyState'
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/components/ui/EmptyState.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/EmptyState.tsx src/components/ui/EmptyState.test.tsx src/components/ui/index.ts
git commit -m "feat(design-system): add EmptyState primitive"
```

---

## Task 11: Primitive — `DataRow`

**Files:**
- Create: `src/components/ui/DataRow.tsx`
- Create: `src/components/ui/DataRow.test.tsx`
- Modify: `src/components/ui/index.ts`

**Interfaces:**
- Produces: `DataRow({ label: string, value: ReactNode, className?: string })`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/ui/DataRow.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DataRow } from './DataRow'

describe('DataRow', () => {
  it('renders label and value', () => {
    render(<DataRow label="FreshFit score" value="86" />)
    expect(screen.getByText('FreshFit score')).toBeInTheDocument()
    expect(screen.getByText('86')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/components/ui/DataRow.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
// src/components/ui/DataRow.tsx
import type { ReactNode } from 'react'

type DataRowProps = {
  label: string
  value: ReactNode
  className?: string
}

export function DataRow({ label, value, className = '' }: DataRowProps) {
  return (
    <div className={`flex items-center justify-between gap-4 border-b border-border py-3 last:border-b-0 ${className}`}>
      <span className="text-sm text-ink-muted">{label}</span>
      <span className="text-sm font-semibold text-ink">{value}</span>
    </div>
  )
}
```

```ts
// add to src/components/ui/index.ts
export { DataRow } from './DataRow'
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/components/ui/DataRow.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/DataRow.tsx src/components/ui/DataRow.test.tsx src/components/ui/index.ts
git commit -m "feat(design-system): add DataRow primitive"
```

---

## Task 12: `/internal/design-system` showcase route

**Files:**
- Create: `src/pages/internal/DesignSystemShowcasePage.tsx`
- Create: `src/pages/internal/DesignSystemShowcasePage.test.tsx`
- Modify: `src/App.tsx` (add import + route, right before the catch-all `<Route path="*" .../>` currently at line 441)

**Interfaces:**
- Consumes: every primitive from Tasks 3–11 via `import { SectionEyebrow, SectionHeader, CTAButton, SecondaryButton, Card, ProgressBar, Tabs, FilterChip, EmptyState, DataRow } from '@/components/ui'`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/pages/internal/DesignSystemShowcasePage.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DesignSystemShowcasePage } from './DesignSystemShowcasePage'

describe('DesignSystemShowcasePage', () => {
  it('renders every foundation section with realistic FreshlyForward content', () => {
    render(<DesignSystemShowcasePage />)
    expect(screen.getByRole('heading', { name: 'Design System Foundation' })).toBeInTheDocument()
    expect(screen.getByText('Surfaces')).toBeInTheDocument()
    expect(screen.getByText('Typography')).toBeInTheDocument()
    expect(screen.getByText('Buttons')).toBeInTheDocument()
    expect(screen.getByText('Cards')).toBeInTheDocument()
    expect(screen.getByText('Progress')).toBeInTheDocument()
    expect(screen.getByText('Tabs')).toBeInTheDocument()
    expect(screen.getByText('Filter chips')).toBeInTheDocument()
    expect(screen.getByText('Data rows')).toBeInTheDocument()
    expect(screen.getByText('Empty, loading, and error states')).toBeInTheDocument()
    expect(screen.getByText('Navigation states')).toBeInTheDocument()
  })

  it('uses realistic content, not lorem ipsum', () => {
    render(<DesignSystemShowcasePage />)
    expect(screen.queryByText(/lorem ipsum/i)).not.toBeInTheDocument()
    expect(screen.getByText(/FreshFit/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/pages/internal/DesignSystemShowcasePage.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
// src/pages/internal/DesignSystemShowcasePage.tsx
import { useState } from 'react'
import {
  Card,
  CTAButton,
  DataRow,
  EmptyState,
  FilterChip,
  ProgressBar,
  SecondaryButton,
  SectionEyebrow,
  SectionHeader,
  Tabs,
} from '@/components/ui'

export function DesignSystemShowcasePage() {
  const [activeTab, setActiveTab] = useState('overview')
  const [activeFilter, setActiveFilter] = useState('remote')

  return (
    <div className="min-h-screen bg-bg px-6 py-12 text-ink">
      <div className="mx-auto max-w-5xl space-y-16">
        <header>
          <SectionEyebrow>Internal — Visual QA Only</SectionEyebrow>
          <h1 className="text-display font-display text-ink">Design System Foundation</h1>
          <p className="mt-3 max-w-2xl text-body text-ink-muted">
            Every foundational primitive from Sub-Project 1, shown with realistic FreshlyForward
            content at desktop and mobile widths. Not linked from any public navigation.
          </p>
        </header>

        <section>
          <h2 className="mb-4 text-h3 font-display text-ink">Surfaces</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl bg-bg p-6 text-center text-sm text-ink-muted ring-1 ring-border">bg-bg</div>
            <div className="rounded-xl bg-surface-elevated p-6 text-center text-sm text-ink-muted">bg-surface-elevated</div>
            <div className="rounded-xl bg-surface-card p-6 text-center text-sm text-ink-muted">bg-surface-card</div>
            <div className="rounded-xl bg-surface-subtle p-6 text-center text-sm text-ink-muted">bg-surface-subtle</div>
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-h3 font-display text-ink">Typography</h2>
          <SectionHeader
            eyebrow="Opportunity Intelligence"
            title="Your FreshFit for Regional Account Manager is 86"
            description="Strong alignment on leadership scope and compensation. One gap worth addressing before you apply."
          />
        </section>

        <section>
          <h2 className="mb-4 text-h3 font-display text-ink">Buttons</h2>
          <div className="flex flex-wrap gap-3">
            <CTAButton>Take Career Compass</CTAButton>
            <SecondaryButton>See How It Works</SecondaryButton>
            <CTAButton disabled>Submitting…</CTAButton>
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-h3 font-display text-ink">Cards</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <p className="text-sm font-semibold text-ink">Regional Account Manager</p>
              <p className="mt-1 text-sm text-ink-muted">Kellanova · Chicago, IL · FreshFit 86</p>
            </Card>
            <Card>
              <p className="text-sm font-semibold text-ink">Strengthen your leadership accomplishments</p>
              <p className="mt-1 text-sm text-ink-muted">One targeted edit to your Forward Profile could raise your fit on similar roles.</p>
            </Card>
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-h3 font-display text-ink">Progress</h2>
          <div className="max-w-sm space-y-4">
            <ProgressBar value={86} label="FreshFit — Regional Account Manager" />
            <ProgressBar value={62} label="Forward Profile completeness" />
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-h3 font-display text-ink">Tabs</h2>
          <Tabs
            tabs={[
              { id: 'overview', label: 'Overview' },
              { id: 'applications', label: 'Applications' },
              { id: 'compass', label: 'Career Compass' },
            ]}
            activeId={activeTab}
            onChange={setActiveTab}
          />
        </section>

        <section>
          <h2 className="mb-4 text-h3 font-display text-ink">Filter chips</h2>
          <div className="flex flex-wrap gap-2">
            <FilterChip label="Remote" active={activeFilter === 'remote'} onClick={() => setActiveFilter('remote')} />
            <FilterChip label="Hybrid" active={activeFilter === 'hybrid'} onClick={() => setActiveFilter('hybrid')} />
            <FilterChip label="On-site" active={activeFilter === 'onsite'} onClick={() => setActiveFilter('onsite')} />
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-h3 font-display text-ink">Data rows</h2>
          <Card padded={false} className="divide-y divide-border px-6">
            <DataRow label="FreshFit score" value="86" />
            <DataRow label="Compensation fit" value="Strong" />
            <DataRow label="Seniority fit" value="On target" />
          </Card>
        </section>

        <section>
          <h2 className="mb-4 text-h3 font-display text-ink">Empty, loading, and error states</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <EmptyState
              title="No applications yet"
              description="Submit a job and your strategist will follow up within one business day."
              action={<CTAButton>Submit a job</CTAButton>}
            />
            <div className="flex items-center justify-center rounded-2xl border border-border bg-surface-subtle p-12 text-sm text-ink-muted">
              Loading your Opportunity Engine…
            </div>
            <div className="rounded-2xl border border-error-700 bg-surface-subtle p-6 text-sm text-error-300">
              We couldn&apos;t refresh your FreshFit scores. Try again in a moment.
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-h3 font-display text-ink">Navigation states</h2>
          <nav className="flex gap-1 rounded-xl bg-surface-elevated p-1.5">
            <span className="rounded-lg bg-surface-card px-4 py-2 text-sm font-semibold text-ink">Dashboard</span>
            <span className="rounded-lg px-4 py-2 text-sm text-ink-muted hover:text-ink">Opportunity Engine</span>
            <span className="rounded-lg px-4 py-2 text-sm text-ink-muted hover:text-ink">Forward Profile</span>
          </nav>
        </section>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/pages/internal/DesignSystemShowcasePage.test.tsx`
Expected: PASS

- [ ] **Step 5: Register the route**

In `src/App.tsx`, add near the other page imports:

```tsx
import { DesignSystemShowcasePage } from '@/pages/internal/DesignSystemShowcasePage'
```

And immediately before the catch-all route (currently `<Route path="*" element={<Navigate to="/" replace />} />` at line 441):

```tsx
<Route path="/internal/design-system" element={<DesignSystemShowcasePage />} />
```

Do not add this path to `PublicLayout`'s `navigation` array or any sitemap — it stays unlinked by design.

- [ ] **Step 6: Full verification**

Run: `npx tsc --noEmit && npm test -- --run && npm run build`
Expected: all PASS. Then `npm run dev`, visit `/internal/design-system` at desktop width and at a 375px mobile width (browser dev tools), and confirm every section renders legibly with no light-mode leftovers. Screenshot both widths to `docs/superpowers/reviews/screenshots/subproject1-showcase-desktop.png` and `subproject1-showcase-mobile.png`.

- [ ] **Step 7: Commit**

```bash
git add src/pages/internal/DesignSystemShowcasePage.tsx src/pages/internal/DesignSystemShowcasePage.test.tsx src/App.tsx
git commit -m "feat(design-system): add internal design-system showcase route"
```

---

## Task 13: Migrate `MemberLayout.tsx` (worked example — establishes the pattern every later batch follows)

**Files:**
- Modify: `src/components/MemberLayout.tsx`
- Modify: `src/components/MemberLayout.test.tsx` (existing test file — update any assertions on literal classes, if present; otherwise no test changes needed since behavior is unchanged)

**Interfaces:** none — this task changes class names only, no prop/behavior changes, so no interface changes propagate to other tasks.

- [ ] **Step 1: Read the file and list every literal-neutral occurrence**

Run: `rg -n "bg-white|bg-neutral-|border-neutral-|text-neutral-|hover:bg-neutral-|hover:bg-white" src/components/MemberLayout.tsx`

For each match, apply the Semantic Role Reference table at the top of this plan. Also check for any `primary-*/success-*/warning-*/error-*` pairing that reads as light-tuned (e.g. `border-X-300 text-X-700`) and flip its direction per the same table's note.

- [ ] **Step 2: Apply the substitutions**

Edit `src/components/MemberLayout.tsx`, changing only `className` strings per the mapping — no JSX structure, prop, or logic changes. Where a literal class appears in a template-literal conditional (e.g. `active ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:bg-neutral-50'`), replace both branches consistently (e.g. `active ? 'bg-primary-600 text-ink' : 'text-ink-muted hover:bg-surface-hover'`).

- [ ] **Step 3: Run the existing test suite for this file**

Run: `npm test -- --run src/components/MemberLayout.test.tsx`
Expected: PASS unchanged (tests assert behavior/structure, not exact class strings, per existing conventions in this repo — if any test does assert a literal class string, update it to the new semantic class, not to a weakened assertion).

- [ ] **Step 4: Batch verification**

Run: `npx tsc --noEmit && npm test -- --run && npm run build`
Expected: all PASS.

- [ ] **Step 5: Visual check**

`npm run dev`, sign in, confirm the member sidebar/header renders on the dark surface tokens with legible text, at desktop and mobile widths. Screenshot to `docs/superpowers/reviews/screenshots/subproject1-memberlayout.png`.

- [ ] **Step 6: Commit**

```bash
git add src/components/MemberLayout.tsx
git commit -m "refactor(design-system): migrate MemberLayout to semantic tokens"
```

---

## Task 14: Migrate `StrategistLayout.tsx`; verify `PublicLayout.tsx`

**Files:**
- Modify: `src/components/StrategistLayout.tsx`
- Modify: `src/components/PublicLayout.tsx:74` (one intentional literal exception fix — inline hex on the admin-only footer link)

**Interfaces:** none.

- [ ] **Step 1–4: Repeat Task 13's exact process for `StrategistLayout.tsx`**

Run: `rg -n "bg-white|bg-neutral-|border-neutral-|text-neutral-|hover:bg-neutral-|hover:bg-white" src/components/StrategistLayout.tsx`, map each hit via the Semantic Role Reference table, edit, then run `npx tsc --noEmit && npm test -- --run && npm run build`.

- [ ] **Step 5: Fix the one literal exception in `PublicLayout.tsx`**

`PublicLayout.tsx` does not use Tailwind literal-neutral classes (confirmed — it uses the marketing CSS-class system already migrated in Task 2), but line 74 has one inline hardcoded hex style on the admin link:

```tsx
<Link to="/admin" style={{ fontSize: '.7rem', color: '#9aa6b4', opacity: .6 }}>Admin</Link>
```

`#9aa6b4` is close to the new `--ink-soft`/`--color-ink-muted` value — replace with the CSS variable so it inherits the token instead of a second hardcoded value:

```tsx
<Link to="/admin" style={{ fontSize: '.7rem', color: 'var(--ink-soft)', opacity: .6 }}>Admin</Link>
```

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit && npm test -- --run && npm run build`
Expected: all PASS.

- [ ] **Step 7: Visual check**

Sign in as a strategist, confirm `StrategistLayout` renders correctly on dark tokens at desktop and mobile widths. Screenshot to `docs/superpowers/reviews/screenshots/subproject1-strategistlayout.png`.

- [ ] **Step 8: Commit**

```bash
git add src/components/StrategistLayout.tsx src/components/PublicLayout.tsx
git commit -m "refactor(design-system): migrate StrategistLayout to semantic tokens; fix PublicLayout admin-link literal hex"
```

---

## Tasks 15–22: Shared component migration batches

Each task in this section is self-contained and executes these 7 steps against its own file list:

1. Run `rg -n "bg-white|bg-neutral-|border-neutral-|text-neutral-|hover:bg-neutral-|hover:bg-white" <each file in the task's list>`.
2. Map every hit to its replacement using the **Semantic Role Reference** table near the top of this plan (e.g. `bg-white` → `bg-surface-card`, `text-neutral-900` → `text-ink`). For any `primary-*/success-*/warning-*/error-*` pairing that looks light-tuned (dark text + light border, assuming a white background — e.g. `border-success-300 text-success-700`), flip it to a dark-tuned pairing (light text + mid-tone border — e.g. `border-success-600 text-success-300`), same as `FreshFitDetails.tsx` in Task 16.
3. Edit only `className` strings (including both branches of any conditional/ternary class expression) — no JSX structure, prop, or logic changes.
4. Run that batch's existing test file(s) if present (e.g. `npm test -- --run src/components/<File>.test.tsx`) and confirm they still pass unchanged; if a test asserts an exact literal class string, update the assertion to the new semantic class rather than weakening it.
5. Run `npx tsc --noEmit && npm test -- --run && npm run build` — all must pass.
6. Start `npm run dev`, sign in, and visually spot-check at least one file from the batch at desktop and mobile widths — confirm dark surfaces, legible text, no light-mode leftovers.
7. Commit with the message given for that task.

Only the file lists and commit messages differ per task below.

### Task 15: Core shared UI primitives batch

**Files:** `src/components/ui.tsx`, `src/components/Badges.tsx`, `src/components/ProfileCard.tsx`, `src/components/KeyValueCard.tsx`, `src/components/CircularProgress.tsx`, `src/components/LoadingScreen.tsx`, `src/components/AlternatingRow.tsx`, `src/components/WizardShell.tsx`

Commit: `git commit -m "refactor(design-system): migrate core shared UI components to semantic tokens"`

### Task 16: Preview cards & misc components batch

**Files:** `src/components/ChatPreviewCard.tsx`, `src/components/ChecklistPreviewCard.tsx`, `src/components/OpportunityPreviewCard.tsx`, `src/components/FridayReportCard.tsx`, `src/components/SearchReadinessWidget.tsx`, `src/components/ProfileEditForm.tsx`, `src/components/freshFit/FreshFitDetails.tsx`

Pay special attention in `FreshFitDetails.tsx` to the light-tuned tier badge pairings (`border-success-300 text-success-700` etc.) — flip per the accent-pairing note in the Semantic Role Reference.

Commit: `git commit -m "refactor(design-system): migrate preview cards and FreshFit details to semantic tokens"`

### Task 17: Forms & modals batch

**Files:** `src/components/AccountRestrictedPage.tsx`, `src/components/AddCalendarEventModal.tsx`, `src/components/FeatureEntitlements.tsx`, `src/components/SubmitJobModal.tsx`, `src/components/QuestionnaireFields.tsx`

Commit: `git commit -m "refactor(design-system): migrate forms and modals to semantic tokens"`

### Task 18: Forward DNA components batch

**Files:** `src/components/forwardDna/CareerGoalsCard.tsx`, `src/components/forwardDna/CareerScopeCard.tsx`, `src/components/forwardDna/CompassSummaryCard.tsx`, `src/components/forwardDna/CompletenessWidget.tsx`, `src/components/forwardDna/ResponsibilitiesCard.tsx`, `src/components/forwardDna/SkillEvidenceCard.tsx`

Commit: `git commit -m "refactor(design-system): migrate Forward DNA components to semantic tokens"`

### Task 19: Forward Score & Career Compass components batch

**Files:** `src/components/forwardScore/NextBestMoveCard.tsx`, `src/components/forwardScore/PillarCard.tsx`, `src/components/careerCompass/ArchetypeQuestionScreen.tsx`, `src/components/careerCompass/ReadinessQuestionScreen.tsx`

Commit: `git commit -m "refactor(design-system): migrate Forward Score and Career Compass components to semantic tokens"`

### Task 20: Onboarding components batch 1

**Files:** `src/components/onboarding/OnboardingWelcome.tsx`, `src/components/onboarding/OnboardingHowItWorks.tsx`, `src/components/onboarding/OnboardingQuestionnaire.tsx`, `src/components/onboarding/OnboardingDocumentUpload.tsx`

Commit: `git commit -m "refactor(design-system): migrate onboarding components (part 1) to semantic tokens"`

### Task 21: Onboarding components batch 2

**Files:** `src/components/onboarding/OnboardingMeetStrategist.tsx`, `src/components/onboarding/OnboardingDashboardIntro.tsx`, `src/components/onboarding/OnboardingConfirmation.tsx`, `src/components/onboarding/OnboardingCelebration.tsx`

Commit: `git commit -m "refactor(design-system): migrate onboarding components (part 2) to semantic tokens"`

### Task 22: Component migration wrap-up verification

Run the full sequence once more across everything migrated in Tasks 13–21: `npx tsc --noEmit && npm test -- --run && npm run build`. Visit `/dashboard`, `/forward-dna`, `/career-compass/assessment`, and `/onboarding` (sign in first) and confirm no light-mode leftovers remain among shared components. Screenshot to `docs/superpowers/reviews/screenshots/subproject1-components-complete.png`. Commit any last cleanup: `git commit -m "refactor(design-system): shared component migration verification pass"` (only if changes were needed; otherwise skip the commit).

---

## Tasks 23–32: Page migration batches

Each task in this section is self-contained and executes the identical 7 steps listed at the start of the "Tasks 15–22" section above, against its own file list. Only the file lists and commit messages differ per task below.

### Task 23: Dashboard & onboarding flow pages

**Files:** `src/pages/DashboardPage.tsx`, `src/pages/OnboardingPage.tsx`, `src/pages/ForwardDnaPage.tsx`

Commit: `git commit -m "refactor(design-system): migrate dashboard and onboarding pages to semantic tokens"`

### Task 24: Career/profile pages

**Files:** `src/pages/CareerProfilePage.tsx`, `src/pages/CareerSuccessPage.tsx`, `src/pages/AchievementVaultPage.tsx`, `src/pages/ActivityFeedPage.tsx`, `src/pages/TimelinePage.tsx`

Commit: `git commit -m "refactor(design-system): migrate career/profile pages to semantic tokens"`

### Task 25: Opportunity/application pages

**Files:** `src/pages/OpportunityEnginePage.tsx`, `src/pages/MemberOpportunitiesPage.tsx`, `src/pages/MemberApplicationsPage.tsx`, `src/pages/WhyWeAppliedPage.tsx`

Pay special attention to `OpportunityEnginePage.tsx`'s FreshFit tier badge rendering, same as Task 16.

Commit: `git commit -m "refactor(design-system): migrate Opportunity Engine and applications pages to semantic tokens"`

### Task 26: Communication/scheduling pages

**Files:** `src/pages/CalendarPage.tsx`, `src/pages/InterviewsPage.tsx`, `src/pages/MessagesPage.tsx`, `src/pages/MockInterviewPage.tsx`, `src/pages/NotificationsPage.tsx`

Commit: `git commit -m "refactor(design-system): migrate communication and scheduling pages to semantic tokens"`

### Task 27: Account/billing/settings pages

**Files:** `src/pages/CheckoutPage.tsx`, `src/pages/MembershipPage.tsx`, `src/pages/CommunicationPreferencesPage.tsx`, `src/pages/FoundingMemberPage.tsx`

Commit: `git commit -m "refactor(design-system): migrate account and billing pages to semantic tokens"`

### Task 28: Product tool pages

**Files:** `src/pages/FridayReportsPage.tsx`, `src/pages/LinkedInOptimizerPage.tsx`, `src/pages/RoadmapPage.tsx`, `src/pages/ToolsPage.tsx`

Commit: `git commit -m "refactor(design-system): migrate product tool pages to semantic tokens"`

### Task 29: Public marketing pages (token substitution only — no redesign)

**Files:** `src/pages/LandingPage.tsx`, `src/pages/HowItWorksPage.tsx`, `src/pages/PricingPage.tsx`

These pages primarily use the marketing CSS-class system already handled in Task 2; this batch only catches any literal Tailwind neutral classes mixed into their JSX. Do not touch layout, copy, or the marketing CSS classes themselves.

Commit: `git commit -m "refactor(design-system): migrate literal-neutral usages on public marketing pages to semantic tokens"`

### Task 30: Strategist admin pages batch 1

**Files:** `src/pages/strategist/AdminDashboardPage.tsx`, `src/pages/strategist/AdminMemberDetailPage.tsx`, `src/pages/strategist/AdminMembersPage.tsx`, `src/pages/strategist/AdminReportReviewPage.tsx`, `src/pages/strategist/FeatureEntitlementsPage.tsx`

Commit: `git commit -m "refactor(design-system): migrate strategist admin pages (part 1) to semantic tokens"`

### Task 31: Strategist content & dashboard pages batch

**Files:** `src/pages/strategist/BlogManagementPage.tsx`, `src/pages/strategist/BlogPostEditorPage.tsx`, `src/pages/strategist/StrategistDashboardPage.tsx`, `src/pages/strategist/StrategistFridayReportsPage.tsx`

Commit: `git commit -m "refactor(design-system): migrate strategist content and dashboard pages to semantic tokens"`

### Task 32: Strategist member/opportunity pages batch

**Files:** `src/pages/strategist/StrategistApplicationsPage.tsx`, `src/pages/strategist/StrategistMembersPage.tsx`, `src/pages/strategist/StrategistMemberWorkspacePage.tsx`, `src/pages/strategist/StrategistOpportunitiesPage.tsx`, `src/pages/strategist/StrategistOpportunityEnginePage.tsx`

`StrategistMemberWorkspacePage.tsx` is large (49 KB) — if it contains a very high count of literal-neutral occurrences, it is fine for this single task to take longer than others; do not split it further just to keep task count uniform.

Commit: `git commit -m "refactor(design-system): migrate strategist member and opportunity pages to semantic tokens"`

---

## Task 33: Final verification, screenshots, and deliverables summary

**Files:** none created/modified except a new summary doc.

- [ ] **Step 1: Full fresh verification**

Run in order and record output:
1. `npx tsc --noEmit`
2. `npm test -- --run`
3. `npm run build`

All three must pass with zero failures.

- [ ] **Step 2: Representative visual sweep**

At both desktop (~1440px) and mobile (375px) widths, screenshot: `/` (marketing home), `/pricing`, `/about`, `/faq` (public), and signed-in `/dashboard`, `/opportunity-engine`, `/forward-dna`, `/career-compass/assessment` (product), plus `/internal/design-system`. Save all to `docs/superpowers/reviews/screenshots/subproject1-final/`. Confirm no page shows a half-dark/half-light mix, no illegible text-on-background pairing, and no leftover literal-white flashes.

- [ ] **Step 3: Compile the deliverables summary**

Create `docs/superpowers/reviews/2026-09-05-redesign-subproject1-design-system-foundation-review.md` containing:
- The final semantic token map (copy the tables from Task 1/Task 2, noting any hex value adjusted during this task's visual QA and why).
- The full list of files migrated (Tasks 13–32's file lists, concatenated).
- The list of intentional literal-color exceptions with their reasons (`.contrast-muted`, `.blog-filter-pill.active` from Task 2, plus any found during batch execution).
- Link to the showcase route and the screenshot directory.
- Test/typecheck/build results from Step 1.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/reviews/2026-09-05-redesign-subproject1-design-system-foundation-review.md docs/superpowers/reviews/screenshots/
git commit -m "docs: Sub-Project 1 design system foundation — final review and deliverables summary"
git push origin main
```

- [ ] **Step 5: Stop**

Do not begin Sub-Project 2 (Homepage) or any other sub-project. Present the review document and screenshots to the owner and wait for explicit approval, per the stop-gate in the locked spec.
