import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { NotificationsPage } from './NotificationsPage'
import type { Notification } from '@/types'

// N3 item 1 (corrected post-QA): notification.link used to be rendered as a
// raw <a href> with no scheme validation. The original fix used
// isSafeHttpUrl, which rejects every relative in-app route -- a functional
// regression, since real notification-producing DB triggers write relative
// links like '/strategist/applications' (see
// supabase/migrations/20260821010000_interviews_reports_profile_upgrade.sql).
// This regression-tests isSafeAppLink instead, which accepts both an
// absolute safe URL and a same-origin relative path -- not full
// NotificationsPage fidelity.

const { mockGetNotifications, mockMarkRead, mockMarkAllRead } = vi.hoisted(() => ({
  mockGetNotifications: vi.fn(),
  mockMarkRead: vi.fn(),
  mockMarkAllRead: vi.fn(),
}))

vi.mock('@/lib/communication', () => ({
  getNotifications: mockGetNotifications,
  markNotificationRead: mockMarkRead,
  markAllNotificationsRead: mockMarkAllRead,
}))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}))

// NotificationsPage renders inside the real MemberLayout, which fires its
// own supabase queries (unread counts, membership plan) on mount -- mock
// those to harmless empty results so this test only exercises the page's
// own unsafe-href-sink fix, not MemberLayout fidelity.
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

vi.mock('@/lib/supabase', () => ({
  supabase: { from: () => chainableEmptyBuilder() },
}))

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 'n1',
    user_id: 'user-1',
    notification_type: 'message',
    title: 'You have a new message',
    body: null,
    link: null,
    is_read: false,
    created_at: new Date().toISOString(),
    ...overrides,
  } as Notification
}

function renderPage() {
  return render(
    <MemoryRouter>
      <NotificationsPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('NotificationsPage - unsafe href sink (N3 item 1)', () => {
  it('renders a "View" link for a safe https notification.link', async () => {
    mockGetNotifications.mockResolvedValue([makeNotification({ link: 'https://example.com/interviews/1' })])

    renderPage()

    const link = await screen.findByRole('link', { name: /View/ })
    expect(link).toHaveAttribute('href', 'https://example.com/interviews/1')
  })

  it('renders a "View" link for a same-origin relative in-app route (e.g. from a DB trigger)', async () => {
    mockGetNotifications.mockResolvedValue([makeNotification({ link: '/strategist/applications' })])

    renderPage()

    const link = await screen.findByRole('link', { name: /View/ })
    expect(link).toHaveAttribute('href', '/strategist/applications')
  })

  it('hides the "View" link entirely for a javascript: notification.link', async () => {
    mockGetNotifications.mockResolvedValue([makeNotification({ link: 'javascript:alert(1)' })])

    renderPage()

    await waitFor(() => expect(screen.getByText('You have a new message')).toBeInTheDocument())
    expect(screen.queryByRole('link', { name: /View/ })).not.toBeInTheDocument()
  })

  it('hides the "View" link for a protocol-relative notification.link (off-origin bypass)', async () => {
    mockGetNotifications.mockResolvedValue([makeNotification({ link: '//evil.com' })])

    renderPage()

    await waitFor(() => expect(screen.getByText('You have a new message')).toBeInTheDocument())
    expect(screen.queryByRole('link', { name: /View/ })).not.toBeInTheDocument()
  })

  it('hides the "View" link for a tab-smuggled off-origin bypass (WHATWG URL strips tabs before parsing)', async () => {
    mockGetNotifications.mockResolvedValue([makeNotification({ link: '/\t/evil.com' })])

    renderPage()

    await waitFor(() => expect(screen.getByText('You have a new message')).toBeInTheDocument())
    expect(screen.queryByRole('link', { name: /View/ })).not.toBeInTheDocument()
  })

  it('hides the "View" link for a null notification.link', async () => {
    mockGetNotifications.mockResolvedValue([makeNotification({ link: null })])

    renderPage()

    await waitFor(() => expect(screen.getByText('You have a new message')).toBeInTheDocument())
    expect(screen.queryByRole('link', { name: /View/ })).not.toBeInTheDocument()
  })
})
