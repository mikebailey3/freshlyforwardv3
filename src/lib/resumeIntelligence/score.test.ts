import { describe, expect, it } from 'vitest'
import { scoreFromFindings } from './score'
import type { ResumeFinding } from '@/types/resume'

const finding = (severity: ResumeFinding['severity']): ResumeFinding => ({
  code: `TEST_${severity.toUpperCase()}`,
  severity,
  meaning: 'test',
  evidence: 'test',
  action: 'test',
})

describe('scoreFromFindings', () => {
  it('returns 100 with no findings', () => {
    expect(scoreFromFindings([])).toBe(100)
  })

  it('deducts 25 per error, 10 per warning, 3 per info', () => {
    expect(scoreFromFindings([finding('error')])).toBe(75)
    expect(scoreFromFindings([finding('warning')])).toBe(90)
    expect(scoreFromFindings([finding('info')])).toBe(97)
  })

  it('sums penalties across multiple findings', () => {
    expect(scoreFromFindings([finding('error'), finding('warning'), finding('info')])).toBe(62)
  })

  it('clamps at 0 and never goes negative', () => {
    expect(scoreFromFindings([finding('error'), finding('error'), finding('error'), finding('error'), finding('error')])).toBe(0)
  })
})
