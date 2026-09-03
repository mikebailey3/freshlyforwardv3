# Homepage North Star Fidelity Pass 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `/` visually in line with the North Star reference image on the 7 approved
fronts (header, hero, Powerful Tools background, Human Support layout, Why FreshlyForward
containment, FAQ density, typography), scoped to homepage-only changes with zero behavior/route/
data changes.

**Architecture:** Every change is additive or homepage-scoped -- no shared component's default
behavior changes for any other page. New optional props/classes default to today's exact current
behavior everywhere except `/`.

**Tech Stack:** React + TypeScript, Tailwind utility classes + a small hand-written `index.css`
for shared primitives (`.site-header`, `.faq-list`, etc.), Vitest + Testing Library, Supabase
(untouched by this plan).

**Spec:** `docs/superpowers/specs/2026-09-03-homepage-north-star-fidelity-design.md` (see
Section 1a for the exact scope of this pass -- Career Vault and Pricing are explicitly excluded).

## Global Constraints

- No changes to routes, authentication, Supabase queries, plan gating, Opportunity Engine
  behavior, FreshFit behavior, or real pricing data flow.
- Do not touch `FlagshipVaultPreview.tsx` or any Career Vault content/behavior.
- Do not touch `PricingTeaser.tsx`, `PricingPage.tsx`, or any pricing logic.
- Do not modify the shared `h1, h2, h3 { font-family: 'Fraunces' }` global rule or the
  `--font-display` token's meaning -- ~15 other already-migrated pages depend on it.
- Do not modify `.faq-list` or `.site-header` base rules in a way that changes any other page's
  rendering. All homepage-only visual changes are additive classes/props, never edits to shared
  selectors' existing declarations.
- Every task ends with `npx vitest run <its own test file>` passing before moving on.

---

### Task 1: Homepage-only dark header variant

**Files:**
- Modify: `src/components/PublicLayout.tsx` (the `SiteHeader` function, ~line 97)
- Modify: `src/App.tsx` (the `<SiteHeader />` call, ~line 92)
- Modify: `src/index.css` (add new rules, do not edit existing `.site-header`/`.header-inner`/
  `.nav-login` declarations)
- Test: `src/components/PublicLayout.test.tsx`

**Interfaces:**
- Produces: `SiteHeader({ variant = 'light' }: { variant?: 'light' | 'dark' })` -- default
  preserves every existing test/behavior exactly.

- [ ] **Step 1: Write the failing test**

Add to `src/components/PublicLayout.test.tsx`:

```tsx
describe('SiteHeader - variant prop', () => {
  it('defaults to the light variant (no dark class) when variant is omitted', () => {
    render(
      <MemoryRouter>
        <SiteHeader />
      </MemoryRouter>
    )
    expect(document.querySelector('.site-header')).not.toHaveClass('site-header-dark')
  })

  it('applies the dark variant class when variant="dark" is passed', () => {
    render(
      <MemoryRouter>
        <SiteHeader variant="dark" />
      </MemoryRouter>
    )
    expect(document.querySelector('.site-header')).toHaveClass('site-header-dark')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/PublicLayout.test.tsx`
Expected: FAIL -- `site-header-dark` never appears because `SiteHeader` takes no props yet.

- [ ] **Step 3: Implement the variant prop**

In `src/components/PublicLayout.tsx`, change the `SiteHeader` signature and root element:

```tsx
export function SiteHeader({ variant = 'light' }: { variant?: 'light' | 'dark' }) {
  const [open, setOpen] = useState(false)
  const { user, signOut } = useAuth()

  return (
    <header className={`site-header ${variant === 'dark' ? 'site-header-dark' : ''}`}>
```

