import { describe, expect, it } from 'vitest'
import { NullResumeAIContentProvider } from './resumeAIProvider'

describe('NullResumeAIContentProvider', () => {
  it('honestly reports unavailable, never fabricating a suggestion', async () => {
    const provider = new NullResumeAIContentProvider()
    const result = await provider.suggest({
      userId: 'user-1',
      resumeVersionId: 'v-1',
      targetField: 'summary',
      currentText: 'Existing summary.',
      availableEvidence: ['Existing summary.'],
    })

    expect(result.available).toBe(false)
    expect(result.proposedText).toBeNull()
    expect(result.evidenceReference).toBeNull()
    expect(result.reasoning).toBeNull()
    expect(result.unavailableReason).toBeTruthy()
  })
})
