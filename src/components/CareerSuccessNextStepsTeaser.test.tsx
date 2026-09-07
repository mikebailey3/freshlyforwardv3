import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CareerSuccessNextStepsTeaser } from './CareerSuccessNextStepsTeaser'

const { mockGetFridayReports } = vi.hoisted(() => ({ mockGetFridayReports: vi.fn() }))

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ profile: { id: 'profile-1' } }),
}))

vi.mock('@/lib/communication', () => ({
  getFridayReports: mockGetFridayReports,
}))

function renderTeaser() {
  return render(
    <MemoryRouter>
      <CareerSuccessNextStepsTeaser />
    </MemoryRouter>,
  )
}

function report(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'r1',
    title: 'Week of Jan 6',
    report_date: '2026-01-06',
    next_steps: 'Follow up on Acme application\nPrep for Tuesday screen\nUpdate resume bullet points',
    approval_status: 'sent',
    ...overrides,
  }
}

describe('CareerSuccessNextStepsTeaser', () => {
  it('shows the truncated next steps from the most recent approved/sent report', async () => {
    mockGetFridayReports.mockResolvedValue([report()])

    renderTeaser()

    await waitFor(() => expect(screen.getByText('Follow up on Acme application')).toBeInTheDocument())
    expect(screen.getByText('Prep for Tuesday screen')).toBeInTheDocument()
    expect(screen.getByText('Update resume bullet points')).toBeInTheDocument()
    expect(screen.getByText(/Week of Jan 6/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /View full report/i })).toHaveAttribute('href', '/friday-reports')
  })

  it('excludes draft and pending_review reports and falls back to the empty state', async () => {
    mockGetFridayReports.mockResolvedValue([
      report({ approval_status: 'draft', next_steps: 'Should never show this' }),
      report({ approval_status: 'pending_review', next_steps: 'Should never show this either' }),
    ])

    renderTeaser()

    await waitFor(() =>
      expect(screen.getByText("Your strategist hasn't published a progress report yet.")).toBeInTheDocument(),
    )
    expect(screen.queryByText('Should never show this')).not.toBeInTheDocument()
    expect(screen.queryByText('Should never show this either')).not.toBeInTheDocument()
  })

  it('shows the true empty state when no reports exist at all', async () => {
    mockGetFridayReports.mockResolvedValue([])

    renderTeaser()

    await waitFor(() =>
      expect(screen.getByText("Your strategist hasn't published a progress report yet.")).toBeInTheDocument(),
    )
    expect(screen.getByRole('link', { name: /View Friday Reports/i })).toHaveAttribute('href', '/friday-reports')
  })

  it('degrades to the empty state and does not crash when the fetch rejects', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockGetFridayReports.mockRejectedValue(new Error('network down'))

    renderTeaser()

    await waitFor(() =>
      expect(screen.getByText("Your strategist hasn't published a progress report yet.")).toBeInTheDocument(),
    )
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  it('shows a loading state before the fetch resolves', () => {
    mockGetFridayReports.mockReturnValue(new Promise(() => {}))

    renderTeaser()

    expect(screen.getByText('Your current focus')).toBeInTheDocument()
    expect(screen.queryByText(/published a progress report/)).not.toBeInTheDocument()
  })
})
