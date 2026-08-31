import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SubmitJobModal } from './SubmitJobModal'
import type { MemberProfile } from '@/types'

vi.mock('@/lib/opportunityEngine', () => ({ submitMemberJob: vi.fn() }))

const profile = { user_id: 'member-1', skills: [] } as unknown as MemberProfile

describe('SubmitJobModal', () => {
  it('disables submit until title, company, and description are filled', () => {
    render(<SubmitJobModal profile={profile} onClose={() => {}} onSubmitted={() => {}} />)
    const submitButton = screen.getByRole('button', { name: /submit & score/i })
    expect(submitButton).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/job title/i), { target: { value: 'Data Analyst' } })
    fireEvent.change(screen.getByLabelText(/^company$/i), { target: { value: 'Acme' } })
    fireEvent.change(screen.getByLabelText(/job description/i), { target: { value: 'SQL required.' } })

    expect(submitButton).not.toBeDisabled()
  })

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn()
    render(<SubmitJobModal profile={profile} onClose={onClose} onSubmitted={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onClose).toHaveBeenCalled()
  })
})
