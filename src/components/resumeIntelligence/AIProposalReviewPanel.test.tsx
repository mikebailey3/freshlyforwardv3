import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AIProposalReviewPanel } from './AIProposalReviewPanel'
import type { PendingResumeContentSuggestion } from '@/lib/resumeIntelligence/ai/fetchPendingResumeContentSuggestions'

function makeSuggestion(overrides: Partial<PendingResumeContentSuggestion> = {}): PendingResumeContentSuggestion {
  return {
    id: 'sugg-1',
    targetField: 'summary',
    proposedText: 'Led cross-functional teams to deliver measurable growth.',
    evidenceReference: 'Led cross-functional teams',
    reasoning: 'Uses stronger, quantifiable language already supported by your Career Vault.',
    ...overrides,
  }
}

describe('AIProposalReviewPanel', () => {
  it('shows current wording, proposed wording, evidence, and the recommendation reason', () => {
    render(<AIProposalReviewPanel suggestion={makeSuggestion()} currentText="Old summary text." busy={false} onDecide={vi.fn()} />)
    expect(screen.getByText('Old summary text.')).toBeInTheDocument()
    expect(screen.getByText('Led cross-functional teams to deliver measurable growth.')).toBeInTheDocument()
    expect(screen.getByText(/Supporting evidence:/)).toBeInTheDocument()
    expect(screen.getByText(/Uses stronger, quantifiable language/)).toBeInTheDocument()
  })

  it('shows "(empty)" for current wording rather than blank when the field has no existing text', () => {
    render(<AIProposalReviewPanel suggestion={makeSuggestion()} currentText="" busy={false} onDecide={vi.fn()} />)
    expect(screen.getByText('(empty)')).toBeInTheDocument()
  })

  it('shows an honest "no new facts" message when evidenceReference is null (purely stylistic suggestion)', () => {
    render(<AIProposalReviewPanel suggestion={makeSuggestion({ evidenceReference: null })} currentText="x" busy={false} onDecide={vi.fn()} />)
    expect(screen.getByText(/purely stylistic wording change/)).toBeInTheDocument()
  })

  it('accepting calls onDecide with accept_as_canonical -- never applies anything itself', () => {
    const onDecide = vi.fn()
    render(<AIProposalReviewPanel suggestion={makeSuggestion()} currentText="x" busy={false} onDecide={onDecide} />)
    fireEvent.click(screen.getByText('Accept'))
    expect(onDecide).toHaveBeenCalledWith('accept_as_canonical')
  })

  it('rejecting calls onDecide with reject', () => {
    const onDecide = vi.fn()
    render(<AIProposalReviewPanel suggestion={makeSuggestion()} currentText="x" busy={false} onDecide={onDecide} />)
    fireEvent.click(screen.getByText('Reject'))
    expect(onDecide).toHaveBeenCalledWith('reject')
  })

  it('edit-then-accept requires an explicit second action and reports the edited text, not the original proposal', () => {
    const onDecide = vi.fn()
    render(<AIProposalReviewPanel suggestion={makeSuggestion()} currentText="x" busy={false} onDecide={onDecide} />)
    fireEvent.click(screen.getByText('Edit then accept'))
    const textarea = screen.getByDisplayValue('Led cross-functional teams to deliver measurable growth.')
    fireEvent.change(textarea, { target: { value: 'Led cross-functional teams to deliver 30% growth.' } })
    expect(onDecide).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('Save edit and accept'))
    expect(onDecide).toHaveBeenCalledWith('accept_edited_canonical', 'Led cross-functional teams to deliver 30% growth.')
  })

  it('disables every action while busy', () => {
    render(<AIProposalReviewPanel suggestion={makeSuggestion()} currentText="x" busy={true} onDecide={vi.fn()} />)
    expect(screen.getByText('Accept').closest('button')).toBeDisabled()
    expect(screen.getByText('Reject').closest('button')).toBeDisabled()
  })
})
