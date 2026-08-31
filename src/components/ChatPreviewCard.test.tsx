import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChatPreviewCard, type ChatPreviewMessage } from './ChatPreviewCard'

const messages: ChatPreviewMessage[] = [
  { from: 'strategist', text: 'What made your last role feel right?' },
  { from: 'member', text: 'Good scope, but I want more ownership.' },
]

describe('ChatPreviewCard', () => {
  it('renders the label, a Sample badge, and every message', () => {
    render(<ChatPreviewCard label="Sample intake conversation" messages={messages} />)
    expect(screen.getByText('Sample intake conversation')).toBeInTheDocument()
    expect(screen.getByText('Sample')).toBeInTheDocument()
    expect(screen.getByText('What made your last role feel right?')).toBeInTheDocument()
    expect(screen.getByText('Good scope, but I want more ownership.')).toBeInTheDocument()
  })

  it('renders zero messages without error', () => {
    render(<ChatPreviewCard label="Empty" messages={[]} />)
    expect(screen.getByText('Empty')).toBeInTheDocument()
  })
})
