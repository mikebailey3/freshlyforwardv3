import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
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

  // Hero Redesign round 10 (Direction A): Career Vault left the hero
  // entirely as part of the approved simplification (owner sign-off) --
  // the snapshot card shows exactly two product signals (FreshFit/Top
  // Opportunity, Search Readiness), neither of which is Career Vault.
  // It's still represented in the Powerful Tools section further down
  // the page (flagshipFeatures), which is what this test now covers.
  it('mentions Career Vault as a live capability elsewhere on the page and never links to the not-yet-built /career-vault route', () => {
    renderLandingPage()
    const vaultMentions = screen.getAllByText(/Career Vault/i)
    expect(vaultMentions.length).toBeGreaterThan(0)
    expect(screen.queryByText(/Coming Soon/i)).not.toBeInTheDocument()

    const allLinks = screen.queryAllByRole('link')
    expect(allLinks.some((a) => a.getAttribute('href') === '/career-vault')).toBe(false)
  })

  // Hero Redesign round 10 (Direction A): the entire round 6-9 hero
  // composition (8 floating cards including a Career Vault one, the
  // winding path, the walking figure) is gone, replaced by one
  // ForwardOSSnapshotCard. This tripwire replaces the old hero-Career-
  // Vault-card test -- that testid no longer exists by design.
  it('renders exactly one ForwardOS snapshot card in the hero, not a collection of floating cards', () => {
    renderLandingPage()
    expect(screen.getByTestId('forwardos-snapshot-card')).toBeInTheDocument()
    expect(screen.queryByTestId('hero-career-vault-card')).not.toBeInTheDocument()
  })

  // Hero Redesign round 10 (Direction A): the snapshot card's exact
  // approved content -- primary proof (FreshFit/Top Opportunity), the one
  // secondary signal (Search Readiness -- the real product term, not the
  // owner's originally-suggested "Resume Strength", which doesn't exist
  // anywhere else in this codebase), the Next Action payoff, and the
  // quiet strategist line. Scoped with `within` since "Search Readiness"
  // etc. could plausibly appear elsewhere on the page.
  it('shows the ForwardOS snapshot card\'s exact approved content', () => {
    renderLandingPage()
    const card = within(screen.getByTestId('forwardos-snapshot-card'))
    expect(card.getByText('82')).toBeInTheDocument()
    expect(card.getByText('Strong Match')).toBeInTheDocument()
    expect(card.getByText('Senior Product Manager')).toBeInTheDocument()
    expect(card.getByText('Search Readiness')).toBeInTheDocument()
    expect(card.getByText('78')).toBeInTheDocument()
    expect(card.getByText(/Interview Practice/i)).toBeInTheDocument()
    expect(card.getByText(/strategist is here/i)).toBeInTheDocument()
    expect(card.getByText(/Illustrative preview/i)).toBeInTheDocument()
  })

  // Hero Redesign round 10 (Direction A): the owner was explicit that the
  // simplified card must not regrow into a feature collection -- Resume
  // Strength (an invented term, never used anywhere else in this
  // codebase) and Goal Progress (the other option offered) were both
  // decided against in favor of the real Search Readiness term.
  it('never reintroduces Resume Strength or Goal Progress into the hero', () => {
    renderLandingPage()
    const card = within(screen.getByTestId('forwardos-snapshot-card'))
    expect(card.queryByText(/Resume Strength/i)).not.toBeInTheDocument()
    expect(card.queryByText(/Goal Progress/i)).not.toBeInTheDocument()
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

  // How It Works density pass (spacing/sizing only): tripwire so a future
  // "just a padding tweak" can't silently drop a step or repoint the CTA
  // without a failing test -- these 5 steps and this route are locked.
  // Uses getAllByText (not getByText) because the Final CTA's journey
  // recap intentionally reuses these same 5 truthful labels a second time
  // further down the page (see the final-CTA milestone test below) --
  // this assertion only cares that each step still appears at least once.
  it('keeps all 5 How It Works steps and the Career Compass CTA link', () => {
    renderLandingPage()
    for (const step of ['Discover', 'Build', 'Find', 'Understand', 'Move Forward']) {
      expect(screen.getAllByText(step).length).toBeGreaterThan(0)
    }
    const journeyLink = screen.getByRole('link', { name: /Start Your Career Journey/i })
    expect(journeyLink).toHaveAttribute('href', '/career-compass')
  })

  // Final CTA multi-milestone path rebuild: tripwire so the closing
  // section can't silently lose its journey recap, invent a different
  // label set, or drift its CTA routes. Scoped with `within` to the Final
  // CTA <section> specifically -- "Discover", "Take Career Compass", and
  // "See How It Works" all also appear elsewhere on the page (How It Works
  // and the hero), so an unscoped query here would pass even if this
  // section's own copy of them were deleted or repointed. Reuses the exact
  // same 5 truthful stage names as How It Works (single source of truth in
  // LandingPage.tsx, not duplicated content) and ends on "Move Forward" --
  // never a guarantee-shaped word like "Offers" or "Hired".
  it('final CTA shows the 5-stage journey recap and both CTA routes, with no guarantee-shaped final label', () => {
    renderLandingPage()
    const finalCta = within(screen.getByRole('region', { name: /your next move starts here/i }))
    for (const step of ['Discover', 'Build', 'Find', 'Understand', 'Move Forward']) {
      expect(finalCta.getAllByText(step)).toHaveLength(1)
    }
    expect(finalCta.queryByText(/^Offers$/i)).not.toBeInTheDocument()
    expect(finalCta.queryByText(/^Hired$/i)).not.toBeInTheDocument()
    const compassLink = finalCta.getByRole('link', { name: /Take Career Compass/i })
    expect(compassLink).toHaveAttribute('href', '/career-compass')
    const howItWorksLink = finalCta.getByRole('link', { name: /See How It Works/i })
    expect(howItWorksLink).toHaveAttribute('href', '/how-it-works')
  })

  // Guard against a silent layout break: the Final CTA's milestone row is
  // hardcoded to a 5-column grid (lg:grid-cols-5) built around exactly 5
  // stops. If a future edit adds/removes a howItWorksSteps entry for the
  // *other* section, this catches the mismatch before it silently wraps
  // the Final CTA's row to 2 lines and misaligns FooterCareerPath's line.
  it('howItWorksSteps has exactly 5 entries (Final CTA milestone grid assumes this)', () => {
    renderLandingPage()
    const finalCta = within(screen.getByRole('region', { name: /your next move starts here/i }))
    expect(finalCta.getAllByRole('listitem')).toHaveLength(5)
  })
})
