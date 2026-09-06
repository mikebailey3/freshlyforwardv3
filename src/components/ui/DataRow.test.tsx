import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DataRow } from './DataRow'

describe('DataRow', () => {
  it('renders label and value', () => {
    render(<DataRow label="FreshFit score" value="86" />)
    expect(screen.getByText('FreshFit score')).toBeInTheDocument()
    expect(screen.getByText('86')).toBeInTheDocument()
  })
})
