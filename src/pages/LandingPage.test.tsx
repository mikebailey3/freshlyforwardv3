import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LandingPage } from './LandingPage'

// Homepage Redesign Phase 1 / Task 5: enforces the locked spec constraints
// that aren't safe to leave to visual review alone -- "Applications" not
// "Application Workspace", and Career Vault must never be presented as
// live. Task 8 will extend this file with the real-pricing-only assertions;
// the no-fake-pricing-strings check is included now (trivially passing,
// since this task doesn't touch pricing) so Task 8 can't reintroduce them
// without breaking an existing test.
function renderLandingPage() {
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
})
