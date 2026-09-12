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
 *   - Admin Q (real auth.users, app_metadata.role='admin') -- needed to
 *     automate the market_intelligence_snapshots admin-read assertion;
 *     app_metadata is set at creation time via the service-role admin
 *     API, the same trusted, non-user-editable field the fixed
 *     20260922000000 policy and every other admin check in this repo
 *     already keys off of
 *   - An active strategist_assignments row: S -> Member A only
 *     (S is deliberately NOT assigned to Member B -- this is what lets
 *     the "strategist cannot access an unassigned member" test exist)
 *   - Two scraped_jobs rows -- the second exists solely so the security
 *     test runner can attempt reassigning a match's scraped_job_id to a
 *     REAL, constraint-valid alternate id (proving the rejection is
 *     genuinely RLS, not an incidental FK-violation error on a made-up id)
 *   - One job_matches row for Member A, one for Member B (both against
 *     the first scraped job -- UNIQUE is (member_id, scraped_job_id), so
 *     this is allowed)
 *   - One opportunities row for Member A -- gives the "strategist
 *     promotes a match" test a real, non-null value to promote to,
 *     rather than only a no-op NULL-to-NULL update
 *   - One match_digest_log row EACH for Member A and Member B --
 *     seeded via service role since that table deliberately has no
 *     authenticated INSERT policy at all (service-role/script-only
 *     writes), so this is the only way a "member CAN read their own
 *     digest log" positive-control test can exist
 *   - One market_intelligence_snapshots row -- seeded via service role
 *     (this table has no authenticated INSERT policy either) so the
 *     admin-can-read / strategist-can-read / member-cannot-read /
 *     anon-cannot-read assertions all have a real row to probe, not
 *     just an always-vacuously-true empty result
 *
 * Deliberately does NOT create member_profiles/communication_preferences
 * rows -- no scenario this fixture supports requires them.
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
  const { data: adminQ, error: adminError } = await supabase.auth.admin.createUser({
    email: fixtureEmail(runTag, 'admin'), password: FIXTURE_PASSWORD, email_confirm: true,
    app_metadata: { role: 'admin' },
  })

  if (memberAError || memberBError || strategistError || adminError || !memberA.user || !memberB.user || !strategistS.user || !adminQ.user) {
    console.error('Failed to create one or more fixture users:', { memberAError, memberBError, strategistError, adminError })
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
  const { data: job2, error: job2Error } = await supabase
    .from('scraped_jobs')
    .insert({
      source: 'fixture', external_id: `oe2-fixture-${runTag}-alt`,
      title: '[OE2 FIXTURE] Alternate Test Role', company: '[OE2 FIXTURE] Alt Test Co',
      posting_url: `https://example.invalid/oe2-fixture-${runTag}-alt`,
    })
    .select('id')
    .maybeSingle()
  if (jobError || job2Error || !job || !job2) {
    console.error('Failed to create scraped_jobs fixture rows:', { jobError, job2Error })
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

  const { error: digestLogAError } = await supabase
    .from('match_digest_log')
    .insert({ member_id: memberA.user.id, match_ids: [matchA.id] })
  const { error: digestLogBError } = await supabase
    .from('match_digest_log')
    .insert({ member_id: memberB.user.id, match_ids: [matchB.id] })
  if (digestLogAError || digestLogBError) {
    console.error('Failed to create match_digest_log fixture rows:', { digestLogAError, digestLogBError })
    process.exit(1)
  }

  const { data: marketSnapshot, error: marketSnapshotError } = await supabase
    .from('market_intelligence_snapshots')
    .insert({ role_bucket: 'oe2-fixture', location_bucket: runTag, sample_size: 1 })
    .select('id')
    .maybeSingle()
  if (marketSnapshotError || !marketSnapshot) {
    console.error('Failed to create market_intelligence_snapshots fixture row:', marketSnapshotError)
    process.exit(1)
  }

  console.log('')
  console.log('=== OE 2.0 Security Fixtures Created ===')
  console.log(`Run tag (needed for --cleanup, and for runOe2SecurityTests.ts): ${runTag}`)
  console.log(`Fixture password (all four users): ${FIXTURE_PASSWORD}`)
  console.log(`Member A:      id=${memberA.user.id}  email=${memberA.user.email}`)
  console.log(`Member B:      id=${memberB.user.id}  email=${memberB.user.email}`)
  console.log(`Strategist S:  id=${strategistS.user.id}  email=${strategistS.user.email}  (assigned to Member A only)`)
  console.log(`Admin Q:       id=${adminQ.user.id}  email=${adminQ.user.email}  (app_metadata.role='admin')`)
  console.log(`scraped_jobs.id:  ${job.id}`)
  console.log(`scraped_jobs.id (alt, for scraped_job_id-reassignment test): ${job2.id}`)
  console.log(`job_matches.id (Member A's): ${matchA.id}`)
  console.log(`job_matches.id (Member B's): ${matchB.id}`)
  console.log(`opportunities.id (Member A's, promotion target): ${opportunity.id}`)
  console.log('match_digest_log: one row seeded for each of Member A and Member B')
  console.log(`market_intelligence_snapshots.id: ${marketSnapshot.id}`)
  console.log('==========================================')
  console.log('')
  console.log(`Next: npm run test:oe2-security -- ${runTag}`)
  console.log(`When done: npm run fixtures:oe2-security -- --cleanup ${runTag}`)
}

async function cleanupFixtures(runTag: string) {
  console.log(`Cleaning up OE 2.0 security fixtures for run tag: ${runTag}`)
  console.log('This will delete the four fixture auth users (cascades to their job_matches/strategist_assignments/opportunities/match_digest_log rows via ON DELETE CASCADE), the fixture scraped_jobs rows, and the fixture market_intelligence_snapshots row.')

  const actors: Array<'member-a' | 'member-b' | 'strategist-s' | 'admin'> = ['member-a', 'member-b', 'strategist-s', 'admin']
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

  const { error: jobDeleteError } = await supabase.from('scraped_jobs').delete().like('external_id', `oe2-fixture-${runTag}%`)
  if (jobDeleteError) console.error('Failed to delete fixture scraped_jobs row:', jobDeleteError)
  else console.log('Deleted fixture scraped_jobs row.')

  const { error: marketSnapshotDeleteError } = await supabase.from('market_intelligence_snapshots').delete().eq('role_bucket', 'oe2-fixture').eq('location_bucket', runTag)
  if (marketSnapshotDeleteError) console.error('Failed to delete fixture market_intelligence_snapshots row:', marketSnapshotDeleteError)
  else console.log('Deleted fixture market_intelligence_snapshots row.')

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
