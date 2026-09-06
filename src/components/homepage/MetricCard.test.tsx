import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TrendingUp } from 'lucide-react'
import { MetricCard } from './MetricCard'

describe('MetricCard', () => {
  it('renders label, value, and icon on the semantic card surface', () => {
    render(<MetricCard icon={TrendingUp} label="Active Applications" value="8" />)
    const value = screen.getByText('8')
    expect(value).toBeInTheDocument()
    expect(screen.getByText('Active Applications')).toBeInTheDocument()
    expect(value.closest('div')?.className).toContain('bg-surface-card')
  })

  it('renders an optional delta line', () => {
    render(<MetricCard icon={TrendingUp} label="Active Applications" value="8" delta="+3 this week" />)
    expect(screen.getByText('+3 this week')).toBeInTheDocument()
  })

  it('omits the delta line when not provided', () => {
    render(<MetricCard icon={TrendingUp} label="Active Applications" value="8" />)
    expect(screen.queryByText(/this week/)).not.toBeInTheDocument()
  })
})
