/**
 * OE 2.0 Hardening -- non-prod security test fixtures.
 *
 * HARD SAFETY GUARD (scripts/lib/oe2SecurityFixtures.ts::assertNonProdProject):
 * refuses to run unless VITE_SUPABASE_URL contains the known
 * non-production project ref (szwfxfitrmvqbdvcbgrf, "Freshly Forward").
 * A wrong env var pointed at production `bolt-native-database-69540068`
 * (or anywhere else) makes this script exit immediately, before
 * creating anything.
 *
 * Creates the exact fixture set requested for OE 2.0 RLS security
 * testing:
 *   - Member A, Member B (real auth.users, obviously-fake emails)
 *   - Strategist S (real auth.users)
 *   - An active strategist_assignments row: S -> Member A only
 *     (S is deliberately NOT assigned to Member B -- this is what lets
 *     the "strategist cannot access an unassigned member" test exist)
 *   - One scraped_jobs row (shared)
 *   - One job_matches row for Member A, one for Member B (both against
 *     the same scraped job -- UNIQUE is (member_id, scraped_job_id), so
 *     this is allowed)
 *   - One opportunities row for Member A -- gives the "strategist
 *     promotes a match" test a real, non-null value to promote to,
 *     rather than only a no-op NULL-to-NULL update
 *
 * Deliberately does NOT create member_profiles/communication_preferences
 * rows, and deliberately does NOT create an admin fixture -- none of the
 * member/strategist RLS scenarios this fixture supports require them,
 * and admin escalation should be even more deliberate/manual than an
 * ordinary fixture user, never automated here.
 *
 * Does NOT automatically clean up. Run with --cleanup, passing the same
 * run tag printed on creation, to deliberately remove everything this
 * script created.
 *
 * Usage:
 *   npm run fixtures:oe2-security -- --create
 *   npm run fixtures:oe2-security -- --cleanup <run-tag-from-create-output>
 */
import { createClient } from '@supabase/supabase-js'
import { assertNonProdProject, fixtureEmail, FIXTURE_PASSWORD } from './lib/oe2SecurityFixtures'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

