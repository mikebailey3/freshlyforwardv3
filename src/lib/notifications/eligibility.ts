/**
 * OE 2.0 Phase 10 -- notification eligibility, built entirely on the
 * EXISTING `communication_preferences` table (src/lib/communication.ts,
 * `20260802190429_phase5_founding_member_communication.sql`) -- per the
 * plan's own instruction to check existing member preference
 * infrastructure before assuming a new column/table is needed. No new
 * schema for preferences at all.
 *
 * `email_notifications` is the global kill switch; `weekly_digest` and
 * `immediate_alerts` are the two independent cadences this table
 * already models (both booleans, independently settable -- a member can
 * be subscribed to neither, either, or both). This module does not
 * collapse them into a single enum; it reports eligibility per cadence
 * so a caller can decide what to do with each independently.
 */

/** Structurally matches the relevant fields of `CommunicationPreferences` (src/types/index.ts) without importing the whole type -- keeps this module dependency-free/pure. */
export interface DigestPreferencesLike {
  email_notifications: boolean
  weekly_digest: boolean
  immediate_alerts: boolean
}

export interface DigestEligibility {
  weeklyDigestEligible: boolean
  immediateAlertEligible: boolean
}

/**
 * `prefs === null` means the member has never had a
 * `communication_preferences` row created (see `ensureCommPrefs`).
 * Rather than treating "no row yet" as "opted out" -- which would
 * silently exclude a brand-new member from ever getting a digest until
 * they visit a settings page they don't know exists -- this defaults to
 * the exact same values the table's own column DEFAULTs use
 * (`email_notifications`/`weekly_digest`/`immediate_alerts` all default
 * `true`). This is a single, explicit mirror of that schema default,
 * not a second source of truth: if those defaults ever change, this
 * comment is the pointer back to keep them in sync.
 */
export function computeDigestEligibility(prefs: DigestPreferencesLike | null): DigestEligibility {
  const emailEnabled = prefs?.email_notifications ?? true
  return {
    weeklyDigestEligible: emailEnabled && (prefs?.weekly_digest ?? true),
    immediateAlertEligible: emailEnabled && (prefs?.immediate_alerts ?? true),
  }
}
