/**
 * OE 2.0 Hardening -- non-prod database security tests.
 *
 * IMPORTANT: this is NOT a vitest unit test. RLS is enforced by
 * Postgres itself, not by any client-side mock, so the only way to
 * genuinely validate it is to run real queries as real signed-in
 * users against a real database. This script does exactly that,
 * against the fixture created by scripts/createOe2SecurityFixtures.ts.
 *
 * HARD SAFETY GUARD: refuses to run unless VITE_SUPABASE_URL contains
 * the known non-prod project ref (see scripts/lib/oe2SecurityFixtures.ts).
 * The only rows this script ever authorizes changing are the fixture's
 * own matchA (one dismiss, one strategist-promote) -- every other case
 * is a read or a deliberately-attempted, expected-to-fail write.
 *
 * Usage (after running createOe2SecurityFixtures.ts --create and
 * copying its printed run tag):
 *   npm run test:oe2-security -- <run-tag>
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { assertNonProdProject, fixtureEmail, FIXTURE_PASSWORD } from './lib/oe2SecurityFixtures'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

assertNonProdProject(SUPABASE_URL)
if (!ANON_KEY || !SERVICE_ROLE_KEY) {
  console.error('Missing VITE_SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY in the environment.')
  process.exit(1)
}

const runTag = process.argv[2]
if (!runTag) {
  console.error('Usage: npm run test:oe2-security -- <run-tag>')
  process.exit(1)
}

const serviceClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

interface TestResult { name: string; passed: boolean; detail: string }
const results: TestResult[] = []

function record(name: string, passed: boolean, detail: string) {
  results.push({ name, passed, detail })
  console.log(`${passed ? 'PASS' : 'FAIL'} -- ${name}${detail ? ` (${detail})` : ''}`)
}

async function signInAs(email: string): Promise<SupabaseClient> {
  const client = createClient(SUPABASE_URL!, ANON_KEY!)
  const { error } = await client.auth.signInWithPassword({ email, password: FIXTURE_PASSWORD })
  if (error) throw new Error(`Could not sign in as ${email}: ${error.message}`)
  return client
}

/** Generic forbidden-column-edit probe -- used for every column neither actor should ever be able to touch. Any non-empty result would mean the edit went through. */
async function testForbiddenEdit(actorLabel: string, actorClient: SupabaseClient, matchId: string, column: string, value: unknown) {
  const { data } = await actorClient.from('job_matches').update({ [column]: value }).eq('id', matchId).select('id')
  record(`${actorLabel} cannot update ${column}`, (data ?? []).length === 0, `rows affected: ${(data ?? []).length}`)
}

