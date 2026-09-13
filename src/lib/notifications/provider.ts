/**
 * OE 2.0 Phase 10 -- Alerts & Digests provider boundary.
 *
 * DEFERRED: no transactional email provider (Resend, SendGrid, etc.) has
 * been chosen, purchased, or configured. Per explicit instruction, this
 * file defines ONLY the adapter boundary a real provider will implement
 * later -- choosing/wiring a real provider is a separate, explicitly
 * gated decision (see the OE 2.0 plan's Phase 10 section: it needs a
 * real API key as a repo secret, which is an admin-only step nothing in
 * this file requires or assumes).
 *
 * Every other Phase 10 module (eligibility, digest candidate selection,
 * payload construction, scheduling) depends only on this interface --
 * never on a concrete provider -- so provider selection can be dropped
 * in later with zero changes anywhere else.
 */

export interface NotificationPayload {
  /** Recipient email address. Resolved by the caller (e.g. via Supabase's admin auth API) -- this module never looks up a member's email itself. */
  toEmail: string
  subject: string
  /** Plain-text body -- provider-agnostic; every real transactional email provider accepts a text body, so this is the one guaranteed-portable format. An HTML body is optional/additive, never required. */
  bodyText: string
  bodyHtml?: string
}

export interface NotificationSendResult {
  success: boolean
  /**
   * REQUIRED, never optional -- this is the one field every provider must
   * state honestly. `true` means no email was actually delivered (or ever
   * attempted); `success: true` alone does NOT mean "delivered", it only
   * ever meant "the provider call didn't error". Callers that persist
   * delivery state (e.g. `match_digest_log`) must gate that write on
   * `simulated === false`, not on `success` alone -- see
   * `NoOpNotificationProvider` below for why a doc comment isn't enough.
   */
  simulated: boolean
  /** Provider-assigned message id, when available -- opaque, never parsed/relied upon by this codebase. */
  providerMessageId?: string
  error?: string
}

export interface NotificationProvider {
  /** Short, log-friendly identifier for which provider handled (or would have handled) a send -- e.g. 'noop', 'resend', 'sendgrid'. */
  readonly name: string
  send(payload: NotificationPayload): Promise<NotificationSendResult>
}

/**
 * The default provider until a real one is chosen. Never sends anything
 * over the network -- logs what WOULD have been sent and reports
 * success, so the entire eligibility -> candidates -> payload ->
 * scheduling -> duplicate-suppression pipeline can be built, tested, and
 * run end-to-end (including writing real `match_digest_log` rows once
 * that migration is applied) without any provider account, API key, or
 * repo secret existing yet.
 *
 * IMPORTANT: because this always reports `success: true`, running the
 * digest pipeline with this provider WILL mark matches as "sent" in
 * `match_digest_log` even though no email was ever delivered. That is
 * intentional for architecture validation and local/CI testing, but
 * means this provider must never be pointed at real member data on a
 * real schedule -- see scripts/sendDigests.ts's own docs.
 */
export class NoOpNotificationProvider implements NotificationProvider {
  readonly name = 'noop'

  async send(payload: NotificationPayload): Promise<NotificationSendResult> {
    console.log(`[SIMULATED -- NOT SENT] [NoOpNotificationProvider] Would send to ${maskEmail(payload.toEmail)}: "${payload.subject}"`)
    return Promise.resolve({ success: true, simulated: true, providerMessageId: undefined })
  }
}

/**
 * Masks an email for console/log output -- this script can run against real
 * member data before a real provider exists, and logs get copied/retained
 * far more often than people expect. `j***@example.com` is enough to spot-
 * check the right member was targeted without printing the full address.
 */
function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!domain) return '***'
  return `${local[0] ?? '*'}***@${domain}`
}
