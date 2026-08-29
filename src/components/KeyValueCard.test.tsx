import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { KeyValueCard } from './KeyValueCard'

describe('KeyValueCard', () => {
  it('renders the label, a Sample badge, and every row', () => {
    render(
      <KeyValueCard
        label="Search Strategy"
        rows={[
          { label: 'Target role', value: 'Senior Product Manager' },
          { label: 'Location', value: 'Remote (US)' },
        ]}
      />
    )
    expect(screen.getByText('Search Strategy')).toBeInTheDocument()
    expect(screen.getByText('Sample')).toBeInTheDocument()
    expect(screen.getByText('Target role')).toBeInTheDocument()
    expect(screen.getByText('Senior Product Manager')).toBeInTheDocument()
    expect(screen.getByText('Location')).toBeInTheDocument()
    expect(screen.getByText('Remote (US)')).toBeInTheDocument()
  })
})
