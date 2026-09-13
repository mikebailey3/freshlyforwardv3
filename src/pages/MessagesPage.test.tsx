import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { MessagesPage } from './MessagesPage'

// N3 item 5: the "Unread" filter tab used to be byte-for-byte identical to
// "all" (`!c.is_archived`), and the badge's per-conversation unread count was
// derived from `messages` state that only ever holds the ACTIVE
// conversation's messages -- so every non-active conversation's badge was
// structurally always 0. This regression-tests the fix: an aggregate
// unread-count query grouped client-side into a map, shared by both the
// badge and the filter, for a conversation that is NOT the one auto-opened
// on load.

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }))

vi.mock('@/lib/supabase', () => ({ supabase: { from: mockFrom } }))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'member-1' }, profile: { plan_id: null } }),
}))

interface ConvRow {
  id: string
  member_id: string
  strategist_id: string | null
  last_message_at: string
  is_archived: boolean
  is_pinned: boolean
}

function chainableEmptyBuilder() {
  const builder: Record<string, unknown> = {}
  const chain = () => builder
  builder.select = chain
  builder.eq = chain
  builder.order = chain
  builder.maybeSingle = () => Promise.resolve({ data: null, error: null })
  builder.then = (resolve: (v: { data: unknown; count: number; error: null }) => void) =>
    resolve({ data: [], count: 0, error: null })
  return builder
}

function conversationsBuilder(rows: ConvRow[]) {
  const builder: Record<string, unknown> = {}
  const chain = () => builder
  builder.select = chain
  builder.or = chain
  builder.order = chain
  builder.then = (resolve: (v: { data: ConvRow[]; error: null }) => void) => resolve({ data: rows, error: null })
  return builder
}

/** `messages` table sees two distinct query shapes from this page:
 * `.select('conversation_id')...` (the new aggregate unread-count query) and
 * `.select('*')...` (loadMessages, for whichever conversation becomes
 * active). Branches on the `select()` argument to serve each correctly. */
function messagesBuilder(unreadConversationIdRows: Array<{ conversation_id: string }>, activeMessages: unknown[]) {
  return {
    select: (arg: string) => {
      const builder: Record<string, unknown> = {}
      const chain = () => builder
      builder.in = chain
      builder.neq = chain
      builder.eq = chain
      builder.order = chain
      const result =
        arg === 'conversation_id'
          ? { data: unreadConversationIdRows, error: null }
          : { data: activeMessages, error: null }
      builder.then = (resolve: (v: typeof result) => void) => resolve(result)
      return builder
    },
    update: () => {
      const builder: Record<string, unknown> = {}
      const chain = () => builder
      builder.in = chain
      builder.eq = chain
      builder.then = (resolve: (v: { error: null }) => void) => resolve({ error: null })
      return builder
    },
  }
}

function setUp(rows: ConvRow[], unreadRows: Array<{ conversation_id: string }>) {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'conversations') return conversationsBuilder(rows)
    if (table === 'messages') return messagesBuilder(unreadRows, [])
    return chainableEmptyBuilder()
  })
}

function renderPage() {
  return render(
    <MemoryRouter>
      <MessagesPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('MessagesPage - unread filter/badge correctness (N3 item 5)', () => {
  // conv-a sorts first (most recent) and is therefore auto-opened as the
  // active conversation on load -- it has NO unread messages. conv-b is
  // never opened and has 2 unread messages from the strategist. Before the
  // fix, conv-b's badge always read 0 (derived from `messages` state, which
  // only ever holds the active conversation's messages) and the "Unread"
  // tab was identical to "All". Conversation-list rows are <button>s whose
  // accessible name includes "Your Career Strategist" (both rows render
  // identical text) -- the active conversation's header panel also renders
  // that same string in a plain <span>, so queries below are scoped to
  // role: 'button' to exclude it.
  const convA: ConvRow = {
    id: 'conv-a', member_id: 'member-1', strategist_id: 'strategist-1',
    last_message_at: '2026-09-10T00:00:00.000Z', is_archived: false, is_pinned: false,
  }
  const convB: ConvRow = {
    id: 'conv-b', member_id: 'member-1', strategist_id: 'strategist-2',
    last_message_at: '2026-09-01T00:00:00.000Z', is_archived: false, is_pinned: false,
  }

  it('shows an unread badge on a conversation that was never opened', async () => {
    setUp([convA, convB], [{ conversation_id: 'conv-b' }, { conversation_id: 'conv-b' }])

    renderPage()

    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /Your Career Strategist/ })).toHaveLength(2),
    )
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('the "Unread" filter shows only the conversation with unread messages, not every non-archived conversation', async () => {
    setUp([convA, convB], [{ conversation_id: 'conv-b' }, { conversation_id: 'conv-b' }])

    renderPage()

    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /Your Career Strategist/ })).toHaveLength(2),
    )

    screen.getByRole('button', { name: 'unread' }).click()

    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /Your Career Strategist/ })).toHaveLength(1),
    )
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('the "Unread" filter shows nothing when no conversation has unread messages', async () => {
    setUp([convA, convB], [])

    renderPage()

    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /Your Career Strategist/ })).toHaveLength(2),
    )

    screen.getByRole('button', { name: 'unread' }).click()

    await waitFor(() => expect(screen.getByText('No conversations.')).toBeInTheDocument())
  })
})
