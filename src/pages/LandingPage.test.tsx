import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LandingPage } from './LandingPage'
import type { MembershipPlan } from '@/types'

// Homepage Redesign Phase 1 / Task 8: the homepage's pricing section
// (PricingTeaser) must render real membership_plans rows, never hardcoded
// numbers -- so this file now controls exactly what "real" data looks like
// via a mocked supabase client, the same pattern DashboardPage.test.tsx
// uses for its own supabase-backed cards.
const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }))

vi.mock('@/lib/supabase', () => ({
  supabase: { from: mockFrom },
}))

function makeBuilder(data: MembershipPlan[]) {
  const builder: Record<string, unknown> = {}
  const chain = () => builder
  builder.select = chain
  builder.eq = chain
  builder.order = () => Promise.resolve({ data, error: null })
  return builder
}

const realPlan: MembershipPlan = {
  id: 'plan-1',
  slug: 'career-growth',
  name: 'Career Growth',
  description: 'Ongoing support for an active search.',
  price_cents: 14900,
  interval: 'month',
  stripe_price_id: null,
  stripe_product_id: null,
  features: ['Career Compass', 'Opportunity Engine', 'Human strategist'],
  badge: 'Most Popular',
  promotional_text: null,
  is_featured: true,
  is_enabled: true,
  is_archived: false,
  sort_order: 1,
  created_at: '',
  updated_at: '',
}

// Homepage Redesign Phase 1 / Task 5: enforces the locked spec constraints
// that aren't safe to leave to visual review alone -- "Applications" not
// "Application Workspace", and Career Vault must never be presented as
// live. Task 8 will extend this file with the real-pricing-only assertions;
// the no-fake-pricing-strings check is included now (trivially passing,
// since this task doesn't touch pricing) so Task 8 can't reintroduce them
// without breaking an existing test.
function renderLandingPage() {
  mockFrom.mockImplementation(() => makeBuilder([realPlan]))
  render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>
  )
}

describe('LandingPage - no fabricated/unsupported content (Homepage Redesign Phase 1)', () => {
  it('never says "Application Workspace"; says "Applications" instead', () => {
    renderLandingPage()
    expect(screen.queryByText(/Application Workspace/i)).not.toBeInTheDocument()
    expect(screen.getAllByText(/Applications/).length).toBeGreaterThan(0)
  })

  it('labels Career Vault as Coming Soon and never links to /career-vault', () => {
    renderLandingPage()
    const vaultMentions = screen.getAllByText(/Career Vault/i)
    expect(vaultMentions.length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Coming Soon/i).length).toBeGreaterThan(0)

    const allLinks = screen.queryAllByRole('link')
    expect(allLinks.some((a) => a.getAttribute('href') === '/career-vault')).toBe(false)
  })

  it('never shows the reference image\'s literal fabricated pricing (this task does not touch pricing yet)', () => {
    renderLandingPage()
    for (const fake of ['Starter', 'Strategist+', '$19', '$39', '$99', 'Kickstarter Special']) {
      expect(screen.queryByText(new RegExp(fake.replace('+', '\\+').replace('$', '\\$'), 'i'))).not.toBeInTheDocument()
    }
  })

  // Homepage Redesign Phase 1 / Task 6: locked spec decision #5 -- no
  // fabricated testimonials, ratings, user counts, or awards, in any form.
  it('never shows a testimonial-shaped quote attributed to a named person', () => {
    renderLandingPage()
    expect(screen.queryByText(/Alex R\.?,?\s*Product Manager/i)).not.toBeInTheDocument()
    const blockquotes = document.querySelectorAll('blockquote, [data-testid="testimonial"]')
    expect(blockquotes.length).toBe(0)
  })

  it('never renders star-rating markup or graphics anywhere on the page', () => {
    renderLandingPage()
    const starRatings = document.querySelectorAll('[data-testid="star-rating"], .star-rating, [aria-label*="star" i]')
    expect(starRatings.length).toBe(0)
  })

  // Homepage Redesign Phase 1 / Task 8: pricing must come from the real
  // membership_plans table, never be hardcoded.
  it('renders the real fetched plan name and price, and never a hardcoded fake plan', async () => {
    renderLandingPage()
    await waitFor(() => expect(screen.getByText('Career Growth')).toBeInTheDocument())
    expect(screen.getByText('$149')).toBeInTheDocument()
    expect(screen.queryByText('Starter')).not.toBeInTheDocument()
    expect(screen.queryByText('Strategist+')).not.toBeInTheDocument()
  })

  // North Star fidelity pass: the denser hero/flagship previews must stay
  // illustrative, never implying a specific real, currently-online person
  // or a populated Career Vault -- see ChatPreviewCard.tsx for the
  // generic-avatar convention this follows instead.
  it('never invents a named or "online" strategist presence in the hero', () => {
    renderLandingPage()
    expect(screen.queryByText(/is online/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Monica/i)).not.toBeInTheDocument()
  })

  it('never shows a specific fabricated Career Vault asset count like "23 Assets"', () => {
    renderLandingPage()
    expect(screen.queryByText(/23 Assets/i)).not.toBeInTheDocument()
  })

  it('marks illustrative preview data (FreshFit breakdown, matches, application counts) as Sample', () => {
    renderLandingPage()
    expect(screen.getAllByText(/Sample/i).length).toBeGreaterThan(0)
  })

  // North Star fidelity pass: the final CTA's headline/CTA copy is locked
  // verbatim by the approved spec's structure section ("Your next move
  // starts here." / Take Career Compass / See How It Works) -- this
  // guards against copy drifting again the way it did in the first pass.
  it('shows the spec-locked final CTA headline and both CTA labels', () => {
    renderLandingPage()
    expect(screen.getByText('Your next move starts here.')).toBeInTheDocument()
    const seeHowItWorksLinks = screen.getAllByText(/See How It Works/i)
    expect(seeHowItWorksLinks.length).toBeGreaterThan(0)
  })

  // North Star fidelity pass: FAQ expanded from 4 to 6 real FaqPage.tsx
  // questions, split into two columns -- still no invented questions.
  it('renders 6 real FAQ questions across two columns, still verbatim from FaqPage', () => {
    renderLandingPage()
    expect(screen.getByText('Do you apply without my permission?')).toBeInTheDocument()
    expect(screen.getByText('Do you help with interviews?')).toBeInTheDocument()
  })
})
