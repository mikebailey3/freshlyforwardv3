import { getFreshFitTier, FRESHFIT_TIER_LABELS } from '@/lib/freshFitScore'
import type { NotificationPayload } from './provider'
import type { DigestCandidateMatch } from './digestCandidates'

/**
 * OE 2.0 Phase 10 -- provider-agnostic digest payload construction.
 * Produces a plain `NotificationPayload` (subject + text body) that any
 * future `NotificationProvider` implementation can send unchanged --
 * this module never imports or assumes anything about a specific
 * provider's template/API shape.
 */

/**
 * `full_name` (member_profiles) is stored as one free-text field, not
 * separate given/family name columns -- this pulls just the first token
 * for a friendly greeting. Never throws on empty/whitespace-only input;
 * returns null (caller already falls back to "there") rather than an
 * empty string, which would render as "Hi ,".
 */
export function extractFirstName(fullName: string | null): string | null {
  const trimmed = fullName?.trim()
  if (!trimmed) return null
  return trimmed.split(/\s+/)[0]
}

export function buildWeeklyDigestPayload(toEmail: string, memberFirstName: string | null, matches: DigestCandidateMatch[]): NotificationPayload {
  const greetingName = memberFirstName ?? 'there'
  const subject = matches.length === 1
    ? `${greetingName}, you have 1 new match this week`
    : `${greetingName}, you have ${matches.length} new matches this week`

  const lines = matches.map((m) => {
    const tierLabel = FRESHFIT_TIER_LABELS[getFreshFitTier(m.freshFitScore)]
    const urlLine = m.postingUrl ? `\n  ${m.postingUrl}` : ''
    return `- ${m.title} at ${m.company} (${tierLabel}, ${m.freshFitScore}/100)${urlLine}`
  })

  const bodyText = [
    `Hi ${greetingName},`,
    '',
    `Here ${matches.length === 1 ? 'is' : 'are'} your new FreshFit match${matches.length === 1 ? '' : 'es'} this week:`,
    '',
    ...lines,
    '',
    'Log in to FreshlyForward to see the full details and take action.',
  ].join('\n')

  return { toEmail, subject, bodyText }
}
