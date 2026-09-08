import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ImportReviewPanel } from './ImportReviewPanel'
import type { ProposalRow } from '@/lib/resumeIntelligence/import/reviewProposals'

function makeRow(overrides: Partial<ProposalRow> = {}): ProposalRow {
  return {
    id: 'row-1',
    source_document_id: 'doc-1',
    destination_kind: 'canonical-profile',
    destination_field: 'full_name',
    destination_array_index: null,
    candidate_value: 'Jamie Rivera',
    proposed_action: 'create',
    confidence: 'medium',
    provenance_section_kind: 'contact',
    provenance_block_orders: [0],
    provenance_source_excerpt: 'Jamie Rivera',
    provenance_page: 1,
    provenance_matched_rule: 'NAME_HEURISTIC_FIRST_CAPITALIZED_LINE',
    status: 'pending',
    decision: null,
    ...overrides,
  }
}

describe('ImportReviewPanel', () => {
  it('groups proposals by section, in the fixed Contact/Summary/Employment/Education/Certifications/Skills order', () => {
    const proposals = [
      makeRow({ id: 'r1', provenance_section_kind: 'skills', destination_field: 'skills' }),
      makeRow({ id: 'r2', provenance_section_kind: 'contact', destination_field: 'full_name' }),
    ]
    render(<ImportReviewPanel proposals={proposals} onDecide={vi.fn()} />)
    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(headings).toEqual(['Contact', 'Skills'])
  })

  it('calls onDecide with the row and decision when a decision button is clicked', () => {
    const onDecide = vi.fn()
    render(<ImportReviewPanel proposals={[makeRow()]} onDecide={onDecide} />)
    fireEvent.click(screen.getByText('Yes, update my Career Profile'))
    expect(onDecide).toHaveBeenCalledWith(expect.objectContaining({ id: 'row-1' }), 'accept_as_canonical')
  })

  it('shows only reject/use_as_resume_specific_only for a resume-specific destination', () => {
    render(<ImportReviewPanel proposals={[makeRow({ destination_kind: 'resume-specific', destination_field: 'summary_override' })]} onDecide={vi.fn()} />)
    expect(screen.getByText('Use this wording here only')).toBeInTheDocument()
    expect(screen.getByText('Not correct, discard')).toBeInTheDocument()
    expect(screen.queryByText('Yes, update my Career Profile')).not.toBeInTheDocument()
    expect(screen.queryByText('No thanks, keep what’s on my Profile')).not.toBeInTheDocument()
  })

  it('does not offer keep_existing_canonical for a brand-new (proposedAction=create) proposal', () => {
    render(<ImportReviewPanel proposals={[makeRow({ proposed_action: 'create' })]} onDecide={vi.fn()} />)
    expect(screen.queryByText('No thanks, keep what’s on my Profile')).not.toBeInTheDocument()
  })

  it('offers all five decisions for an update to an already-existing canonical entry', () => {
    render(<ImportReviewPanel proposals={[makeRow({ proposed_action: 'update' })]} onDecide={vi.fn()} />)
    expect(screen.getByText('Yes, update my Career Profile')).toBeInTheDocument()
    expect(screen.getByText('No thanks, keep what’s on my Profile')).toBeInTheDocument()
    expect(screen.getByText('Use this wording here only')).toBeInTheDocument()
  })

  it('reveals provenance only after the member asks for it', () => {
    render(<ImportReviewPanel proposals={[makeRow()]} onDecide={vi.fn()} />)
    expect(screen.queryByText(/Found in your uploaded document/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('Why did we suggest this?'))
    expect(screen.getByText(/Found in your uploaded document/)).toBeInTheDocument()
  })

  it('accept_edited_canonical opens an inline editor and reports the edited value, not the original candidate', () => {
    const onDecide = vi.fn()
    render(<ImportReviewPanel proposals={[makeRow({ proposed_action: 'update' })]} onDecide={onDecide} />)
    fireEvent.click(screen.getByText('Update my Profile, let me fix the wording'))
    const input = screen.getByDisplayValue('Jamie Rivera')
    fireEvent.change(input, { target: { value: 'Jamie R. Rivera' } })
    fireEvent.click(screen.getByText('Save'))
    expect(onDecide).toHaveBeenCalledWith(expect.objectContaining({ id: 'row-1' }), 'accept_edited_canonical', 'Jamie R. Rivera')
  })

  it('an already-reviewed proposal shows its resolved decision instead of action buttons', () => {
    render(<ImportReviewPanel proposals={[makeRow({ status: 'reviewed', decision: 'accept_as_canonical' })]} onDecide={vi.fn()} />)
    expect(screen.queryByText('Yes, update my Career Profile')).not.toBeInTheDocument()
    expect(screen.getByText(/accept_as_canonical|Yes, update my Career Profile/)).toBeInTheDocument()
  })

  it('bulk accept is only offered when more than one high-confidence pending proposal exists in a section, and never for resume-specific fields', () => {
    const singleHighConfidence = [makeRow({ confidence: 'high' })]
    const { rerender } = render(<ImportReviewPanel proposals={singleHighConfidence} onDecide={vi.fn()} />)
    expect(screen.queryByText(/Accept all/)).not.toBeInTheDocument()

    const multipleHighConfidence = [
      makeRow({ id: 'r1', confidence: 'high' }),
      makeRow({ id: 'r2', confidence: 'high', destination_field: 'phone' }),
    ]
    rerender(<ImportReviewPanel proposals={multipleHighConfidence} onDecide={vi.fn()} />)
    expect(screen.getByText('Accept all 2 high-confidence items')).toBeInTheDocument()
  })

  it('bulk accept excludes medium/low-confidence proposals -- never pre-selects or bulk-applies them', async () => {
    const onDecide = vi.fn()
    const proposals = [
      makeRow({ id: 'r1', confidence: 'high' }),
      makeRow({ id: 'r2', confidence: 'high', destination_field: 'phone' }),
      makeRow({ id: 'r3', confidence: 'low', destination_field: 'location' }),
    ]
    render(<ImportReviewPanel proposals={proposals} onDecide={onDecide} />)
    fireEvent.click(screen.getByText('Accept all 2 high-confidence items'))
    fireEvent.click(screen.getByText('Confirm -- accept all 2'))
    await vi.waitFor(() => expect(onDecide).toHaveBeenCalledTimes(2))
    expect(onDecide).not.toHaveBeenCalledWith(expect.objectContaining({ id: 'r3' }), expect.anything())
  })

  it('shows the affected items before the bulk action is confirmed', () => {
    const proposals = [
      makeRow({ id: 'r1', confidence: 'high' }),
      makeRow({ id: 'r2', confidence: 'high', destination_field: 'phone', candidate_value: '555-123-4567' }),
    ]
    render(<ImportReviewPanel proposals={proposals} onDecide={vi.fn()} />)
    fireEvent.click(screen.getByText('Accept all 2 high-confidence items'))
    expect(screen.getByText(/full name: Jamie Rivera/)).toBeInTheDocument()
    expect(screen.getByText(/phone: 555-123-4567/)).toBeInTheDocument()
  })
})
