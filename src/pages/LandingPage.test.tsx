import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { LandingPage } from './LandingPage'

/** Guardrail tests for Checkpoint B (Sub-project 2, middle homepage
 * composition). These deliberately test for the *absence* of fabricated
 * claims and the *presence* of real routes/positioning, not pixel-level
 * layout -- visual review is handled separately via screenshots. */
describe('LandingPage', () => {
  it('renders the locked hero headline and primary CTA', () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { level: 1, name: /career forward/i })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /get started free/i })[0]).toHaveAttribute('href', '/signup')
  })

  it('renders all seven middle/closing section headlines from the approved Checkpoint B brief', () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    )
    const headlines = [
      /more than a job search tool/i,
      /your next move should be obvious/i,
      /it's not just a score/i,
      /your career story, finally connected/i,
      /a better search needs better judgment/i,
      /see your career moving forward/i,
      /your next opportunity is closer than you think/i,
    ]
    headlines.forEach((pattern) => {
      expect(screen.getByRole('heading', { name: pattern })).toBeInTheDocument()
    })
  })

  it('links the four-step journey to real routes, not invented product names', () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: /take the career compass/i })).toHaveAttribute('href', '/career-compass')
    expect(screen.getByRole('link', { name: /see forward dna/i })).toHaveAttribute('href', '/forward-dna')
    expect(screen.getByRole('link', { name: /explore the opportunity engine/i })).toHaveAttribute(
      'href',
      '/opportunity-engine',
    )
    expect(screen.getByRole('link', { name: /see how progress is tracked/i })).toHaveAttribute('href', '/applications')
  })

  it('uses the real FreshFit tier system (Excellent/Good/Fair), not an invented scale', () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    )
    expect(screen.getAllByText(/Excellent Match/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/Good Match/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/Fair Match/).length).toBeGreaterThanOrEqual(1)
  })

  it('labels every sample product-preview module as Sample, never presented as a real member record', () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    )
    const sampleLabels = screen.getAllByText('Sample')
    expect(sampleLabels.length).toBeGreaterThanOrEqual(2)
  })

  it('never fabricates testimonials, employer logos, user counts, or success-rate claims', () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    )
    const bodyText = document.body.textContent ?? ''
    expect(bodyText).not.toMatch(/\d[\d,]*\+?\s*(members|users|job seekers)\b/i)
    expect(bodyText).not.toMatch(/\d+%\s*(success|placement)\b/i)
    expect(bodyText).not.toMatch(/"[^"]{15,}"\s*[-—]\s*[A-Z][a-z]+\s[A-Z]\./)
  })

  it('positions human strategist support as an integrated differentiator, not the primary product definition', () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    )
    const section = screen.getByRole('heading', { name: /a better search needs better judgment/i }).closest('section')
    expect(section).not.toBeNull()
    expect(within(section as HTMLElement).getByRole('heading', { name: /AI career intelligence/i })).toBeInTheDocument()
    expect(
      within(section as HTMLElement).getByRole('heading', { name: /Real strategist judgment/i }),
    ).toBeInTheDocument()
  })

  it('closes with a strong primary CTA and a real secondary route', () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    )
    const finalHeading = screen.getByRole('heading', { name: /your next opportunity is closer than you think/i })
    const finalSection = finalHeading.closest('section') as HTMLElement
    expect(within(finalSection).getByRole('link', { name: /get started free/i })).toHaveAttribute('href', '/signup')
    expect(within(finalSection).getByRole('link', { name: /see how it works/i })).toHaveAttribute(
      'href',
      '/how-it-works',
    )
  })
})
