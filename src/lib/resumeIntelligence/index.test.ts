import { describe, expect, it } from 'vitest'
import { computeResumeIntelligence } from './index'
import type { ResumeContentInput } from './types'
import type { ResumeDimensionResult, TargetRoleAlignmentProvider, EvidenceCoverageProvider } from '@/types/resume'

const COMPLETE_CONTENT: ResumeContentInput = {
  fullName: 'Jamie Rivera',
  email: 'jamie.rivera@example.com',
  phone: '555-123-4567',
  location: 'Denver, CO',
  summary: 'Product leader focused on measurable outcomes.',
  employment: [
    { company: 'Acme Co', title: 'Product Manager', start_date: '2021-01', end_date: null, current: true, description: 'Grew revenue by 30% and led a team of 8.' },
  ],
  education: [
    { institution: 'State University', degree: 'B.A.', field: 'Economics', graduation_year: '2015' },
  ],
  skills: ['product strategy', 'roadmapping', 'stakeholder management', 'sql', 'a/b testing'],
}

describe('computeResumeIntelligence', () => {
  it('returns exactly the six locked dimensions, in a stable order', async () => {
    const result = await computeResumeIntelligence(COMPLETE_CONTENT, { userId: 'user-1' })
    expect(result.dimensions.map((d) => d.key)).toEqual([
      'atsReadability',
      'structuralQuality',
      'contentStrength',
      'quantification',
      'targetRoleAlignment',
      'evidenceCoverage',
    ])
  })

  it('never produces a top-level blended score field', async () => {
    const result = await computeResumeIntelligence(COMPLETE_CONTENT, { userId: 'user-1' })
    expect(result).not.toHaveProperty('score')
  })

  it('defaults alignment and evidence coverage to unavailable when no providers are injected', async () => {
    const result = await computeResumeIntelligence(COMPLETE_CONTENT, { userId: 'user-1' })
    const alignment = result.dimensions.find((d) => d.key === 'targetRoleAlignment')
    const evidence = result.dimensions.find((d) => d.key === 'evidenceCoverage')
    expect(alignment?.status).toBe('unavailable')
    expect(evidence?.status).toBe('unavailable')
  })

  it('uses an injected alignment/evidence provider instead of the null defaults (DI)', async () => {
    const scoredAlignment: ResumeDimensionResult = {
      key: 'targetRoleAlignment', label: 'Target Role Alignment', status: 'scored', score: 82, findings: [],
    }
    const scoredEvidence: ResumeDimensionResult = {
      key: 'evidenceCoverage', label: 'Evidence Coverage', status: 'scored', score: 60, findings: [],
    }
    const fakeAlignmentProvider: TargetRoleAlignmentProvider = { score: () => Promise.resolve(scoredAlignment) }
    const fakeEvidenceProvider: EvidenceCoverageProvider = { score: () => Promise.resolve(scoredEvidence) }

    const result = await computeResumeIntelligence(COMPLETE_CONTENT, {
      userId: 'user-1',
      alignmentProvider: fakeAlignmentProvider,
      evidenceProvider: fakeEvidenceProvider,
    })

    expect(result.dimensions.find((d) => d.key === 'targetRoleAlignment')).toEqual(scoredAlignment)
    expect(result.dimensions.find((d) => d.key === 'evidenceCoverage')).toEqual(scoredEvidence)
  })

  it('scores the four deterministic dimensions from real resume content', async () => {
    const result = await computeResumeIntelligence(COMPLETE_CONTENT, { userId: 'user-1' })
    const deterministic = result.dimensions.filter((d) => d.status === 'scored')
    expect(deterministic).toHaveLength(4)
    for (const dimension of deterministic) {
      expect(dimension.score).toBe(100)
    }
  })
})
