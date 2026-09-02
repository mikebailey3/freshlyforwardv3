# Fix Report: AuthContext.tsx `refreshProfile` render-loop

Branch: `forwardos-home-forward-score` (unchanged, no merge performed)
Scope: `src/context/AuthContext.tsx` only, plus one new regression test file.

## Root cause (confirmed, not assumed)

I read `AuthContext.tsx` end to end and `DashboardPage.tsx`'s consuming
effect before touching anything. The brief's hypothesis is **confirmed
exactly**, with one clarification nailed down empirically:

1. `refreshProfile` was a plain `const refreshProfile = async () => {...}`
   defined fresh in `AuthProvider`'s function body -- a brand-new function
   reference on **every** `AuthProvider` render, not just renders where
   `user` changes.
2. `DashboardPage.tsx` has `useEffect(() => { ... await refreshProfile()
   ... }, [user, refreshProfile])` (line 112) -- confirmed via `grep`, and
   the same shape exists in `CareerProfilePage.tsx`. **Correction (added
   after independent re-review by the code-reviewer and Mike): this is
   NOT true of `ForwardDnaPage.tsx` or `OnboardingPage.tsx`.** In both of
   those files, `refreshProfile` is referenced only inside a
   `useCallback`-wrapped button click handler (`handleSaveTargets` in
   `ForwardDnaPage.tsx`, `handleNext` in `OnboardingPage.tsx`) -- never
   inside a `useEffect`. Neither page auto-fires `refreshProfile` on
   render, so neither ever exhibited the self-sustaining loop. Only
   `DashboardPage.tsx` and `CareerProfilePage.tsx` have a `useEffect`
   whose own dependency array includes `refreshProfile` and which also
   calls `refreshProfile()` inside itself -- those two are the only
   pages that ever had the real runaway-fetch loop. See the corrected
   "Consumer call sites" section below for the full breakdown.
3. `fetchProfile` (called by `refreshProfile`) unconditionally calls
   `setProfile(data as MemberProfile | null)` on every successful fetch,
   where `data` is a fresh network-deserialized object every time --
   never referentially equal to the previous value.
4. `setProfile(...)` re-renders `AuthProvider` -> a new `refreshProfile`
   closure is created -> the context `value` object (also recreated every
   render, no `useMemo`) is a new reference -> any consumer effect keyed
   on `[user, refreshProfile]` sees `refreshProfile` change identity ->
   re-fires -> calls `refreshProfile()` again -> loop, self-sustaining
   forever with zero external trigger needed.

**On `user` stability (the thing that determines whether memoizing
`refreshProfile` alone is sufficient):** I verified `setUser` is called
in exactly three places -- the one-time mount effect (`getSession()`
resolution), the `onAuthStateChange` listener callback (which only fires
on real Supabase auth events, not on React re-renders), and `signIn`.
**Never** inside `fetchProfile`/`refreshProfile`. So once the initial
session/user is established, `user`'s reference is stable across the
loop -- it is `profile`/`role` (via `fetchProfile`) that are unstable,
and it is `refreshProfile`'s own *function identity* (not `user`) that
was the unstable value driving consumer effects to re-fire. This
confirms memoizing `refreshProfile` (and the `fetchProfile` it calls) on
`[user, fetchProfile]` / `[]` respectively is sufficient -- no need to
touch `user`/`setUser` at all, and no need for a `useMemo` around the
whole context `value` object (verified separately below).

The brief's hypothesis was right on every point; nothing was found that
contradicted it.

## Files changed

- `src/context/AuthContext.tsx` -- the only production file touched.
- `src/context/AuthContext.regressionLoop.test.tsx` -- new regression
  test (this file previously had zero test coverage, confirmed by
  absence in the repo before this change).

No consumer page (`DashboardPage.tsx`, `CareerProfilePage.tsx`,
`ForwardDnaPage.tsx`, `OnboardingPage.tsx`, `MembershipPage.tsx`) was
touched, per the brief's binding constraint.

## The exact fix

Two small, targeted `useCallback` wraps, nothing else:

