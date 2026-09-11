/**
 * Shared constants/helpers between scripts/createOe2SecurityFixtures.ts
 * and scripts/runOe2SecurityTests.ts -- kept in scripts/lib/ (matching
 * the existing runSummary.ts/errorDetail.ts convention) specifically so
 * neither script triggers the other's CLI argument-parsing/env-var
 * guard side effects merely by importing shared values.
 */

export const NON_PROD_PROJECT_REF = 'szwfxfitrmvqbdvcbgrf'
export const FIXTURE_PASSWORD = 'Oe2Fixture!Test-Only-Do-Not-Use-1'

export type FixtureActor = 'member-a' | 'member-b' | 'strategist-s'

/** Obviously-fake, easy to find/filter/delete manually -- never a real domain. */
export function fixtureEmail(runTag: string, who: FixtureActor): string {
  return `oe2-fixture-${who}-${runTag}@oe2-security-fixture.invalid`
}

/** Call at the top of any script that must never run against a non-fixture project. Exits the process rather than returning false, so every caller gets the same fail-safe behavior with no risk of a caller forgetting to check a return value. */
export function assertNonProdProject(supabaseUrl: string | undefined): asserts supabaseUrl is string {
  if (!supabaseUrl) {
    console.error('Missing VITE_SUPABASE_URL in the environment.')
    process.exit(1)
    return // unreachable in real usage (process.exit terminates) -- present so a mocked exit (e.g. in tests) can't fall through into the .includes() call below on an undefined value
  }
  if (!supabaseUrl.includes(NON_PROD_PROJECT_REF)) {
    console.error(`Refusing to run: VITE_SUPABASE_URL does not reference the known non-prod project (${NON_PROD_PROJECT_REF}).`)
    console.error(`Got: ${supabaseUrl}`)
    console.error('This script only ever runs against the non-production "Freshly Forward" project. Aborting -- nothing was created, changed, or read.')
    process.exit(1)
  }
}
