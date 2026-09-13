/**
 * OE 2.0 Phase 10 -- Alerts & Digests orchestration script.
 *
 * DEFERRED PROVIDER: uses `NoOpNotificationProvider` by default (see
 * src/lib/notifications/provider.ts) -- no real email provider has been
 * chosen, purchased, or configured. This script exists to prove the
 * full pipeline (eligibility -> scheduling -> candidate selection ->
 * payload -> "send" -> duplicate-suppression log) end-to-end without
 * any provider account or API key.
 *
 * DO NOT run this against real member data on a real schedule until:
 *   1. `20260916000000_match_digest_log.sql` has been reviewed and applied.
 *   2. A real `NotificationProvider` has been chosen and wired in to
 *      replace `NoOpNotificationProvider` below (see that class's own
 *      docs -- with the no-op provider, every "sent" digest is logged
 *      as sent even though nothing was actually emailed).
 * Until both of those happen, this script is for architecture
 * validation and local/CI testing only.
 *
 * Usage:
 *   npm run send:digests
 *
 * Requires env vars (service role key needed to read across all members
 * and to resolve email addresses via the Supabase admin auth API):
 *   VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from '@supabase/supabase-js'
import { planWeeklyDigest } from '../src/lib/notifications/digestPlanning'
import { extractFirstName } from '../src/lib/notifications/digestPayload'
import { NoOpNotificationProvider, type NotificationProvider } from '../src/lib/notifications/provider'
import type { DigestCandidateMatch } from '../src/lib/notifications/digestCandidates'
import type { DigestPreferencesLike } from '../src/lib/notifications/eligibility'
import { summarizeRun, type AttemptResult } from './lib/runSummary'
import { getErrorDetail } from './lib/errorDetail'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

/** Swap this for a real provider once one is chosen -- everything else in this script is provider-agnostic. */
const provider: NotificationProvider = new NoOpNotificationProvider()

function groupBy<T, K>(items: T[], keyFn: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>()
  for (const item of items) {
    const key = keyFn(item)
    map.set(key, [...(map.get(key) ?? []), item])
  }
  return map
}

