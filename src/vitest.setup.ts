import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// src/lib/supabase.ts calls createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
// at module-import time with no fallback -- if either is unset, createClient()
// throws "supabaseUrl is required" before any test file's own vi.mock(...) for
// '@/lib/supabase' can even take effect, since that throw happens during the
// real module's evaluation, not inside a test. Locally this is masked by a
// gitignored .env with real dev/staging credentials; CI runners have no .env
// and no injected secrets, so every suite that imports supabase.ts (directly
// or transitively) fails at import time there.
//
// Fix: guarantee both vars are defined for every test run, everywhere, with
// obviously-fake, non-resolvable values -- only when not already set, so an
// existing .env (local dev) is never overridden. This only satisfies
// createClient()'s constructor; no test call ever reaches a real network
// request against these values (every test that actually exercises Supabase
// behavior mocks '@/lib/supabase' itself). '.invalid' is an RFC 2606-reserved
// TLD guaranteed to never resolve.
//
// Uses vi.stubEnv() (Vitest's own API for this) rather than a direct
// import.meta.env.X = ... assignment -- Vite's ImportMetaEnv type marks
// these properties readonly, so a direct assignment fails tsc --noEmit
// even though it would work at runtime under Vitest.
if (!import.meta.env.VITE_SUPABASE_URL) {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://dummy-test-project.supabase.invalid')
}
if (!import.meta.env.VITE_SUPABASE_ANON_KEY) {
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'dummy-anon-key-for-unit-tests-only-not-a-real-jwt')
}
