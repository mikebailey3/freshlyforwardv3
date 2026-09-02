// src/pages/CheckoutPage.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { CheckoutPage } from './CheckoutPage'

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1' }, session: { access_token: 'test-access-token' } }),
}))

vi.mock('@/lib/profile', () => ({
  ensureProfile: vi.fn().mockResolvedValue(null),
}))

const testPlan = {
  id: 'plan-1',
  slug: 'career-growth',
  name: 'Career Growth',
  description: 'Growth plan',
  price_cents: 9900,
  interval: 'month',
  features: ['Feature A'],
  badge: null,
}

// Update is a spy so tests can assert this component never calls it
// directly for the fallback path (the server now performs that write).
const { mockUpdate } = vi.hoisted(() => ({ mockUpdate: vi.fn() }))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn().mockImplementation((table: string) => {
      const builder: Record<string, unknown> = {}
      const chain = () => builder
      builder.select = chain
      builder.eq = chain
      builder.update = (...args: unknown[]) => {
        mockUpdate(table, ...args)
        return builder
      }
      builder.maybeSingle = () => {
        if (table === 'membership_plans') {
          return Promise.resolve({ data: testPlan, error: null })
        }
        return Promise.resolve({ data: null, error: null })
      }
      return builder
    }),
  },
}))

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/checkout/career-growth']}>
      <Routes>
        <Route path="/checkout/:planSlug" element={<CheckoutPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('fetch', vi.fn())
})

describe('CheckoutPage', () => {
  it('on the fallback path, navigates to /onboarding and never updates member_profiles itself (server now performs that write)', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ fallback: true }),
    } as Response)

    renderPage()

    await waitFor(() => expect(screen.getByText('Checkout')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /Complete Checkout/i }))

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/onboarding'))
    expect(mockUpdate).not.toHaveBeenCalled()

    // The real session token -- not the anon key -- must identify the
    // caller, since the edge function's auth.getUser() can't resolve a
    // user from the anon key alone.
    const [, options] = vi.mocked(fetch).mock.calls[0]
    const headers = options?.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer test-access-token')
  })

  it('redirects to the Stripe URL when the server returns one, without touching member_profiles', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ url: 'https://stripe.example/session' }),
    } as Response)

    const originalLocation = window.location
    // @ts-expect-error -- redefining window.location for this test only
    delete window.location
    // @ts-expect-error -- minimal stub, only `href` is used by the component
    window.location = { href: '' }

    renderPage()

    await waitFor(() => expect(screen.getByText('Checkout')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /Complete Checkout/i }))

    await waitFor(() => expect(window.location.href).toBe('https://stripe.example/session'))
    expect(mockUpdate).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()

    // @ts-expect-error -- restoring the original window.location object
    window.location = originalLocation
  })
})
