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
})
