import { describe, expect, it } from 'vitest'
import { validateGroundedProposal } from './validateGroundedProposal'

const availableEvidence = ['Led a team of 5 engineers to ship the new checkout flow.', 'Managed a $2M annual budget.']

describe('validateGroundedProposal', () => {
  it('grounds a proposal whose evidenceReference is a literal substring of available evidence', () => {
    const result = validateGroundedProposal({ evidenceReference: 'Led a team of 5 engineers', isPurelyStylistic: false, availableEvidence })
    expect(result.grounded).toBe(true)
    expect(result.reason).toBeNull()
  })

  it('rejects a proposal whose evidenceReference does not literally appear in any available evidence -- anti-fabrication', () => {
    const result = validateGroundedProposal({ evidenceReference: 'Led a team of 50 engineers', isPurelyStylistic: false, availableEvidence })
    expect(result.grounded).toBe(false)
    expect(result.reason).toContain('literal substring')
  })

  it('rejects a null evidenceReference for a suggestion carrying new factual content', () => {
    const result = validateGroundedProposal({ evidenceReference: null, isPurelyStylistic: false, availableEvidence })
    expect(result.grounded).toBe(false)
    expect(result.reason).toContain('no evidence reference')
  })

  it('allows a null evidenceReference when the suggestion is explicitly marked purely stylistic', () => {
    const result = validateGroundedProposal({ evidenceReference: null, isPurelyStylistic: true, availableEvidence })
    expect(result.grounded).toBe(true)
  })

  it('rejects even a stylistic-looking claim if it is not marked isPurelyStylistic and has no evidence', () => {
    const result = validateGroundedProposal({ evidenceReference: null, isPurelyStylistic: false, availableEvidence: [] })
    expect(result.grounded).toBe(false)
  })
})