async function main() {
  // ---- Resolve fixture rows via service role (setup lookup only --
  // never used as part of an actual test assertion below) ----
  const { data: users, error: listError } = await serviceClient.auth.admin.listUsers()
  if (listError) throw new Error(`Could not list users: ${listError.message}`)

  const findId = (who: Parameters<typeof fixtureEmail>[1]) => {
    const email = fixtureEmail(runTag, who)
    const user = users.users.find((u) => u.email === email)
    if (!user) throw new Error(`Fixture user not found: ${email}. Did you run createOe2SecurityFixtures.ts --create with this run tag?`)
    return user.id
  }
  const memberAId = findId('member-a')
  const memberBId = findId('member-b')
  // Strategist S's own id isn't needed directly -- every assertion below
  // exercises it purely through its signed-in client's own auth context.

  const { data: matchA } = await serviceClient.from('job_matches').select('id').eq('member_id', memberAId).maybeSingle()
  const { data: matchB } = await serviceClient.from('job_matches').select('id').eq('member_id', memberBId).maybeSingle()
  const { data: opportunity } = await serviceClient.from('opportunities').select('id').eq('member_id', memberAId).maybeSingle()
  const { data: job2 } = await serviceClient.from('scraped_jobs').select('id').eq('external_id', `oe2-fixture-${runTag}-alt`).maybeSingle()
  const { data: marketSnapshot } = await serviceClient.from('market_intelligence_snapshots').select('id').eq('role_bucket', 'oe2-fixture').eq('location_bucket', runTag).maybeSingle()
  if (!matchA || !matchB || !opportunity || !job2 || !marketSnapshot) throw new Error('Could not resolve fixture rows -- fixture incomplete for this run tag.')

  const memberA = await signInAs(fixtureEmail(runTag, 'member-a'))
  const memberB = await signInAs(fixtureEmail(runTag, 'member-b'))
  const strategistS = await signInAs(fixtureEmail(runTag, 'strategist-s'))
  const adminQ = await signInAs(fixtureEmail(runTag, 'admin'))
  const anon = createClient(SUPABASE_URL!, ANON_KEY!) // never signed in

  // ============================================================
  // Cross-member isolation (both directions)
  // ============================================================
  async function testIsolation(actorLabel: string, actorClient: SupabaseClient, otherLabel: string, otherMatchId: string, otherMemberId: string) {
    const { data: selectOther } = await actorClient.from('job_matches').select('id').eq('id', otherMatchId)
    record(`${actorLabel} cannot SELECT ${otherLabel}'s job_match`, (selectOther ?? []).length === 0, `rows returned: ${(selectOther ?? []).length}`)

    const { data: updateOther } = await actorClient.from('job_matches').update({ dismissed_at: new Date().toISOString() }).eq('id', otherMatchId).select('id')
    record(`${actorLabel} cannot UPDATE ${otherLabel}'s job_match row`, (updateOther ?? []).length === 0, `rows affected: ${(updateOther ?? []).length}`)

    const { data: digestLog } = await actorClient.from('match_digest_log').select('id').eq('member_id', otherMemberId)
    record(`${actorLabel} cannot read ${otherLabel}'s digest log`, (digestLog ?? []).length === 0, `rows returned: ${(digestLog ?? []).length}`)

    const { data: rpcResult } = await actorClient.rpc('get_job_match_snapshot', { match_id: otherMatchId })
    record(`${actorLabel} calling get_job_match_snapshot for ${otherLabel}'s match returns nothing (RLS-bounded RPC)`, !rpcResult, `result: ${JSON.stringify(rpcResult)}`)
  }

  await testIsolation('Member A', memberA, 'Member B', matchB.id, memberBId)
  await testIsolation('Member B', memberB, 'Member A', matchA.id, memberAId)

  // ============================================================
  // Digest-log ownership (positive control -- requires the fixture's
  // pre-seeded rows, since this table has no authenticated INSERT policy)
  // ============================================================
  const { data: ownDigestA } = await memberA.from('match_digest_log').select('id').eq('member_id', memberAId)
  record('Member A CAN read own digest log', (ownDigestA ?? []).length === 1, `rows returned: ${(ownDigestA ?? []).length}`)
  const { data: ownDigestB } = await memberB.from('match_digest_log').select('id').eq('member_id', memberBId)
  record('Member B CAN read own digest log', (ownDigestB ?? []).length === 1, `rows returned: ${(ownDigestB ?? []).length}`)

  // ============================================================
  // market_intelligence_snapshots (validated-defect regression coverage
  // -- the one real bug non-prod testing found: the admin branch used
  // to query auth.users directly, which authenticated has no SELECT on.
  // Fixed in 20260922000000 to use the auth.jwt() app_metadata claim
  // instead. No member_id column exists on this table at all, so there
  // is no member-data-exposure risk in any of these four checks.
  // ============================================================
  const { data: adminReads } = await adminQ.from('market_intelligence_snapshots').select('id').eq('id', marketSnapshot.id)
  record('Admin CAN read market_intelligence_snapshots', (adminReads ?? []).length === 1, `rows returned: ${(adminReads ?? []).length}`)

  const { data: strategistReads } = await strategistS.from('market_intelligence_snapshots').select('id').eq('id', marketSnapshot.id)
  record('Active strategist CAN read market_intelligence_snapshots', (strategistReads ?? []).length === 1, `rows returned: ${(strategistReads ?? []).length}`)

  const { data: memberReads } = await memberA.from('market_intelligence_snapshots').select('id').eq('id', marketSnapshot.id)
  record('Ordinary member cannot read market_intelligence_snapshots', (memberReads ?? []).length === 0, `rows returned: ${(memberReads ?? []).length}`)

  const { data: anonMarketIntelReal } = await anon.from('market_intelligence_snapshots').select('id').eq('id', marketSnapshot.id)
  record('Anonymous cannot read the real market_intelligence_snapshots row', (anonMarketIntelReal ?? []).length === 0, `rows returned: ${(anonMarketIntelReal ?? []).length}`)

  // ============================================================
  // Feedback ownership (member_feedback.job_match_id)
  // ============================================================
  const { data: feedbackNull } = await memberA.from('member_feedback').insert({ member_id: memberAId, job_match_id: null, feedback_type: 'oe2_security_test' }).select('id')
  record('Member A CAN insert feedback with job_match_id IS NULL', (feedbackNull ?? []).length === 1, `rows inserted: ${(feedbackNull ?? []).length}`)

  const { data: feedbackOwn } = await memberA.from('member_feedback').insert({ member_id: memberAId, job_match_id: matchA.id, feedback_type: 'oe2_security_test' }).select('id')
  record('Member A CAN insert feedback referencing own job_match', (feedbackOwn ?? []).length === 1, `rows inserted: ${(feedbackOwn ?? []).length}`)

  const { data: feedbackCross, error: feedbackCrossError } = await memberA.from('member_feedback').insert({ member_id: memberAId, job_match_id: matchB.id, feedback_type: 'oe2_security_test' }).select('id')
  record('Member A cannot insert feedback referencing Member B\'s job_match', !!feedbackCrossError && (feedbackCross ?? []).length === 0, feedbackCrossError?.message ?? `rows inserted: ${(feedbackCross ?? []).length}`)

  // ============================================================
  // Exclusion-rule ownership (member_job_exclusion_rules)
  // ============================================================
  const { data: ruleInsertOwn } = await memberA.from('member_job_exclusion_rules').insert({ member_id: memberAId, rule_type: 'company', value: 'OE2 Fixture Excluded Co' }).select('id').maybeSingle()
  record('Member A CAN insert own exclusion rule', !!ruleInsertOwn, `inserted id: ${ruleInsertOwn?.id ?? 'none'}`)

  const { data: ruleInsertForOther, error: ruleInsertForOtherError } = await memberA.from('member_job_exclusion_rules').insert({ member_id: memberBId, rule_type: 'company', value: 'OE2 Fixture Cross Attempt' }).select('id')
  record('Member A cannot insert an exclusion rule for Member B', !!ruleInsertForOtherError && (ruleInsertForOther ?? []).length === 0, ruleInsertForOtherError?.message ?? `rows inserted: ${(ruleInsertForOther ?? []).length}`)

  if (ruleInsertOwn) {
    const { data: crossDelete } = await memberB.from('member_job_exclusion_rules').delete().eq('id', ruleInsertOwn.id).select('id')
    record('Member B cannot delete Member A\'s exclusion rule', (crossDelete ?? []).length === 0, `rows deleted: ${(crossDelete ?? []).length}`)

    const { data: ownDelete } = await memberA.from('member_job_exclusion_rules').delete().eq('id', ruleInsertOwn.id).select('id')
    record('Member A CAN delete own exclusion rule', (ownDelete ?? []).length === 1, `rows deleted: ${(ownDelete ?? []).length}`)
  }

  // ============================================================
  // Member A: own-row reads/allowed writes/forbidden column edits
  // ============================================================
  const { data: ownSelect } = await memberA.from('job_matches').select('id').eq('id', matchA.id)
  record('Member A CAN SELECT own job_match', (ownSelect ?? []).length === 1, `rows returned: ${(ownSelect ?? []).length}`)

  await testForbiddenEdit('Member A', memberA, matchA.id, 'fresh_fit_score', 99)
  await testForbiddenEdit('Member A', memberA, matchA.id, 'score_breakdown', { hacked: true })
  await testForbiddenEdit('Member A', memberA, matchA.id, 'matched_skills', ['hacked'])
  await testForbiddenEdit('Member A', memberA, matchA.id, 'missing_skills', ['hacked'])
  await testForbiddenEdit('Member A', memberA, matchA.id, 'computed_at', '2099-01-01T00:00:00.000Z')
  await testForbiddenEdit('Member A', memberA, matchA.id, 'engine_version', 99)
  await testForbiddenEdit('Member A', memberA, matchA.id, 'member_id', memberBId)
  await testForbiddenEdit('Member A', memberA, matchA.id, 'scraped_job_id', job2.id)
  await testForbiddenEdit('Member A', memberA, matchA.id, 'promoted_opportunity_id', opportunity.id) // self-promote

  const { data: ownRpc } = await memberA.rpc('get_job_match_snapshot', { match_id: matchA.id })
  record('Member A calling get_job_match_snapshot for own match returns the row', !!ownRpc && (ownRpc as { id: string }).id === matchA.id, `result: ${JSON.stringify(ownRpc)}`)

  const { data: ownDismiss } = await memberA.from('job_matches').update({ dismissed_at: new Date().toISOString() }).eq('id', matchA.id).select('id, dismissed_at')
  record('Member A CAN dismiss own match', (ownDismiss ?? []).length === 1 && !!ownDismiss?.[0]?.dismissed_at, `rows affected: ${(ownDismiss ?? []).length}`)

  // ============================================================
  // Strategist S: assigned-member access + column-scoped promote
  // ============================================================
  const { data: strategistSeesA } = await strategistS.from('job_matches').select('id').eq('id', matchA.id)
  record('Strategist S CAN SELECT assigned Member A match', (strategistSeesA ?? []).length === 1, `rows returned: ${(strategistSeesA ?? []).length}`)

  await testForbiddenEdit('Strategist S', strategistS, matchA.id, 'fresh_fit_score', 1)
  await testForbiddenEdit('Strategist S', strategistS, matchA.id, 'score_breakdown', { hacked: true })
  await testForbiddenEdit('Strategist S', strategistS, matchA.id, 'matched_skills', ['hacked'])
  await testForbiddenEdit('Strategist S', strategistS, matchA.id, 'missing_skills', ['hacked'])
  await testForbiddenEdit('Strategist S', strategistS, matchA.id, 'computed_at', '2099-01-01T00:00:00.000Z')
  await testForbiddenEdit('Strategist S', strategistS, matchA.id, 'engine_version', 99)
  await testForbiddenEdit('Strategist S', strategistS, matchA.id, 'member_id', memberBId)
  await testForbiddenEdit('Strategist S', strategistS, matchA.id, 'scraped_job_id', job2.id)

  const { data: strategistPromote } = await strategistS.from('job_matches').update({ promoted_opportunity_id: opportunity.id }).eq('id', matchA.id).select('id, promoted_opportunity_id')
  record('Strategist S CAN promote Member A match', (strategistPromote ?? []).length === 1 && strategistPromote?.[0]?.promoted_opportunity_id === opportunity.id, `rows affected: ${(strategistPromote ?? []).length}`)

  const { data: strategistSeesB } = await strategistS.from('job_matches').select('id').eq('id', matchB.id)
  record('Strategist S cannot access Member B (not assigned)', (strategistSeesB ?? []).length === 0, `rows returned: ${(strategistSeesB ?? []).length}`)

  const { data: strategistUpdatesB } = await strategistS.from('job_matches').update({ promoted_opportunity_id: opportunity.id }).eq('id', matchB.id).select('id')
  record('Strategist S cannot update Member B (not assigned)', (strategistUpdatesB ?? []).length === 0, `rows affected: ${(strategistUpdatesB ?? []).length}`)

  // ============================================================
  // Anonymous
  // ============================================================
  const { data: anonJobMatches } = await anon.from('job_matches').select('id')
  record('Anonymous cannot read job_matches', (anonJobMatches ?? []).length === 0, `rows returned: ${(anonJobMatches ?? []).length}`)

  const { data: anonFeedback } = await anon.from('member_feedback').select('id')
  record('Anonymous cannot read member_feedback', (anonFeedback ?? []).length === 0, `rows returned: ${(anonFeedback ?? []).length}`)

  const { data: anonExclusion } = await anon.from('member_job_exclusion_rules').select('id')
  record('Anonymous cannot read member_job_exclusion_rules', (anonExclusion ?? []).length === 0, `rows returned: ${(anonExclusion ?? []).length}`)

  const { data: anonDigest } = await anon.from('match_digest_log').select('id')
  record('Anonymous cannot read match_digest_log', (anonDigest ?? []).length === 0, `rows returned: ${(anonDigest ?? []).length}`)

  const { data: anonMarketIntel } = await anon.from('market_intelligence_snapshots').select('id')
  record('Anonymous cannot read market_intelligence_snapshots', (anonMarketIntel ?? []).length === 0, `rows returned: ${(anonMarketIntel ?? []).length}`)

  const { data: anonRpc, error: anonRpcError } = await anon.rpc('get_job_match_snapshot', { match_id: matchA.id })
  record(
    'Anonymous cannot call get_job_match_snapshot RPC to expose a private row',
    !!anonRpcError || !anonRpc,
    anonRpcError?.message ?? `unexpected non-empty result: ${JSON.stringify(anonRpc)}`
  )

  // ============================================================
  // Admin: now automated for market_intelligence_snapshots (the only
  // OE table with admin-specific RLS) via the four assertions above.
  // Deliberately still NOT extended to every other OE table -- the
  // fixture's Admin Q has no strategist_assignments row and is not a
  // member, so it has nothing else to legitimately access; a broader
  // "admin gains no unintended access anywhere" sweep would just
  // re-run the exact same cross-member-isolation assertions already
  // covered above under a different actor label, adding no new signal.
  // ============================================================

  const passed = results.filter((r) => r.passed).length
  const failed = results.filter((r) => !r.passed).length
  console.log('')
  console.log('=== OE 2.0 Security Test Summary ===')
  console.log(`${passed}/${results.length} passed, ${failed} failed`)
  console.log('=====================================')

  if (failed > 0) process.exit(1)
}

main().catch((err) => {
  console.error('Fatal error running security tests:', err)
  process.exit(1)
})
