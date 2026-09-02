/**
 * Generic per-attempt outcome tracking for scripts that loop over many
 * independent units of work (companies, scoring pairs, etc.) where one
 * bad item must not be allowed to look identical to "everything worked"
 * or to "nothing worked at all" in the final report.
 */
export interface AttemptResult {
  label: string
  status: 'success' | 'failure'
  detail?: string
}

export type RunStatus = 'success' | 'partial' | 'failed' | 'empty'

export interface RunSummary {
  status: RunStatus
  total: number
  succeeded: number
  failed: number
}

/**
 * Classifies a batch of independent attempts:
 *   - 'empty'   nothing was attempted at all (e.g. no companies configured)
 *   - 'success' every attempt succeeded (a successful attempt that found
 *               zero items is still a success -- that distinction belongs
 *               to the caller's own item counts, not this function)
 *   - 'failed'  every attempt failed -- nothing could be processed
 *   - 'partial' some succeeded, some failed
 *
 * Deliberately does not decide what a caller should DO with each status
 * (e.g. whether 'empty' should exit non-zero) -- that differs by call
 * site (an empty company list is a misconfiguration; zero members to
 * score against is a legitimate state of the world).
 */
export function summarizeRun(results: AttemptResult[]): RunSummary {
  const total = results.length
  const succeeded = results.filter((r) => r.status === 'success').length
  const failed = total - succeeded

  let status: RunStatus
  if (total === 0) status = 'empty'
  else if (failed === 0) status = 'success'
  else if (succeeded === 0) status = 'failed'
  else status = 'partial'

  return { status, total, succeeded, failed }
}
