import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AISuggestionsSection } from './AISuggestionsSection'
import type { PendingResumeContentSuggestion } from '@/lib/resumeIntelligence/ai/fetchPendingResumeContentSuggestions'

const fields = [{ targetField: 'summary', label: 'Summary' }]

describe('AISuggestionsSection', () => {
  it('requesting a suggestion calls onRequestSuggestion with the target field', () => {
    const onRequestSuggestion = vi.fn()
    render(<AISuggestionsSection suggestions={[]} busy={false} unavailableMessage={null} error={null} requestableFields={fields} currentTextByField={{}} onRequestSuggestion={onRequestSuggestion} onDecide={vi.fn()} />)
    fireEvent.click(screen.getByText('Get AI suggestion: Summary'))
    expect(onRequestSuggestion).toHaveBeenCalledWith('summary')
  })

  it('shows the honest unavailable message when the provider had nothing to propose -- never fakes a suggestion', () => {
    render(<AISuggestionsSection suggestions={[]} busy={false} unavailableMessage="No AI suggestion is available for this field right now." error={null} requestableFields={fields} currentTextByField={{}} onRequestSuggestion={vi.fn()} onDecide={vi.fn()} />)
    expect(screen.getByText('No AI suggestion is available for this field right now.')).toBeInTheDocument()
  })

  it('renders a pending suggestion with its matching current text, and forwards decisions with the right suggestion id', () => {
    const suggestion: PendingResumeContentSuggestion = { id: 'sugg-1', targetField: 'summary', proposedText: 'New summary', evidenceReference: 'evidence', reasoning: null }
    const onDecide = vi.fn()
    render(<AISuggestionsSection suggestions={[suggestion]} busy={false} unavailableMessage={null} error={null} requestableFields={fields} currentTextByField={{ summary: 'Old summary' }} onRequestSuggestion={vi.fn()} onDecide={onDecide} />)
    expect(screen.getByText('Old summary')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Accept'))
    expect(onDecide).toHaveBeenCalledWith('sugg-1', 'accept_as_canonical', undefined)
  })

  it('shows a plain empty-state message when there are no pending suggestions', () => {
    render(<AISuggestionsSection suggestions={[]} busy={false} unavailableMessage={null} error={null} requestableFields={fields} currentTextByField={{}} onRequestSuggestion={vi.fn()} onDecide={vi.fn()} />)
    expect(screen.getByText('No pending AI suggestions to review.')).toBeInTheDocument()
  })

  it('surfaces an error message distinctly from the honest-unavailable message', () => {
    render(<AISuggestionsSection suggestions={[]} busy={false} unavailableMessage={null} error="Could not save the suggestion." requestableFields={fields} currentTextByField={{}} onRequestSuggestion={vi.fn()} onDecide={vi.fn()} />)
    expect(screen.getByText('Could not save the suggestion.')).toBeInTheDocument()
  })
})
