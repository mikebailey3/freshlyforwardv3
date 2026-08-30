import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CareerCompassAssessmentPage } from './CareerCompassAssessmentPage'
import { archetypeQuestions } from '@/data/careerCompassQuestions'
import { forwardReadinessQuestions } from '@/data/forwardReadinessQuestions'
import { runArchetypeAssessment } from '@/lib/careerCompass/archetypeEngine'
import { calculateReadiness } from '@/lib/careerCompass/readinessEngine'
import { recommendPlan } from '@/lib/careerCompass/recommendationEngine'
import type { ArchetypeAnswer, ArchetypeAnswers, ReadinessAnswers } from '@/types/careerCompass'

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('@/lib/careerCompass/session', () => ({
  ensureAuthenticatedSession: vi.fn(),
  startOrResumeAssessment: vi.fn(),
  saveAssessmentAnswers: vi.fn(),
  completeAssessment: vi.fn(),
}))

import {
  ensureAuthenticatedSession, startOrResumeAssessment, saveAssessmentAnswers, completeAssessment,
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

  it('does not navigate on a failed completeAssessment, then navigates with the exact result shape after a successful retry', async () => {
    const ARCHETYPE_COUNT = archetypeQuestions.length
    const READINESS_COUNT = forwardReadinessQuestions.length

    // Every question answered with a known, fixed value so the expected
    // engine outputs can be computed independently below.
    const finalArchetypeAnswers: ArchetypeAnswers = {}
    for (let i = 0; i < ARCHETYPE_COUNT; i++) finalArchetypeAnswers[archetypeQuestions[i].id] = 3 as ArchetypeAnswer
    const finalReadinessAnswers: ReadinessAnswers = {}
    for (let i = 0; i < READINESS_COUNT; i++) finalReadinessAnswers[forwardReadinessQuestions[i].id] = 0

    // Resumed data covers everything except the very first archetype
    // question (about to be answered live) and the very last readiness
    // question -- so one click lands the visitor directly on question 33.
    const resumedArchetype: ArchetypeAnswers = { ...finalArchetypeAnswers }
    delete resumedArchetype[archetypeQuestions[0].id]
    const resumedReadiness: ReadinessAnswers = { ...finalReadinessAnswers }
    const lastReadinessQuestion = forwardReadinessQuestions[READINESS_COUNT - 1]
    delete resumedReadiness[lastReadinessQuestion.id]

    vi.mocked(ensureAuthenticatedSession).mockResolvedValue({ userId: 'user-1' })
    vi.mocked(startOrResumeAssessment).mockResolvedValue({
      assessmentId: 'assess-1',
      archetypeAnswers: resumedArchetype,
      readinessAnswers: resumedReadiness,
    })
    vi.mocked(saveAssessmentAnswers).mockResolvedValue({ error: null })
    vi.mocked(completeAssessment)
      .mockResolvedValueOnce({ error: 'db unavailable' })
      .mockResolvedValueOnce({ error: null })

    renderPage()

    // Answering question 1 merges in the resumed progress and lands
    // directly on the last (33rd) question.
    fireEvent.click(screen.getByRole('button', { name: '3' }))
    await screen.findByText(lastReadinessQuestion.text)

    // Answering the final question triggers completion, which fails.
    fireEvent.click(screen.getByRole('button', { name: lastReadinessQuestion.options[0].label }))
    await screen.findByText(/couldn't save your results/i)
    expect(completeAssessment).toHaveBeenCalledTimes(1)
    expect(mockNavigate).not.toHaveBeenCalled()

    // Retrying re-runs the same (cheap, pure) computation and succeeds.
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(1))
    expect(completeAssessment).toHaveBeenCalledTimes(2)

    const [path, options] = mockNavigate.mock.calls[0]
    // assessmentId must be in the URL itself, not just router state -- a
    // hard refresh or new-tab open on the results page has no router state
    // to fall back on, only the query string.
    expect(path).toBe('/career-compass/results?assessmentId=assess-1')

    const expectedArchetype = runArchetypeAssessment(archetypeQuestions, finalArchetypeAnswers)
    const expectedReadiness = calculateReadiness(forwardReadinessQuestions, finalReadinessAnswers)
    const expectedRecommendation = recommendPlan(expectedReadiness)

    expect(Object.keys(options.state).sort()).toEqual(
      ['archetype', 'assessmentId', 'readiness', 'recommendation'].sort(),
    )
    expect(options.state).toEqual({
      assessmentId: 'assess-1',
      archetype: expectedArchetype,
      readiness: expectedReadiness,
      recommendation: expectedRecommendation,
    })
  })
})