1. `fetchProfile` is now `useCallback(async (userId, userMetadata) => {
   ... }, [])`. Justified empty deps: it only calls stable `useState`
   setters (`setRole`, `setProfile`) and the module-level `supabase`
   client -- it closes over no reactive value, so `[]` is correct, not a
   lint-suppressing lie. This gives it a permanently stable identity.
2. `refreshProfile` is now `useCallback(async () => { if (user) { await
   fetchProfile(user.id, user) } }, [user, fetchProfile])`. Since `user`
   is stable (see above) and `fetchProfile` is now permanently stable,
   `refreshProfile`'s identity is stable across the entire
   `setProfile`-driven re-render loop, so consumer effects keyed on
   `[user, refreshProfile]` no longer see a changing dependency and stop
   re-firing.

No `useMemo` was added around the context `value` object -- not
necessary to fix the reported loop (the loop was driven purely by
`refreshProfile`'s identity, not by other consumers of `session`/`role`/
etc. depending on the whole value object), and the brief said not to add
it reflexively. `signIn`/`signUp`/`signOut`/the auth-state-change effect
were not touched. Behavior is unchanged: `refreshProfile()` still always
re-fetches and calls `setProfile` every time it's invoked -- this is a
referential-stability fix only, not a caching/skip-fetch fix.

## Before/after `member_profiles` request counts

Measured via the new regression test rendering the real `AuthProvider` +
a test consumer shaped exactly like `DashboardPage`'s real effect
(`useEffect` depending on `[user, refreshProfile]`, calling `await
refreshProfile()` inside), with a mocked Supabase client counting every
`from('member_profiles')` call, over a 300ms real-time settle window
after mount (plus a further 300ms window to confirm the count had
genuinely stopped, not just paused):

- **Before fix:** unbounded and growing -- **1,364** calls counted within
  the first 300ms window alone (confirmed by literally running the test
  against the pre-fix code; see falsification section below). This
  matches the reported production symptom of dozens-to-hundreds of
  redundant fetches per page load, just faster in a test environment
  with zero network latency.
- **After fix:** exactly **2** calls, stable and unchanging across two
  consecutive 300ms windows. This matches the traced chain precisely: 1
  call from `AuthProvider`'s own one-time mount effect (`getSession()`
  resolving and calling `fetchProfile` directly), + 1 call from the
  consumer's own effect firing exactly once when `user` first flips from
  `null` to the real user object, and never again.

## Regression test added

`src/context/AuthContext.regressionLoop.test.tsx` -- new file (no prior
test file for `AuthContext.tsx` existed).

**What it proves:** using the *real* `AuthProvider` (not a mocked
`useAuth`) wrapping a small `DashboardLikeConsumer` component that
mimics `DashboardPage.tsx`'s exact problematic pattern (`useEffect`
depending on `[user, refreshProfile]`, calling `await refreshProfile()`
inside), with the Supabase client mocked via the same
`vi.mock('@/lib/supabase', ...)` + chainable-builder convention used in
`DashboardPage.test.tsx`, the `member_profiles` table is queried exactly
2 times total and that count stops growing -- not an unbounded/growing
count.

**Falsification check performed, as required, not skipped:**
1. Ran the new test against the code *with* the fix applied: **passed**,
   settled count = 2 (679ms run).
2. Temporarily reverted both `useCallback` wraps in `AuthContext.tsx`
   back to plain functions (git-diff-verified identical revert).
3. Re-ran the exact same test: **failed**, with
   `AssertionError: expected 1364 to be 2` -- a genuine, concrete
   observed failure (not a timeout/hang), proving the test actually
   detects the bug rather than trivially passing regardless of the fix.
4. Re-applied the fix (same diff as originally written) and re-ran the
   full suite: back to green, count = 2.

## Full test/TypeScript/build results

