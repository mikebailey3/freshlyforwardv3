import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CompletenessWidget } from './CompletenessWidget'

const fullyComplete = {
  hasCareerCompassResult: true,
  hasScopeEntry: true,
  hasResponsibilityTag: true,
  hasSkillEvidenceBeyondClaimed: true,
  hasEducationOrCertifications: true,
  hasTargetRoleAndTimeframe: true,
}

describe('CompletenessWidget', () => {
  it('shows no missing items when everything is complete', () => {
    render(<CompletenessWidget input={fullyComplete} />)
    expect(screen.queryByText('Professional scope on at least one role')).not.toBeInTheDocument()
  })

  it('lists specific missing items for a partial profile', () => {
    render(<CompletenessWidget input={{ ...fullyComplete, hasScopeEntry: false }} />)
    expect(screen.getByText('Professional scope on at least one role')).toBeInTheDocument()
  })
})
