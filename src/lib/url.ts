/**
 * Guards any user-influenced string before it's rendered as a live `href`.
 * `new URL(...)` alone is not enough -- it happily parses `javascript:` and
 * `data:` URIs, both of which are dangerous to render as a clickable link
 * (see supabase/migrations/20260901000000_member_submitted_jobs.sql -- this
 * app now accepts member-typed posting URLs into a shared, world-readable
 * `scraped_jobs` table, so every downstream render site needs this check,
 * not just the original submission form).
 */
export function isSafeHttpUrl(value: string | null | undefined): boolean {
  if (!value) return false
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Guards a `notifications.link` value before it's rendered as a live `href`.
 * Unlike `isSafeHttpUrl`, notification links are legitimately EITHER an
 * absolute external URL (rare today, but the schema doesn't forbid it) OR a
 * same-origin in-app route written by trusted server-side triggers (e.g.
 * `/strategist/applications` -- see
 * supabase/migrations/20260821010000_interviews_reports_profile_upgrade.sql).
 * `isSafeHttpUrl` alone rejects every relative path (`new URL('/x')` throws
 * without a base), which would silently hide every real in-app notification
 * link -- a functional regression, not just an over-tightening.
 *
 * A relative path is accepted only when it starts with exactly one `/` and
 * is NOT protocol-relative (`//host/...`) or a backslash-based bypass of the
 * same trick (`/\host/...` -- browsers treat `\` as `/` for special schemes,
 * so `/\evil.com` can resolve off-origin exactly like `//evil.com`).
 *
 * The check runs against a whitespace-normalized copy of the value, not the
 * raw string: the WHATWG URL parser strips every ASCII tab/CR/LF (U+0009,
 * U+000D, U+000A) from anywhere in a URL before parsing it, so a string
 * like `/\t/evil.com` looks like a safe single-leading-slash path here but
 * collapses to `//evil.com` -- an off-origin protocol-relative URL -- the
 * instant a browser actually navigates it. Rendering still uses the
 * original, un-stripped `notification.link` value; the browser applies the
 * identical stripping at navigation time, so validating the normalized copy
 * and rendering the raw one always agree on the real destination.
 */
export function isSafeAppLink(value: string | null | undefined): boolean {
  if (!value) return false
  if (isSafeHttpUrl(value)) return true
  const normalized = value.replace(/[\t\r\n]/g, '')
  return normalized.startsWith('/') && !normalized.startsWith('//') && !normalized.startsWith('/\\')
}
