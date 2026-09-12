import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { RecurringGapCard } from './RecurringGapCard'
import type { RecurringGap } from '@/lib/opportunityEngine/recurringGaps'

function renderCard(gaps: RecurringGap[]) {
  return render(
    <MemoryRouter>
      <RecurringGapCard gaps={gaps} />
    </MemoryRouter>,
  )
}

describe('RecurringGapCard', () => {
  it('renders nothing when there are no recurring gaps -- no signal, no fabricated card', () => {
    const { container } = renderCard([])
    expect(container).toBeEmptyDOMElement()
  })

  it('surfaces the top recurring gap by name and frequency', () => {
    renderCard([{ skill: 'sql', frequency: 4 }])
    expect(screen.getByText(/You keep missing/)).toBeInTheDocument()
    expect(screen.getByText(/sql/)).toBeInTheDocument()
    expect(screen.getByText(/4 of your recent matches/)).toBeInTheDocument()
  })

  it('names up to two additional recurring gaps alongside the top one', () => {
    renderCard([
      { skill: 'sql', frequency: 5 },
      { skill: 'excel', frequency: 4 },
      { skill: 'python', frequency: 3 },
      { skill: 'aws', frequency: 2 },
    ])
    expect(screen.getByText(/along with excel, python/)).toBeInTheDocument()
    expect(screen.queryByText(/aws/)).not.toBeInTheDocument()
  })

  it('does not render the "along with" clause when there is only one recurring gap', () => {
    renderCard([{ skill: 'sql', frequency: 2 }])
    expect(screen.queryByText(/along with/)).not.toBeInTheDocument()
  })

  it('links to Forward DNA for remediation, reusing the existing improvementLink convention', () => {
    renderCard([{ skill: 'sql', frequency: 2 }])
    const link = screen.getByRole('link', { name: /add skill evidence to forward dna/i })
    expect(link).toHaveAttribute('href', '/forward-dna')
  })
})
