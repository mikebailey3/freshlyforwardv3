import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EmptyMatchesState } from './EmptyMatchesState'

describe('EmptyMatchesState', () => {
  it('explains what Opportunity Engine does and what FreshFit means', () => {
    render(<EmptyMatchesState />)
    expect(screen.getByText(/opportunity engine/i)).toBeInTheDocument()
    expect(screen.getByText(/freshfit/i)).toBeInTheDocument()
  })
})
