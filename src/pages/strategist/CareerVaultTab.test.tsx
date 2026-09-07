import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { CareerVaultTab } from './CareerVaultTab'
import { getCareerWinsWithCapabilities } from '@/lib/careerVault/careerWins'

vi.mock('@/lib/careerVault/careerWins', () => ({
  getCareerWinsWithCapabilities: vi.fn(),
}))

describe('CareerVaultTab', () => {
  it("shows an empty state when the member has no Career Wins", async () => {
    vi.mocked(getCareerWinsWithCapabilities).mockResolvedValue({ careerWins: [], error: null })
    render(<CareerVaultTab memberId="member-1" />)
    await waitFor(() => expect(screen.getByText(/hasn't logged any Career Wins/i)).toBeInTheDocument())
    expect(getCareerWinsWithCapabilities).toHaveBeenCalledWith('member-1')
  })

  it("renders a CareerWinCard for each of the member's Career Wins", async () => {
    vi.mocked(getCareerWinsWithCapabilities).mockResolvedValue({
      careerWins: [{ id: 'win-1', original_statement: 'Reduced inventory loss by $31,000.', capabilities: [], metric_raw: null, category: null } as never],
      error: null,
    })
    render(<CareerVaultTab memberId="member-1" />)
    await waitFor(() => expect(screen.getByText('Reduced inventory loss by $31,000.')).toBeInTheDocument())
  })

  it('never renders a delete affordance -- this tab is read-only for strategists/admins, no exceptions', async () => {
    vi.mocked(getCareerWinsWithCapabilities).mockResolvedValue({
      careerWins: [{ id: 'win-1', original_statement: 'Reduced inventory loss by $31,000.', capabilities: [], metric_raw: null, category: null } as never],
      error: null,
    })
    render(<CareerVaultTab memberId="member-1" />)
    await waitFor(() => expect(screen.getByText('Reduced inventory loss by $31,000.')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument()
  })
})