(Leave everything else in the function body untouched -- same nav data, same links, same auth
branches.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/PublicLayout.test.tsx`
Expected: PASS (all existing tests in this file plus the 2 new ones).

- [ ] **Step 5: Add the dark-variant CSS**

Append to `src/index.css` (do not edit the existing `.site-header`/`.header-inner` rules above
them):

```css
/* Homepage-only dark header variant (North Star fidelity pass 2). Additive
   only -- .site-header's base rule above still governs every other public
   page untouched. Absolute-positioned over the hero so there's no visible
   seam; the hero section below must have position:relative for this to
   overlay correctly (Task 3 adds that). */
.site-header-dark { position: absolute; top: 0; left: 0; right: 0; background: transparent; border-bottom: none; backdrop-filter: none; z-index: 40; }
.site-header-dark .logo img { filter: brightness(0) invert(1); }
.site-header-dark .site-header nav > a,
.site-header-dark .nav-dropdown-trigger { color: white; }
.site-header-dark .site-header nav > a::after { background: #7ee4b6; }
.site-header-dark .nav-login { border-color: #7ee4b6; color: #7ee4b6; }
```

- [ ] **Step 6: Wire the variant in App.tsx**

In `src/App.tsx`, change:

```tsx
{isPublicRoute && <SiteHeader />}
```

to:

```tsx
{isPublicRoute && <SiteHeader variant={location.pathname === '/' ? 'dark' : 'light'} />}
```

- [ ] **Step 7: Run the full PublicLayout test file again**

Run: `npx vitest run src/components/PublicLayout.test.tsx`
Expected: PASS (confirms App.tsx's import/usage still type-checks with the new prop).

- [ ] **Step 8: Commit**

```bash
git add src/components/PublicLayout.tsx src/components/PublicLayout.test.tsx src/App.tsx src/index.css
git commit -m "Homepage-only dark header variant (North Star fidelity pass 2, Task 1)"
```

---

### Task 2: Homepage-only typography correction (sans-serif headline)

**Files:**
- Modify: `src/pages/LandingPage.tsx` (hero `<h1>`, ~line 179)
- Modify: `src/index.css` (add one new utility, do not touch the global `h1, h2, h3` rule)

**Interfaces:**
- Produces: `.font-hero-sans` utility class, homepage-only.

- [ ] **Step 1: Add the scoped utility to index.css**

```css
/* Homepage-only: the North Star hero headline is a bold sans-serif, not
   the site-wide Concierge Editorial serif (Fraunces) used by h1/h2/h3
   everywhere else. Scoped to this one class so the other ~15 already-
   migrated pages are completely unaffected. */
.font-hero-sans { font-family: 'Manrope', sans-serif; }
```

- [ ] **Step 2: Apply it to the hero h1 only**

In `src/pages/LandingPage.tsx`, change:

```tsx
<h1 className="font-display text-4xl font-semibold leading-[1.1] sm:text-5xl lg:text-5xl xl:text-6xl">
```

to:

```tsx
<h1 className="font-hero-sans text-4xl font-bold leading-[1.1] sm:text-5xl lg:text-5xl xl:text-6xl">
```

(`font-bold` instead of `font-semibold` -- Manrope needs a heavier weight than Fraunces did to
read with the same visual force, matching the reference's heavier headline weight.)

- [ ] **Step 3: Run the focused test and build check**

Run: `npx vitest run src/pages/LandingPage.test.tsx`
Expected: PASS (no test asserts on font family/class, so this is a pure regression check).

- [ ] **Step 4: Commit**

```bash
git add src/pages/LandingPage.tsx src/index.css
git commit -m "Homepage-only sans-serif hero headline, correcting typography drift from North Star (Task 2)"
```

---

### Task 3: Hero rebuild -- unboxed centerpiece, integrated path, tighter clustering

**Files:**
- Modify: `src/components/homepage/HeroFreshFitCenterpiece.tsx`
- Modify: `src/components/homepage/HeroCareerPath.tsx`
- Modify: `src/pages/LandingPage.tsx` (hero graphic column, ~lines 222-268)
- Test: `src/pages/LandingPage.test.tsx` (existing hero tests must keep passing unmodified)

**Interfaces:**
- `HeroFreshFitCenterpiece({ size })` keeps its exact existing prop signature -- only its internal
  markup/classes change.
- `HeroCareerPath({ className, simplified })` keeps its exact existing prop signature.

- [ ] **Step 1: Un-box the FreshFit centerpiece**

In `src/components/homepage/HeroFreshFitCenterpiece.tsx`, replace the returned JSX:

```tsx
return (
  <div className="relative flex flex-col items-center gap-3">
    {/* Soft radial glow behind the ring instead of a boxed card -- matches
        the North Star's floating centerpiece treatment. */}
    <div
      className="absolute left-1/2 top-1/2 -z-10 h-[140%] w-[140%] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-60 blur-3xl"
      style={{ background: 'radial-gradient(circle, rgba(126,228,182,0.35) 0%, rgba(10,26,45,0) 70%)' }}
      aria-hidden="true"
    />
    <p className={`font-mono font-semibold uppercase tracking-wide text-[#7ee4b6] ${compact ? 'text-[10px]' : 'text-[11px]'}`}>
      FreshFit Score
    </p>
    <CircularProgress
      value={SAMPLE_SCORE}
      size={size}
      strokeWidth={compact ? 9 : 12}
      suffix=""
      label={tierLabel}
      tierThresholds={{ success: DEFAULT_PRESENTATION_TIERS.highest, warning: DEFAULT_PRESENTATION_TIERS.stronger }}
    />
    <p className={`text-center text-[#bac8d6] ${compact ? 'max-w-[160px] text-[11px]' : 'max-w-[220px] text-xs'}`}>
      A directional snapshot of how well a role fits you right now -- illustrative sample, not live data.
    </p>
  </div>
)
```

(Removes the `bg-[var(--navy-soft)] shadow-[var(--shadow)] p-8/p-5` wrapper entirely; keeps every
prop, every piece of text, and the real `CircularProgress` component unchanged.)

- [ ] **Step 2: Extend the path past the ring with a forward motif**

In `src/components/homepage/HeroCareerPath.tsx`, add a second path segment and an arrowhead after
the existing destination-node circles (keep everything above unchanged -- gradient, glow filter,
first path, destination node, human figure):

```tsx
{/* Continuation segment: the path keeps going past the FreshFit
    destination node toward an arrow, echoing the "forward momentum"
    motif used elsewhere on the page (e.g. the Human Support section's
    arrow graphic). Purely decorative -- no new claims. */}
<path
  d={simplified ? 'M 190 290 C 210 270, 230 255, 250 235' : 'M 205 270 C 230 248, 250 230, 270 205'}
  stroke={`url(#${gradientId})`}
  strokeWidth="4"
  strokeLinecap="round"
  opacity="0.8"
/>
<path
  d={simplified ? 'M 244 246 L 250 235 L 258 244' : 'M 264 219 L 270 205 L 278 217'}
  stroke="#7ee4b6"
  strokeWidth="3"
  strokeLinecap="round"
  strokeLinejoin="round"
  fill="none"
/>
```

- [ ] **Step 3: Integrate the human figure onto the path (not a fixed offset)**

In the same file, the figure is currently drawn via a fixed `translate(${start.x - 15}, ${start.y - 48})`
sitting at the path's start. Move it to sit mid-path so it reads as "walking the journey", by
changing that transform to use a point partway along the curve:

```tsx
{/* Human figure -- now placed partway up the path (not just at the
    starting node) so it reads as walking the journey rather than
    standing beside it. Same small/supporting scale as before. */}
<g transform={`translate(${(start.x + end.x) / 2 - 15}, ${(start.y + end.y) / 2 - 48})`} opacity="0.9">
  <circle cx="15" cy="10" r="9" fill="#d7e3ee" />
  <path d="M 3 48 C 3 24, 6 12, 15 12 C 24 12, 27 24, 27 48 Z" fill="#d7e3ee" />
</g>
```

(Delete the old `<g transform=... start.x - 15, start.y - 48>` block -- this replaces it, doesn't
add a second figure.)

- [ ] **Step 4: Tighten floating-card clustering in LandingPage.tsx**

In `src/pages/LandingPage.tsx`, the 7 `<HeroFloatingCard>` instances currently use spread-out
positions (`right-0 top-2`, `left-0 top-32`, `bottom-24 right-4`, `left-6 top-0`, `right-0 top-56`,
`left-10 bottom-10`, `right-16 bottom-0`). Tighten each toward the centerpiece by roughly a third,
keeping every card's content/order/animation-delay identical -- only the position classes change:

```tsx
<HeroFloatingCard className="reveal right-4 top-6" style={{ animationDelay: '.35s' }}>
  {/* Top Opportunity -- unchanged content */}
</HeroFloatingCard>
<HeroFloatingCard className="reveal left-6 top-28 hidden lg:block" style={{ animationDelay: '.5s' }}>
  {/* Search Readiness -- unchanged content */}
</HeroFloatingCard>
<HeroFloatingCard className="reveal bottom-20 right-10 hidden lg:block" style={{ animationDelay: '.65s' }}>
  {/* Applications -- unchanged content */}
</HeroFloatingCard>
<HeroFloatingCard className="reveal left-14 top-4 hidden lg:block" style={{ animationDelay: '.4s' }}>
  {/* Career Vault -- unchanged content */}
</HeroFloatingCard>
<HeroFloatingCard className="reveal right-6 top-48 hidden lg:block" style={{ animationDelay: '.55s' }}>
  {/* Skill Gap -- unchanged content */}
</HeroFloatingCard>
<HeroFloatingCard className="reveal left-16 bottom-16 hidden lg:block" style={{ animationDelay: '.7s' }}>
  {/* Goal Progress -- unchanged content */}
</HeroFloatingCard>
<HeroFloatingCard className="reveal right-20 bottom-4 hidden lg:flex lg:items-center lg:gap-2" style={{ animationDelay: '.8s' }}>
  {/* Strategist Support -- unchanged content */}
</HeroFloatingCard>
```

- [ ] **Step 5: Run the focused hero tests**

Run: `npx vitest run src/pages/LandingPage.test.tsx`
Expected: PASS -- no test asserts on exact position classes or the internal centerpiece markup, so
this is a pure regression check confirming nothing else broke.

- [ ] **Step 6: Commit**

```bash
git add src/components/homepage/HeroFreshFitCenterpiece.tsx src/components/homepage/HeroCareerPath.tsx src/pages/LandingPage.tsx
git commit -m "Hero rebuild: unboxed FreshFit ring, path continues to an arrow, integrated figure, tighter card clustering (Task 3)"
```

---

### Task 4: "Powerful tools" -- light outer section, dark cards only

**Files:**
- Modify: `src/pages/LandingPage.tsx` (flagship section, ~line 314)

**Interfaces:** none new -- pure class changes on the existing `<section>` and card wrappers.

- [ ] **Step 1: Change the outer section background**

Change:

```tsx
<section className="bg-[var(--navy)] py-20 text-white" aria-labelledby="flagship-title">
```

to:

```tsx
<section className="bg-[var(--cream)] py-20" aria-labelledby="flagship-title">
```

- [ ] **Step 2: Fix the SectionHeading and card text colors for the new light background**

The `SectionHeading` inside this section and its `copy` prop currently rely on inherited
`text-white` from the section. Check `src/components/ui.tsx`'s `SectionHeading` -- if it takes a
`light`/`dark` variant already (it does, used elsewhere with `centered` etc.), do not add a new
prop; instead wrap the heading call so it renders with default (dark-on-light) styling by simply
removing reliance on inherited white text -- `SectionHeading` already defaults to dark text when
no override is supplied, so no code change is needed there. Individual card content
(`flagshipFeatures`/`supportingCapabilities` cards) keeps `text-white`/`text-[#bac8d6]` etc.
unchanged, since those live inside the still-dark-navy card `<div>`/`<Link>` wrappers
(`bg-[var(--navy-soft)]`) which are untouched by this task -- only the outer `<section>` background
changes.

- [ ] **Step 3: Confirm Career Vault card is untouched**

Run: `grep -n "FlagshipVaultPreview" src/pages/LandingPage.tsx`
Expected: same single usage as before this task, no diff to that line or to
`FlagshipVaultPreview.tsx` itself.

- [ ] **Step 4: Run the focused test**

Run: `npx vitest run src/pages/LandingPage.test.tsx`
Expected: PASS, including the existing "labels Career Vault as Coming Soon" test unmodified.

- [ ] **Step 5: Commit**

```bash
git add src/pages/LandingPage.tsx
git commit -m "Powerful Tools: light/cream outer section, dark cards only, matching North Star (Task 4)"
```

---

### Task 5: Human Support -- text left, image right, truthful overlay card

**Files:**
- Modify: `src/pages/LandingPage.tsx` (Human Support section, ~line 373)

**Interfaces:** none new.

- [ ] **Step 1: Swap column order and add the overlay card**

Replace the section's inner markup:

```tsx
<section className="bg-[var(--cream)] py-20" aria-labelledby="human-support-title">
  <div className="shell grid items-center gap-12 lg:grid-cols-2">
    <div>
      <SectionHeading
        title="Technology gets you the data. A person helps you use it."
        copy="Every FreshlyForward plan includes real human support -- not a chatbot, not a template."
        id="human-support-title"
      />
      <ul className="mt-8 space-y-5">
        {humanSupportBullets.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white text-[color:var(--color-primary-600)] shadow-[var(--shadow)]">
              <Icon size={18} aria-hidden="true" />
            </span>
            <p className="text-neutral-700">{text}</p>
          </li>
        ))}
      </ul>
      <div className="mt-8">
        <LinkButton to="/why-freshlyforward" variant="secondary">
          See How Human Support Works <ArrowRight size={18} />
        </LinkButton>
      </div>
    </div>
    <div className="relative">
      <img
        src="/images/headshot.png?v=2"
        alt="Mike Bailey, founder of FreshlyForward"
        className="w-full max-w-md rounded-[var(--radius)] object-cover shadow-[var(--shadow)] lg:ml-auto"
      />
      {/* Truthful overlay card in place of the North Star's fabricated
          testimonial -- same geometry/overlap treatment, honest content. */}
      <div className="absolute -bottom-6 -left-6 max-w-[240px] rounded-[var(--radius)] bg-white p-5 shadow-xl">
        <p className="text-sm font-semibold text-[var(--navy)]">Human strategist support</p>
        <p className="mt-1.5 text-xs leading-relaxed text-neutral-600">
          A real person -- not a chatbot -- available whenever you need direction.
        </p>
      </div>
    </div>
  </div>
</section>
```

(The order is now text-first/image-second in source, and since this is a plain 2-column grid with
no `order-*` classes, that source order is also the visual left-to-right order -- text left, image
right, matching the North Star.)

- [ ] **Step 2: Run the focused test**

Run: `npx vitest run src/pages/LandingPage.test.tsx`
Expected: PASS, including the existing "never shows a testimonial-shaped quote attributed to a
named person" test -- the new overlay card has no name/quote/rating, only a capability label.

- [ ] **Step 3: Commit**

```bash
git add src/pages/LandingPage.tsx
git commit -m "Human Support: text-left/image-right layout with truthful overlay card, matching North Star geometry (Task 5)"
```

---

### Task 6: "Why FreshlyForward?" -- inset rounded panel, not full-bleed

**Files:**
- Modify: `src/pages/LandingPage.tsx` (Why FreshlyForward section, ~line 424)

**Interfaces:** none new.

- [ ] **Step 1: Wrap the navy content in an inset panel instead of a full-bleed section**

Change:

```tsx
<section className="bg-[var(--navy)] py-20 text-white" aria-labelledby="why-title">
  <div className="shell">
```

to:

```tsx
<section className="bg-[var(--cream)] py-20" aria-labelledby="why-title">
  <div className="shell">
    <div className="rounded-[calc(var(--radius)*1.5)] bg-[var(--navy)] px-6 py-14 text-white sm:px-10">
```

At the tail end of this same section, change:

```tsx
            >
              VS
            </span>
          </div>
        </div>
      </section>
```

to:

```tsx
            >
              VS
            </span>
          </div>
          </div>
        </div>
      </section>
```

(One extra closing `</div>` added, for the new navy-panel wrapper opened in Step 1. Final nesting:
`<section (cream)><div class="shell"><div class="rounded navy panel">...everything...</div></div></section>`.)

- [ ] **Step 2: Run the focused test**

Run: `npx vitest run src/pages/LandingPage.test.tsx`
Expected: PASS -- no test asserts on this section's DOM nesting depth, only text content, which is
unchanged.

- [ ] **Step 3: Commit**

```bash
git add src/pages/LandingPage.tsx
git commit -m "Why FreshlyForward: inset rounded navy panel on a light page background instead of full-bleed (Task 6)"
```

---

### Task 7: FAQ -- homepage-only density tightening (stays light, no structural change)

**Files:**
- Modify: `src/pages/LandingPage.tsx` (FAQ section, ~line 481)
- Modify: `src/index.css` (add a new scoped modifier, do not edit the shared `.faq-list` rules
  that `FaqPage.tsx` also depends on)

**Interfaces:** none new -- additive CSS class only.

- [ ] **Step 1: Add a homepage-only density modifier**

Append to `src/index.css`:

```css
/* Homepage-only FAQ density tightening. Scoped under .home-faq so
   FaqPage.tsx's full accordion (which shares the base .faq-list rules)
   is completely unaffected. */
.home-faq .faq-list summary { padding: 14px 4px; }
.home-faq .faq-list details p { padding: 0 24px 14px 40px; }
```

- [ ] **Step 2: Apply the wrapper class**

Change:

```tsx
<section className="faq-list shell" aria-labelledby="faq-title">
```

to:

```tsx
<section className="home-faq faq-list shell" aria-labelledby="faq-title">
```

- [ ] **Step 3: Run the focused test**

Run: `npx vitest run src/pages/LandingPage.test.tsx`
Expected: PASS.

- [ ] **Step 4: Confirm FaqPage is untouched**

Run: `npx vitest run src/pages/FaqPage.test.tsx` (if it exists) or manually confirm
`FaqPage.tsx` never uses the `home-faq` class.
Expected: PASS / no usage found.

- [ ] **Step 5: Commit**

```bash
git add src/pages/LandingPage.tsx src/index.css
git commit -m "FAQ: homepage-only density tightening, FaqPage.tsx unaffected (Task 7)"
```

---

### Task 8: Verification pass

**Files:** none (verification only).

- [ ] **Step 1: Run every focused test file touched by this plan**

Run:
```bash
npx vitest run src/components/PublicLayout.test.tsx src/pages/LandingPage.test.tsx
```
Expected: all PASS.

- [ ] **Step 2: Run the full suite**

Run: `npx vitest run --exclude "**/.worktrees/**"`
Expected: every test file passes (359+ tests, matching or exceeding the last known-good count).

- [ ] **Step 3: Run the production build**

Run: `npm run build`
Expected: clean build, no new errors (existing chunk-size warning is expected/pre-existing).

- [ ] **Step 4: Capture fresh screenshots**

Use the existing `visual_review_capture.py` helper (or equivalent Playwright script) to capture
`/` at desktop, tablet, and mobile widths with animations disabled, same convention as every prior
screenshot round in this project.

- [ ] **Step 5: Build the North Star vs. implementation side-by-side**

Compose a single comparison image (reference image alongside the new desktop screenshot) using
PIL, same technique used earlier in this session for the section-boundary crops.

- [ ] **Step 6: Second visual-difference audit**

Compare the new screenshots against the reference exactly as the Phase 1 audit did (edge-pixel
background-band sampling for geometry/section-height, plus visual inspection for spacing,
typography, colors, card sizing, composition, graphical treatment). Write up specific remaining
mismatches, if any -- do not report completion solely because tests/build passed.

- [ ] **Step 7: Fix any material mismatches found, then repeat Steps 4-6**

If the second audit finds material mismatches, fix them and re-capture/re-audit before reporting
completion. A single implementation pass is not treated as sufficient on its own.

- [ ] **Step 8: Final commit (if any fixes were made in Step 7)**

```bash
git add -A
git commit -m "Address remaining mismatches from second visual-difference audit (Task 8)"
git push origin homepage-redesign-phase1
```

If no fixes were needed, push whatever is pending from Tasks 1-7 instead:

```bash
git push origin homepage-redesign-phase1
```

Do not merge into `main`.
