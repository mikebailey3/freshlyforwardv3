import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { SiteHeader, SiteFooter } from './PublicLayout'

// Task 1 (Homepage Redesign Phase 1): the public nav is restructured from a
// flat link list to the owner-approved structure -- Product (dropdown) /
// How It Works / Career Compass / Pricing / Resources (dropdown) / Sign In
// -- per docs/superpowers/specs/2026-09-02-homepage-design-north-star.md's
// locked decision #3. Every real route the old flat nav exposed must still
// be reachable somewhere (header or footer), logged out or in.

const mockSignOut = vi.fn().mockResolvedValue(undefined)

vi.mock('@/context/AuthContext', () => ({
  useAuth: vi.fn(),
}))

import { useAuth } from '@/context/AuthContext'

beforeEach(() => {
  vi.mocked(useAuth).mockReturnValue({
    user: null,
    signOut: mockSignOut,
  } as unknown as ReturnType<typeof useAuth>)
})

function renderHeader() {
  return render(
    <MemoryRouter>
      <SiteHeader />
    </MemoryRouter>,
  )
}

function renderFooter() {
  return render(
    <MemoryRouter>
      <SiteFooter />
    </MemoryRouter>,
  )
}

const REAL_ROUTES = [
  '/how-it-works',
  '/career-compass',
  '/services',
  '/why-freshlyforward',
  '/pricing',
  '/forward-feed',
  '/about',
  '/signin',
  '/signup',
]

describe('SiteHeader - Product/Resources dropdown restructure (logged out)', () => {
  it('renders exactly the approved top-level items: Product, How It Works, Career Compass, Pricing, Resources, Sign In', () => {
    renderHeader()

    expect(screen.getByRole('button', { name: /product/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'How It Works' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Career Compass' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Pricing' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /resources/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /sign in|log in/i })).toBeInTheDocument()
  })

  it('opens the Product dropdown to reveal Services and Why FreshlyForward links', () => {
    renderHeader()

    fireEvent.click(screen.getByRole('button', { name: /product/i }))

    expect(screen.getByRole('link', { name: 'Services' })).toHaveAttribute('href', '/services')
    expect(screen.getByRole('link', { name: 'Why FreshlyForward' })).toHaveAttribute('href', '/why-freshlyforward')
  })

  it('opens the Resources dropdown to reveal The Forward Feed and About links', () => {
    renderHeader()

    fireEvent.click(screen.getByRole('button', { name: /resources/i }))

    expect(screen.getByRole('link', { name: 'The Forward Feed' })).toHaveAttribute('href', '/forward-feed')
    expect(screen.getByRole('link', { name: 'About' })).toHaveAttribute('href', '/about')
  })

  it('the Product and Resources dropdown triggers have proper ARIA affordances', () => {
    renderHeader()

    const productButton = screen.getByRole('button', { name: /product/i })
    expect(productButton).toHaveAttribute('aria-haspopup', 'true')
    expect(productButton).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(productButton)
    expect(productButton).toHaveAttribute('aria-expanded', 'true')
  })
})

describe('SiteHeader - logged-in state unchanged', () => {
  it('shows Dashboard + Sign Out instead of Sign In when a user is present', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'user-1' },
      signOut: mockSignOut,
    } as unknown as ReturnType<typeof useAuth>)

    renderHeader()

    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/dashboard')
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /sign in|log in/i })).not.toBeInTheDocument()
  })
})

describe('Route coverage - nothing orphaned by the restructure', () => {
  it('every real route from the old flat nav is reachable somewhere in the header (open) or footer', () => {
    const { container: headerContainer } = renderHeader()
    fireEvent.click(screen.getByRole('button', { name: /product/i }))
    fireEvent.click(screen.getByRole('button', { name: /resources/i }))
    renderFooter()

    const allHrefs = new Set(
      Array.from(document.querySelectorAll('a')).map((a) => a.getAttribute('href')),
    )

    for (const route of REAL_ROUTES) {
      expect(allHrefs.has(route)).toBe(true)
    }
    void headerContainer
  })
})
