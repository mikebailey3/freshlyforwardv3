import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FreshFitDetails } from './FreshFitDetails'
import type { JobMatchScoreBreakdown } from '@/types'

const legacyBreakdown: JobMatchScoreBreakdown = {
  skillsCoverage: 40, roleRelevance: 10, locationFit: 10, keywordDensity: 5,
}

const v2Breakdown: JobMatchScoreBreakdown = {
  skillsCoverage: 40, roleRelevance: 10, locationFit: 10, keywordDensity: 5,
  v2: {
    tier: 'good',
    confidence: 'high',
    dimensions: [
      {
        key: 'skillsEvidence', label: 'Skills & Evidence', score: 60, weight: 0.4, status: 'moderate',
        explanation: 'Matched on 2 skill(s).', evidence: ['sql'], gaps: ['python'], unknowns: ['aws'], improvementLink: null,
      },
    ],
    hardConstraints: [
      { key: 'compensationFloor', label: 'Compensation Floor', status: 'unknown', reason: '' },
    ],
    unknowns: ['aws'],
    recommendation: { key: 'worth_a_look', headline: 'Worth a look', detail: 'A reasonably good fit.' },
  },
}

describe('FreshFitDetails', () => {
  it('renders nothing for a legacy (pre-2.0) breakdown with no v2 data', () => {
    const { container } = render(<FreshFitDetails breakdown={legacyBreakdown} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the recommendation headline and per-dimension gaps/unknowns for a v2 breakdown', () => {
    render(<FreshFitDetails breakdown={v2Breakdown} />)
    expect(screen.getByText('Worth a look')).toBeInTheDocument()
    expect(screen.getByText(/python/)).toBeInTheDocument()
    expect(screen.getByText(/aws/)).toBeInTheDocument()
  })

  it('shows a "worth reading first" warning only when a hard constraint is blocked', () => {
    render(<FreshFitDetails breakdown={v2Breakdown} />)
    expect(screen.queryByText('Worth reading first')).not.toBeInTheDocument()

    const blocked: JobMatchScoreBreakdown = {
      ...v2Breakdown,
      v2: {
        ...v2Breakdown.v2!,
        hardConstraints: [{ key: 'remoteRequirement', label: 'Remote Requirement', status: 'hard_blocker', reason: 'On-site, no relocation.' }],
      },
    }
    render(<FreshFitDetails breakdown={blocked} />)
    expect(screen.getByText('Worth reading first')).toBeInTheDocument()
    expect(screen.getByText('On-site, no relocation.')).toBeInTheDocument()
  })
})
