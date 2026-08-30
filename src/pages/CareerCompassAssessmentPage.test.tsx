import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CareerCompassAssessmentPage } from './CareerCompassAssessmentPage'
import { archetypeQuestions } from '@/data/careerCompassQuestions'
import type { ArchetypeAnswers } from '@/types/careerCompass'

vi.mock('@/lib/careerCompass/session', () => ({
  ensureAuthenticatedSession: vi.fn(),
  startOrResumeAssessment: vi.fn(),
  saveAssessmentAnswers: vi.fn(),
  completeAssessment: vi.fn(),
}))

import {
  ensureAuthenticatedSession, startOrResumeAssessment, saveAssessmentAnswers,
} from '@/lib/careerCompass/session'

function renderPage() {
  return render(
    <MemoryRouter>
      <CareerCompassAssessmentPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('CareerCompassAssessmentPage', () => {
  it('renders the first question immediately on mount without creating a session', () => {
    renderPage()

    expect(screen.getByText(archetypeQuestions[0].text)).toBeInTheDocument()
    expect(ensureAuthenticatedSession).not.toHaveBeenCalled()
    expect(startOrResumeAssessment).not.toHaveBeenCalled()
  })

  it('resumes at the first genuinely unanswered question, merging existing progress with the just-given answer', async () => {
    const preAnswered: ArchetypeAnswers = {}
    for (let i = 0; i < 5; i++) preAnswered[archetypeQuestions[i].id] = 4

    vi.mocked(ensureAuthenticatedSession).mockResolvedValue({ userId: 'user-1' })
    vi.mocked(startOrResumeAssessment).mockResolvedValue({
      assessmentId: 'assess-1',
      archetypeAnswers: preAnswered,
      readinessAnswers: {},
    })
    vi.mocked(saveAssessmentAnswers).mockResolvedValue({ error: null })

    renderPage()

    // Mount always shows question 1 -- the resume data isn't known yet.
    expect(screen.getByText(archetypeQuestions[0].text)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '3' }))

    // Lands on question 6 (index 5) -- the first one not already answered
    // in the resumed data. Not question 2 (naive +1 advance) and not
    // restarted at question 1.
    await screen.findByText(archetypeQuestions[5].text)
    expect(screen.queryByText(archetypeQuestions[1].text)).not.toBeInTheDocument()

    expect(saveAssessmentAnswers).toHaveBeenCalledWith(
      'assess-1',
      expect.objectContaining({
        [archetypeQuestions[0].id]: 3, // the just-given answer, applied on top
        [archetypeQuestions[4].id]: 4, // resumed data, preserved
      }),
      {},
    )
  })

  it('keeps the just-given answer visible and surfaces an error instead of discarding it when the session bootstrap fails', async () => {
    vi.mocked(ensureAuthenticatedSession).mockResolvedValue({ error: 'network down' })

    renderPage()

    fireEvent.click(screen.getByRole('button', { name: '2' }))

    await screen.findByText(/network down/)

    // Still on the same question, with the given answer still shown as selected.
    expect(screen.getByText(archetypeQuestions[0].text)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-pressed', 'true')
    expect(startOrResumeAssessment).not.toHaveBeenCalled()
  })

  it('retrying after a bootstrap failure re-applies the same held answer', async () => {
    vi.mocked(ensureAuthenticatedSession)
      .mockResolvedValueOnce({ error: 'network down' })
      .mockResolvedValueOnce({ userId: 'user-1' })
    vi.mocked(startOrResumeAssessment).mockResolvedValue({
      assessmentId: 'assess-1', archetypeAnswers: {}, readinessAnswers: {},
    })
    vi.mocked(saveAssessmentAnswers).mockResolvedValue({ error: null })

    renderPage()

    fireEvent.click(screen.getByRole('button', { name: '2' }))
    await screen.findByText(/network down/)

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    await screen.findByText(archetypeQuestions[1].text)
    expect(saveAssessmentAnswers).toHaveBeenCalledWith(
      'assess-1',
      { [archetypeQuestions[0].id]: 2 },
      {},
    )
  })
})
