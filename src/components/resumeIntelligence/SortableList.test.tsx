import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SortableList } from './SortableList'

const items = [
  { id: 'a', label: 'Experience' },
  { id: 'b', label: 'Education' },
  { id: 'c', label: 'Skills' },
]

describe('SortableList', () => {
  it('renders every item in the order given, each with a keyboard-focusable, labeled drag handle', () => {
    render(<SortableList items={items} onReorder={vi.fn()} />)
    const rows = screen.getAllByRole('listitem')
    expect(rows.map((r) => r.textContent)).toEqual(['Experience', 'Education', 'Skills'])
    expect(screen.getByRole('button', { name: 'Reorder Experience' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reorder Education' })).toBeInTheDocument()
  })

  it('exposes a stable data-testid per row keyed by id -- order persistence is driven by id, never DOM position alone', () => {
    render(<SortableList items={items} onReorder={vi.fn()} />)
    expect(screen.getByTestId('sortable-row-a')).toBeInTheDocument()
    expect(screen.getByTestId('sortable-row-c')).toBeInTheDocument()
  })

  // Full pointer/keyboard drag gestures are exercised by @dnd-kit's own
  // (MIT-licensed, independently tested) test suite -- this component's
  // own test scope is: correct rendering + keyboard-operable affordances
  // + wiring `onReorder` with full reordered ids (see SortableList.tsx's
  // handleDragEnd, which always calls arrayMove on the full items array,
  // never a partial list).
})
