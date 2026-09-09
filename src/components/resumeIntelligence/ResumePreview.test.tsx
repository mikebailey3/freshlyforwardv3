import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ResumePreview } from './ResumePreview'
import type { ResumeViewModel } from '@/lib/resumeIntelligence/presentation/types'

const viewModel: ResumeViewModel = {
  resumeVersionId: 'rv-1',
  templateKey: 'ats_classic',
  contact: { fullName: 'Jordan Rivera', email: 'jordan@example.com', phone: '555-0100', location: 'Austin, TX' },
  summary: 'A canonical or overridden summary.',
  sections: [
    {
      key: 'employment',
      label: 'Experience',
      entries: [{ id: 'emp-1', entryKind: 'employment', primaryText: 'Senior Analyst', secondaryText: 'Acme Corp', dateRange: '2020 - Present', description: 'Did the thing.', sortOrder: 0 }],
    },
    {
      key: 'skills',
      label: 'Skills',
      entries: [{ id: 'SQL', entryKind: 'skill', primaryText: 'SQL', secondaryText: '', dateRange: '', description: '', sortOrder: 0 }],
    },
  ],
}

describe('ResumePreview', () => {
  it('renders contact info, summary, and every section from the view model -- no reload, straight from props', () => {
    render(<ResumePreview viewModel={viewModel} />)
    expect(screen.getByText('Jordan Rivera')).toBeInTheDocument()
    expect(screen.getByText('A canonical or overridden summary.')).toBeInTheDocument()
    expect(screen.getByText(/Senior Analyst/)).toBeInTheDocument()
    expect(screen.getByTestId('section-skills')).toHaveTextContent('SQL')
  })

  it('reflects the template key on the root node for template-specific styling/testing', () => {
    render(<ResumePreview viewModel={viewModel} />)
    expect(screen.getByTestId('resume-preview')).toHaveAttribute('data-template', 'ats_classic')
  })

  it('renders sections in the order the view model provides (already-resolved section order)', () => {
    render(<ResumePreview viewModel={viewModel} />)
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(headings).toEqual(['Summary', 'Experience', 'Skills'])
  })
})