async function main() {
  const [{ data: profileRows, error: profilesError }, { data: prefRows }, { data: matchRows, error: matchesError }, digestLogResult] =
    await Promise.all([
      supabase.from('member_profiles').select('user_id, full_name').eq('status', 'active'),
      supabase.from('communication_preferences').select('user_id, email_notifications, weekly_digest, immediate_alerts'),
      supabase
        .from('job_matches')
        .select('id, member_id, fresh_fit_score, dismissed_at, promoted_opportunity_id, scraped_job:scraped_jobs(title, company, posting_url)')
        .is('dismissed_at', null)
        .is('promoted_opportunity_id', null),
      // OE 2.0 Phase 10 -- degrades safely if 20260916000000_match_digest_log.sql
      // hasn't been applied yet: `data` comes back null, `?? []` below treats
      // that as "no prior digests for anyone", which under isDigestDue's own
      // null-means-always-due rule just means everyone is due, same posture
      // as a genuine first run.
      supabase.from('match_digest_log').select('member_id, sent_at, match_ids'),
    ])

  if (profilesError) {
    console.error('Error fetching member_profiles:', profilesError)
    process.exit(1)
  }
  if (matchesError) {
    console.error('Error fetching job_matches:', matchesError)
    process.exit(1)
  }

  const profiles = (profileRows ?? []) as Array<{ user_id: string; full_name: string | null }>
  const prefsByUser = new Map<string, DigestPreferencesLike>()
  for (const row of (prefRows ?? []) as Array<DigestPreferencesLike & { user_id: string }>) {
    prefsByUser.set(row.user_id, row)
  }

  const matchesByMember = groupBy(
    (matchRows ?? []) as Array<{
      id: string; member_id: string; fresh_fit_score: number; dismissed_at: string | null
      promoted_opportunity_id: string | null; scraped_job: { title: string; company: string; posting_url: string | null } | null
    }>,
    (row) => row.member_id
  )

  const digestLogRows = (digestLogResult.data ?? []) as Array<{ member_id: string; sent_at: string; match_ids: string[] }>
  const digestLogByMember = groupBy(digestLogRows, (row) => row.member_id)

  const now = new Date()
  const results: AttemptResult[] = []
  let sentCount = 0
  let simulatedCount = 0

  for (const profile of profiles) {
    const label = `member ${profile.user_id}`
    try {
      const memberMatches = matchesByMember.get(profile.user_id) ?? []
      if (memberMatches.length === 0) continue // nothing to ever digest -- not worth resolving an email for

      const logEntries = digestLogByMember.get(profile.user_id) ?? []
      const lastDigestSentAt = logEntries.length > 0
        ? logEntries.map((e) => e.sent_at).sort().at(-1)!
        : null
      const previouslySentMatchIds = logEntries.flatMap((e) => e.match_ids)

      const candidateMatches: DigestCandidateMatch[] = memberMatches.map((m) => ({
        id: m.id,
        freshFitScore: m.fresh_fit_score,
        title: m.scraped_job?.title ?? 'Untitled role',
        company: m.scraped_job?.company ?? 'Unknown company',
        postingUrl: m.scraped_job?.posting_url ?? null,
        dismissedAt: m.dismissed_at,
        promotedOpportunityId: m.promoted_opportunity_id,
      }))

      const plan = planWeeklyDigest({
        toEmail: '', // resolved just below, only once we know a plan is actually going to be produced
        memberFirstName: extractFirstName(profile.full_name),
        prefs: prefsByUser.get(profile.user_id) ?? null,
        matches: candidateMatches,
        lastDigestSentAt,
        previouslySentMatchIds,
        now,
      })

      if (!plan) {
        results.push({ label, status: 'success' })
        continue
      }

      // Email resolved lazily -- only for members who actually have a
      // digest to send this run -- via Supabase's admin auth API
      // (auth.users is not exposed through the regular query builder).
      const { data: userData, error: userError } = await supabase.auth.admin.getUserById(profile.user_id)
      if (userError || !userData?.user?.email) {
        throw new Error(`Could not resolve email for member ${profile.user_id}: ${userError?.message ?? 'no email on file'}`)
      }
      plan.payload.toEmail = userData.user.email

      const sendResult = await provider.send(plan.payload)
      if (!sendResult.success) {
        throw new Error(`Provider ${provider.name} failed to send: ${sendResult.error ?? 'unknown error'}`)
      }

      if (sendResult.simulated) {
        // No email was actually sent -- do NOT write a "delivered" row into
        // match_digest_log. Skipping the insert makes this structurally
        // impossible to mistake for a real send, regardless of who runs
        // this script or against which Supabase project: re-running stays
        // idempotent and simply re-plans the same digest next time.
        simulatedCount++
        results.push({ label, status: 'success' })
        continue
      }

      const { error: logError } = await supabase
        .from('match_digest_log')
        .insert({ member_id: profile.user_id, match_ids: plan.matchIds })
      if (logError) console.error(`Sent digest to ${profile.user_id} but failed to log it (duplicate suppression may miss next run):`, logError)

      sentCount++
      results.push({ label, status: 'success' })
    } catch (err) {
      const detail = getErrorDetail(err)
      console.error(`Failed on ${label}: ${detail}`)
      results.push({ label, status: 'failure', detail })
    }
  }

  const summary = summarizeRun(results)
  console.log('')
  console.log('=== Alerts & Digests: Send Summary ===')
  console.log(`Members considered: ${summary.total} (succeeded: ${summary.succeeded}, failed: ${summary.failed})`)
  console.log(`Digests sent this run (via ${provider.name}): ${sentCount}`)
  if (simulatedCount > 0) {
    console.log(`WARNING: NO EMAILS WERE ACTUALLY SENT for ${simulatedCount} member(s) -- provider '${provider.name}' is a simulated no-op. Nothing was written to match_digest_log for these.`)
  }
  console.log(`Status: ${summary.status.toUpperCase()}`)
  console.log('========================================')

  if (summary.status === 'failed') {
    console.error('Every considered member failed -- nothing could be processed this run.')
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('Fatal error running digest send:', err)
  process.exit(1)
})
