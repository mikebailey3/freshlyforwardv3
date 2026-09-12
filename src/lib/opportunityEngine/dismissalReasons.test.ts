import { describe, expect, it } from 'vitest'
import { DISMISSAL_REASONS, DISMISSAL_REASON_LABELS, isDismissalReason } from './dismissalReasons'

describe('dismissalReasons', () => {
  it('has a human-readable label for every reason', () => {
    for (const reason of DISMISSAL_REASONS) {
      expect(DISMISSAL_REASON_LABELS[reason]).toBeTruthy()
    }
  })

  it('isDismissalReason accepts every known reason', () => {
    for (const reason of DISMISSAL_REASONS) {
      expect(isDismissalReason(reason)).toBe(true)
    }
  })

  it('isDismissalReason rejects an arbitrary/unknown string -- never fabricates a match', () => {
    expect(isDismissalReason('made_up_reason')).toBe(false)
    expect(isDismissalReason('')).toBe(false)
  })
})
