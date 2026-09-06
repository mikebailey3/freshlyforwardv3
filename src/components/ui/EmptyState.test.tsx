import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { EmptyState } from './EmptyState'

describe('EmptyState', () => {
  it('renders title, description, and action', () => {
    render(<EmptyState title="No applications yet" description="Submit a job to get started." action={<button>Submit a job</button>} />)
    expect(screen.getByText('No applications yet')).toBeInTheDocument()
    expect(screen.getByText('Submit a job to get started.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Submit a job' })).toBeInTheDocument()
  })
})