assertNonProdProject(SUPABASE_URL)
if (!SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY in the environment.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

async function createFixtures() {
  const runTag = Date.now().toString(36)
  console.log(`Creating OE 2.0 security fixtures in non-prod (run tag: ${runTag})...`)

  const { data: memberA, error: memberAError } = await supabase.auth.admin.createUser({
    email: fixtureEmail(runTag, 'member-a'), password: FIXTURE_PASSWORD, email_confirm: true,
  })
  const { data: memberB, error: memberBError } = await supabase.auth.admin.createUser({
    email: fixtureEmail(runTag, 'member-b'), password: FIXTURE_PASSWORD, email_confirm: true,
  })
  const { data: strategistS, error: strategistError } = await supabase.auth.admin.createUser({
    email: fixtureEmail(runTag, 'strategist-s'), password: FIXTURE_PASSWORD, email_confirm: true,
  })

  if (memberAError || memberBError || strategistError || !memberA.user || !memberB.user || !strategistS.user) {
    console.error('Failed to create one or more fixture users:', { memberAError, memberBError, strategistError })
    process.exit(1)
  }

  const { error: assignmentError } = await supabase.from('strategist_assignments').insert({
    strategist_id: strategistS.user.id,
    member_id: memberA.user.id,
    is_active: true,
  })
  if (assignmentError) {
    console.error('Failed to create strategist_assignments row:', assignmentError)
    process.exit(1)
  }

  const { data: job, error: jobError } = await supabase
    .from('scraped_jobs')
    .insert({
      source: 'fixture', external_id: `oe2-fixture-${runTag}`,
      title: '[OE2 FIXTURE] Test Analyst Role', company: '[OE2 FIXTURE] Test Co',
      posting_url: `https://example.invalid/oe2-fixture-${runTag}`,
    })
    .select('id')
    .maybeSingle()
  if (jobError || !job) {
    console.error('Failed to create scraped_jobs fixture row:', jobError)
    process.exit(1)
  }

  const { data: matchA, error: matchAError } = await supabase
    .from('job_matches')
    .insert({ member_id: memberA.user.id, scraped_job_id: job.id, fresh_fit_score: 75 })
    .select('id')
    .maybeSingle()
  const { data: matchB, error: matchBError } = await supabase
    .from('job_matches')
    .insert({ member_id: memberB.user.id, scraped_job_id: job.id, fresh_fit_score: 75 })
    .select('id')
    .maybeSingle()
  if (matchAError || matchBError || !matchA || !matchB) {
    console.error('Failed to create job_matches fixture rows:', { matchAError, matchBError })
    process.exit(1)
  }

  const { data: opportunity, error: opportunityError } = await supabase
    .from('opportunities')
    .insert({ member_id: memberA.user.id, employer: '[OE2 FIXTURE] Test Co', job_title: '[OE2 FIXTURE] Test Analyst Role' })
    .select('id')
    .maybeSingle()
  if (opportunityError || !opportunity) {
    console.error('Failed to create opportunities fixture row:', opportunityError)
    process.exit(1)
  }

  console.log('')
  console.log('=== OE 2.0 Security Fixtures Created ===')
  console.log(`Run tag (needed for --cleanup, and for runOe2SecurityTests.ts): ${runTag}`)
  console.log(`Fixture password (all three users): ${FIXTURE_PASSWORD}`)
  console.log(`Member A:      id=${memberA.user.id}  email=${memberA.user.email}`)
  console.log(`Member B:      id=${memberB.user.id}  email=${memberB.user.email}`)
  console.log(`Strategist S:  id=${strategistS.user.id}  email=${strategistS.user.email}  (assigned to Member A only)`)
  console.log(`scraped_jobs.id:  ${job.id}`)
  console.log(`job_matches.id (Member A's): ${matchA.id}`)
  console.log(`job_matches.id (Member B's): ${matchB.id}`)
  console.log(`opportunities.id (Member A's, promotion target): ${opportunity.id}`)
  console.log('==========================================')
  console.log('')
  console.log(`Next: npm run test:oe2-security -- ${runTag}`)
  console.log(`When done: npm run fixtures:oe2-security -- --cleanup ${runTag}`)
}

async function cleanupFixtures(runTag: string) {
  console.log(`Cleaning up OE 2.0 security fixtures for run tag: ${runTag}`)
  console.log('This will delete the three fixture auth users (cascades to their job_matches/strategist_assignments/opportunities rows via ON DELETE CASCADE) and the fixture scraped_jobs row.')

  const actors: Array<'member-a' | 'member-b' | 'strategist-s'> = ['member-a', 'member-b', 'strategist-s']
  const { data: users, error: listError } = await supabase.auth.admin.listUsers()
  if (listError) {
    console.error('Could not list users for cleanup:', listError)
    process.exit(1)
  }

  for (const actor of actors) {
    const email = fixtureEmail(runTag, actor)
    const match = users.users.find((u) => u.email === email)
    if (!match) { console.log(`No user found for ${email} -- already cleaned up or never created.`); continue }
    const { error: deleteError } = await supabase.auth.admin.deleteUser(match.id)
    if (deleteError) console.error(`Failed to delete ${email}:`, deleteError)
    else console.log(`Deleted ${email}`)
  }

  const { error: jobDeleteError } = await supabase.from('scraped_jobs').delete().eq('external_id', `oe2-fixture-${runTag}`)
  if (jobDeleteError) console.error('Failed to delete fixture scraped_jobs row:', jobDeleteError)
  else console.log('Deleted fixture scraped_jobs row.')

  console.log('Cleanup complete.')
}

const args = process.argv.slice(2)
if (args.includes('--cleanup')) {
  const runTag = args[args.indexOf('--cleanup') + 1]
  if (!runTag) {
    console.error('Usage: npm run fixtures:oe2-security -- --cleanup <run-tag>')
    process.exit(1)
  }
  cleanupFixtures(runTag).catch((err) => { console.error('Fatal error during cleanup:', err); process.exit(1) })
} else if (args.includes('--create')) {
  createFixtures().catch((err) => { console.error('Fatal error during fixture creation:', err); process.exit(1) })
} else {
  console.error('Usage: npm run fixtures:oe2-security -- --create')
  console.error('   or: npm run fixtures:oe2-security -- --cleanup <run-tag>')
  process.exit(1)
}
