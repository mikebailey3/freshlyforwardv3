import { describe, it, expect } from 'vitest'
import { scoreCareerDirectionDimension } from './careerDirection'

describe('scoreCareerDirectionDimension', () => {
  it('is no-data when the member has never completed Career Compass', () => {
    const result = scoreCareerDirectionDimension(null)
    expect(result.status).toBe('no-data')
    expect(result.unknowns.length).toBeGreaterThan(0)
    expect(result.improvementLink?.to).toBe('/career-compass')
  })

  it('passes through the readiness careerDirection score unmodified', () => {
    const result = scoreCareerDirectionDimension(82)
    expect(result.score).toBe(82)
    expect(result.status).toBe('strong')
  })

  it('reports weak status for a low career-direction score', () => {
    const result = scoreCareerDirectionDimension(20)
    expect(result.status).toBe('weak')
  })
})
