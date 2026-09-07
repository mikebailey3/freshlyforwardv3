import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CareerVaultTeaserCard } from './CareerVaultTeaserCard'

describe('CareerVaultTeaserCard', () => {
  it('links to /career-vault', () => {
    render(
      <MemoryRouter>
        <CareerVaultTeaserCard />
      </MemoryRouter>
    )
    expect(screen.getByRole('link', { name: /career vault/i })).toHaveAttribute('href', '/career-vault')
  })
})