- `npx vitest run` (full suite): **49 test files, 263 tests, all green**
  (262 pre-existing + 1 new regression test). No test files exist for
  `CareerProfilePage.tsx`, `MembershipPage.tsx`, or `OnboardingPage.tsx`
  specifically (confirmed via directory listing -- this is a pre-existing
  coverage gap, not something introduced or required to close by this
  narrowly-scoped fix); their code was read and reasoned about instead
  (see "Consumer call sites" below), and `DashboardPage.test.tsx` (8
  tests) and `ForwardDnaPage.test.tsx` (3 tests), which do exist and do
  exercise `refreshProfile`, both pass unchanged.
- `npx tsc --noEmit`: **clean**, zero errors.
- `npm run build`: **clean production build** (`tsc && vite build`
  succeeded). One pre-existing, unrelated warning about the main JS
  chunk exceeding 500kB after minification -- same warning already
  present and previously disclosed before this fix, not caused by it (no
  new imports/dependencies were added).

### Consumer call sites re-verified by reading (not just tests)

**Correction (post-review, no code changes -- report accuracy only):**
an independent re-trace of all 5 consumer call sites by the
code-reviewer and Mike found that only two of the four consumer pages
below actually had the self-sustaining loop. The original version of
this section incorrectly claimed `ForwardDnaPage.tsx` and
`OnboardingPage.tsx` had "the same shape" as `DashboardPage.tsx`; that
was wrong. Corrected breakdown:

- `DashboardPage.tsx` (**had the live loop**): `refreshProfile` is
  called inside a `useEffect` whose own dependency array is `[user,
  refreshProfile]` (line 112) -- the origin of the investigation. Its
  8-test suite passes unchanged, and the new regression test directly
  exercises its exact effect shape.
- `CareerProfilePage.tsx` (**had the live loop**): calls
  `refreshProfile()` after profile save and document upload, inside a
  `useEffect` whose own dependency array is `[user, refreshProfile]`
  (line 38) -- same shape as `DashboardPage.tsx`. Unaffected by the fix
  beyond gaining stability: still receives a working `refreshProfile`
  that always re-fetches; its own effect will simply stop being falsely
  re-triggered by `AuthProvider`'s internal re-renders.
- `ForwardDnaPage.tsx` (**never had a loop -- correction**): every
  reference to `refreshProfile` is inside `handleSaveTargets`, a
  `useCallback`-wrapped Save-button click handler (line 141-157) --
  never inside a `useEffect`. Its own `useEffect` depends on `[user]`
  only and never referenced `refreshProfile`. It never auto-fired or
  looped, before or after this fix. The `useCallback` gaining a stable
  `refreshProfile` dependency is a referential-stability improvement
  only (the handler itself is recreated less often), not a bug fix. Its
  3-test suite passes unchanged.
- `OnboardingPage.tsx` (**never had a loop -- correction**): every
  reference to `refreshProfile` is inside `handleNext`, a
  `useCallback`-wrapped Next/Continue-button click handler (line 90),
  with dependency array `[currentStep, completedSteps, user, navigate,
  saveProgress, refreshProfile]` (line 124) -- never inside a
  `useEffect`. It never auto-fired or looped either. Same as
  `ForwardDnaPage.tsx`: `refreshProfile` becoming stable is purely a
  referential-stability improvement to this click handler, not a bug
  fix -- the other 5 dependencies are untouched and still drive the
  handler's identity exactly as before.
- `MembershipPage.tsx` (calls `refreshProfile()` in 3 places after plan
  changes, no effect or callback dependency on it): unaffected, no
  behavior change since it doesn't depend on `refreshProfile`'s identity
  anywhere.

## Remaining concerns

- No dedicated test files exist for `CareerProfilePage.tsx`,
  `MembershipPage.tsx`, or `OnboardingPage.tsx` (pre-existing gap, not
  introduced here) -- their correctness after this fix rests on reading
  the code plus the shared, now-covered `AuthContext.tsx` root-cause
  fix, not on direct test execution for those three specific files.
  Worth a separate ticket if deeper confidence there is wanted.
- The other two previously-flagged, separately-ticketed issues
  (`MemberLayout` double-render/nesting, and the cosmetic
  `\u2615`-escape-shows-as-text bug) remain untouched, exactly as scoped.
- Nothing has been merged. Branch sits exactly where it was, isolated,
  pending explicit approval, per the brief's instructions.
