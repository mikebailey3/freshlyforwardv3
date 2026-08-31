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
