import { describe, it, expect } from 'vitest'
import { summarizeRun } from './runSummary'

describe('summarizeRun', () => {
  it('returns status "empty" when nothing was attempted', () => {
    const summary = summarizeRun([])
    expect(summary).toEqual({ status: 'empty', total: 0, succeeded: 0, failed: 0 })
  })

  it('returns status "success" when every attempt succeeded', () => {
    const summary = summarizeRun([
      { label: 'greenhouse/acme', status: 'success' },
      { label: 'lever/globex', status: 'success' },
    ])
    expect(summary).toEqual({ status: 'success', total: 2, succeeded: 2, failed: 0 })
  })

  it('returns status "failed" when every attempt failed (nothing could be processed)', () => {
    const summary = summarizeRun([
      { label: 'greenhouse/acme', status: 'failure', detail: '404' },
      { label: 'lever/globex', status: 'failure', detail: 'timeout' },
    ])
    expect(summary).toEqual({ status: 'failed', total: 2, succeeded: 0, failed: 2 })
  })

  it('returns status "partial" when some attempts succeeded and some failed', () => {
    const summary = summarizeRun([
      { label: 'greenhouse/acme', status: 'success' },
      { label: 'lever/globex', status: 'failure', detail: '404' },
    ])
    expect(summary).toEqual({ status: 'partial', total: 2, succeeded: 1, failed: 1 })
  })

  it('a single successful attempt with zero items found is still "success", not a failure', () => {
    // Legitimate zero-jobs-found is not the same thing as a failed fetch --
    // callers report that distinction via job counts elsewhere; a
    // successful attempt that happened to find nothing is still 'success'.
    const summary = summarizeRun([{ label: 'greenhouse/acme', status: 'success' }])
    expect(summary.status).toBe('success')
  })
})
