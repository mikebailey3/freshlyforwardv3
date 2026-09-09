import { describe, expect, it } from 'vitest'
import { computeResumeWorkflowStage } from './resumeWorkflowStage'
import type { ResumeWorkflowInput } from './resumeWorkflowStage'

function makeInput(overrides: Partial<ResumeWorkflowInput> = {}): ResumeWorkflowInput {
  return {
    hasResumeDocument: false,
    hasImportAttempt: false,
    pendingProposalCount: 0,
    hasMaster: false,
    hasAnalysisResult: false,
    ...overrides,
  }
}

describe('computeResumeWorkflowStage', () => {
  it('no_document: nothing uploaded, no Master yet', () => {
    expect(computeResumeWorkflowStage(makeInput())).toBe('no_document')
  })

  it('ready_to_import: a resume is uploaded but never scanned', () => {
    expect(computeResumeWorkflowStage(makeInput({ hasResumeDocument: true }))).toBe('ready_to_import')
  })

  it('needs_review: an import ran and left pending proposals', () => {
    expect(computeResumeWorkflowStage(makeInput({ hasResumeDocument: true, hasImportAttempt: true, pendingProposalCount: 3 }))).toBe('needs_review')
  })

  it('ready_for_master: every proposal has been reviewed, no Master exists yet', () => {
    expect(computeResumeWorkflowStage(makeInput({ hasResumeDocument: true, hasImportAttempt: true, pendingProposalCount: 0 }))).toBe('ready_for_master')
  })

  it('master_ready: a Master Resume exists and has not been analyzed this session', () => {
    expect(computeResumeWorkflowStage(makeInput({ hasMaster: true }))).toBe('master_ready')
  })

  it('analyzed: a Master Resume exists and analysis has been run', () => {
    expect(computeResumeWorkflowStage(makeInput({ hasMaster: true, hasAnalysisResult: true }))).toBe('analyzed')
  })

  it('needs_review always takes priority, even once a Master already exists (e.g. a re-scan)', () => {
    expect(computeResumeWorkflowStage(makeInput({ hasMaster: true, hasAnalysisResult: true, pendingProposalCount: 1 }))).toBe('needs_review')
  })

  it('a member can reach master_ready without ever uploading a document (Master built entirely from the existing Profile)', () => {
    expect(computeResumeWorkflowStage(makeInput({ hasResumeDocument: false, hasMaster: true }))).toBe('master_ready')
  })
})
