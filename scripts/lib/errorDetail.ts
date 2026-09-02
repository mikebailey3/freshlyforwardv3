/**
 * Extracts a human-readable message from a caught value for logging.
 *
 * Supabase-js query errors are not `Error` instances -- they're plain
 * objects shaped like { message, details, hint, code } -- so a plain
 * `err instanceof Error ? err.message : String(err)` check stringifies
 * them as the useless "[object Object]" instead of their real message.
 * This checks for a string `message` property on any thrown value before
 * falling back to String(), which covers both cases.
 */
export function getErrorDetail(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'object' && err !== null && 'message' in err) {
    const message = (err as { message: unknown }).message
    if (typeof message === 'string') return message
  }
  return String(err)
}
