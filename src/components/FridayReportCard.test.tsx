import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FridayReportCard, type FridayReportCardData } from './FridayReportCard'

const baseReport: FridayReportCardData = {
  title: 'Week 5 Progress Report',
  report_date: '2026-05-09',
  summary: 'Strong week — three new roles authorized for application.',
  opportunities_reviewed: 18,
  applications_submitted: 3,
  interviews_scheduled: 1,
  next_steps: 'Finalize tailored resume\nSubmit application\nSchedule follow-up',
  approval_status: 'sent',
}

describe('FridayReportCard', () => {
  it('renders the report title, date, and stat counts', () => {
    render(<FridayReportCard report={baseReport} />)
    expect(screen.getByText('Week 5 Progress Report')).toBeInTheDocument()
    // Regression test: report_date is a date-only string ('2026-05-09').
    // A naive `new Date(dateOnly)` parses as UTC midnight, which renders
    // one day earlier in any US timezone once formatted locally -- this
    // assertion pins the correct, timezone-safe local date.
    expect(screen.getByText('May 9, 2026')).toBeInTheDocument()
    expect(screen.getByText('18')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('splits next_steps into a list of individual steps', () => {
    render(<FridayReportCard report={baseReport} />)
    expect(screen.getByText('Finalize tailored resume')).toBeInTheDocument()
    expect(screen.getByText('Submit application')).toBeInTheDocument()
    expect(screen.getByText('Schedule follow-up')).toBeInTheDocument()
  })

  it('renders a fallback message when next_steps is null', () => {
    render(<FridayReportCard report={{ ...baseReport, next_steps: null }} />)
    expect(screen.getByText('No next steps recorded yet.')).toBeInTheDocument()
  })

  it('shows a "Sample" badge only when isSample is true', () => {
    const { rerender } = render(<FridayReportCard report={baseReport} />)
    expect(screen.queryByText('Sample')).not.toBeInTheDocument()
    rerender(<FridayReportCard report={baseReport} isSample />)
    expect(screen.getByText('Sample')).toBeInTheDocument()
  })

  it('maps the real approval_status field to a human-readable delivery label', () => {
    const { rerender } = render(<FridayReportCard report={{ ...baseReport, approval_status: 'sent' }} />)
    expect(screen.getByText('Delivered')).toBeInTheDocument()

    rerender(<FridayReportCard report={{ ...baseReport, approval_status: 'draft' }} />)
    expect(screen.getByText('In Progress')).toBeInTheDocument()

    rerender(<FridayReportCard report={{ ...baseReport, approval_status: 'pending_review' }} />)
    expect(screen.getByText('In Review')).toBeInTheDocument()

    rerender(<FridayReportCard report={{ ...baseReport, approval_status: 'approved' }} />)
    expect(screen.getByText('Approved')).toBeInTheDocument()
  })

  it('falls back to the raw status string for an unrecognized approval_status', () => {
    render(<FridayReportCard report={{ ...baseReport, approval_status: 'archived' }} />)
    expect(screen.getByText('archived')).toBeInTheDocument()
  })
})
