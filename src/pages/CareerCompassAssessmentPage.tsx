import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle } from 'lucide-react'
import { WizardShell, type WizardStep } from '@/components/WizardShell'
import { ArchetypeQuestionScreen } from '@/components/careerCompass/ArchetypeQuestionScreen'
import { ReadinessQuestionScreen } from '@/components/careerCompass/ReadinessQuestionScreen'
import { archetypeQuestions } from '@/data/careerCompassQuestions'
import { forwardReadinessQuestions } from '@/data/forwardReadinessQuestions'
import { runArchetypeAssessment } from '@/lib/careerCompass/archetypeEngine'
import { calculateReadiness } from '@/lib/careerCompass/readinessEngine'
import { recommendPlan } from '@/lib/careerCompass/recommendationEngine'
import {
  ensureAuthenticatedSession, startOrResumeAssessment, saveAssessmentAnswers, completeAssessment,
} from '@/lib/careerCompass/session'
import type { ArchetypeAnswer, ArchetypeAnswers, ReadinessAnswers } from '@/types/careerCompass'

const ARCHETYPE_COUNT = archetypeQuestions.length
const READINESS_COUNT = forwardReadinessQuestions.length
const TOTAL_COUNT = ARCHETYPE_COUNT + READINESS_COUNT

const WIZARD_STEPS: WizardStep[] = [
  { key: 'archetype', label: 'Career Archetype' },
  { key: 'readiness', label: 'Forward Readiness' },
]

type AnswerValue = ArchetypeAnswer | number

/** Pure merge helper -- returns new answer maps with one question's answer applied. */
function applyAnswer(
  archetype: ArchetypeAnswers,
  readiness: ReadinessAnswers,
  questionIndex: number,
  value: AnswerValue,
): { archetype: ArchetypeAnswers; readiness: ReadinessAnswers } {
  if (questionIndex < ARCHETYPE_COUNT) {
    const q = archetypeQuestions[questionIndex]
    return { archetype: { ...archetype, [q.id]: value as ArchetypeAnswer }, readiness }
  }
  const q = forwardReadinessQuestions[questionIndex - ARCHETYPE_COUNT]
  return { archetype, readiness: { ...readiness, [q.id]: value as number } }
}

/** First question (0-32) with no recorded answer, or TOTAL_COUNT if every question is answered. */
function findFirstUnansweredIndex(archetype: ArchetypeAnswers, readiness: ReadinessAnswers): number {
  for (let i = 0; i < ARCHETYPE_COUNT; i++) {
    if (archetype[archetypeQuestions[i].id] === undefined) return i
  }
  for (let i = 0; i < READINESS_COUNT; i++) {
    if (readiness[forwardReadinessQuestions[i].id] === undefined) return ARCHETYPE_COUNT + i
  }
  return TOTAL_COUNT
}

export function CareerCompassAssessmentPage() {
  const navigate = useNavigate()

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [archetypeAnswers, setArchetypeAnswers] = useState<ArchetypeAnswers>({})
  const [readinessAnswers, setReadinessAnswers] = useState<ReadinessAnswers>({})
  const [assessmentId, setAssessmentId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [bootstrapping, setBootstrapping] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // The visitor's first answer, held here until ensureAuthenticatedSession +
  // startOrResumeAssessment succeed -- never discarded, even on failure.
  const [pendingAnswer, setPendingAnswer] = useState<{ questionIndex: number; value: AnswerValue } | null>(null)

  const finalizeAssessment = useCallback(
    async (finalArchetype: ArchetypeAnswers, finalReadiness: ReadinessAnswers, assessId: string, uid: string) => {
      setSubmitting(true)
      setError(null)
      const archetype = runArchetypeAssessment(archetypeQuestions, finalArchetype)
      const readiness = calculateReadiness(forwardReadinessQuestions, finalReadiness)
      const recommendation = recommendPlan(readiness)
      const { error: completeError } = await completeAssessment({
        assessmentId: assessId, userId: uid, archetype, readiness, recommendation,
      })
      if (completeError) {
        setSubmitting(false)
        setError("We couldn't save your results just now. Your answers are safe — try again.")
        return
      }
      // assessmentId must also live in the URL, not just router state -- a
      // hard refresh or opening the results link in a new tab loses router
      // state entirely, and CareerCompassResultsPage's documented slow-path
      // fallback (re-fetching by assessmentId query param) depends on it
      // being there.
      navigate(`/career-compass/results?assessmentId=${encodeURIComponent(assessId)}`, { state: { assessmentId: assessId, archetype, readiness, recommendation } })
    },
    [navigate],
  )

  const advanceAfterAnswer = useCallback(
    (
      nextArchetype: ArchetypeAnswers, nextReadiness: ReadinessAnswers,
      assessId: string, uid: string, answeredIndex: number, isResume: boolean,
    ) => {
      setArchetypeAnswers(nextArchetype)
      setReadinessAnswers(nextReadiness)

      const nextIndex = isResume ? findFirstUnansweredIndex(nextArchetype, nextReadiness) : answeredIndex + 1

      if (nextIndex >= TOTAL_COUNT) {
        void finalizeAssessment(nextArchetype, nextReadiness, assessId, uid)
        return
      }

      setCurrentQuestionIndex(nextIndex)
      // Fire-and-forget: a failed autosave is silently retried by the next
      // answer's call, which always sends the full current state.
      void saveAssessmentAnswers(assessId, nextArchetype, nextReadiness)
    },
    [finalizeAssessment],
  )

  const runBootstrapAndCommit = useCallback(
    async (answeredIndex: number, value: AnswerValue) => {
      setBootstrapping(true)
      setError(null)

      const authResult = await ensureAuthenticatedSession()
      if ('error' in authResult) {
        setBootstrapping(false)
        setError(authResult.error)
        return
      }

      const assessmentResult = await startOrResumeAssessment(authResult.userId)
      if ('error' in assessmentResult) {
        setBootstrapping(false)
        setError(assessmentResult.error)
        return
      }

      const { assessmentId: assessId, archetypeAnswers: resumedArchetype, readinessAnswers: resumedReadiness } = assessmentResult
      // Resumed answers first, then the just-given answer on top -- so a
      // returning visitor's earlier progress is never overwritten by an
      // empty local state, and the answer they just gave is never lost.
      const merged = applyAnswer(resumedArchetype, resumedReadiness, answeredIndex, value)

      setUserId(authResult.userId)
      setAssessmentId(assessId)
      setPendingAnswer(null)
      setBootstrapping(false)

      advanceAfterAnswer(merged.archetype, merged.readiness, assessId, authResult.userId, answeredIndex, true)
    },
    [advanceAfterAnswer],
  )

  const handleAnswer = useCallback(
    (value: AnswerValue) => {
      if (bootstrapping || submitting) return
      const answeredIndex = currentQuestionIndex

      if (assessmentId && userId) {
        const merged = applyAnswer(archetypeAnswers, readinessAnswers, answeredIndex, value)
        advanceAfterAnswer(merged.archetype, merged.readiness, assessmentId, userId, answeredIndex, false)
        return
      }

      // First answer of this page-load: hold it and stand up the session +
      // assessment before anything gets persisted.
      setPendingAnswer({ questionIndex: answeredIndex, value })
      void runBootstrapAndCommit(answeredIndex, value)
    },
    [bootstrapping, submitting, currentQuestionIndex, assessmentId, userId, archetypeAnswers, readinessAnswers, advanceAfterAnswer, runBootstrapAndCommit],
  )

  const currentAnswerValue = (): AnswerValue | undefined => {
    if (pendingAnswer && pendingAnswer.questionIndex === currentQuestionIndex) return pendingAnswer.value
    if (currentQuestionIndex < ARCHETYPE_COUNT) return archetypeAnswers[archetypeQuestions[currentQuestionIndex].id]
    return readinessAnswers[forwardReadinessQuestions[currentQuestionIndex - ARCHETYPE_COUNT].id]
  }

  const busy = bootstrapping || submitting

  const handleBack = () => {
    if (currentQuestionIndex === 0 || busy) return
    setPendingAnswer(null)
    setError(null)
    setCurrentQuestionIndex((i) => i - 1)
  }

  const handleRetry = () => {
    const value = currentAnswerValue()
    if (value !== undefined) handleAnswer(value)
  }

  const isArchetypePhase = currentQuestionIndex < ARCHETYPE_COUNT
  const completedSteps = isArchetypePhase ? [] : ['archetype']

  const nextLabel = submitting ? 'Saving your results…' : currentQuestionIndex === TOTAL_COUNT - 1 ? 'See My Results' : 'Next'
  const nextDisabled = busy || currentAnswerValue() === undefined

  return (
    <WizardShell
      steps={WIZARD_STEPS}
      currentStep={isArchetypePhase ? 0 : 1}
      completedSteps={completedSteps}
      onBack={handleBack}
      onNext={handleRetry}
      backDisabled={currentQuestionIndex === 0}
      nextLabel={nextLabel}
      nextDisabled={nextDisabled}
      nextHint={nextDisabled && !busy ? 'Select an answer to continue' : undefined}
      progressLabel="Career Compass progress"
      saving={bootstrapping}
      brandLabel="Career Compass"
    >
      {error && (
        <div className="mb-6 flex items-start gap-2 border border-error-300 border-l-4 border-l-error-600 bg-error-50 p-4" role="alert">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-error-600" />
          <div className="text-sm text-error-600">
            <p>{error}</p>
            <button
              type="button"
              onClick={handleRetry}
              disabled={busy}
              className="mt-2 font-semibold underline disabled:opacity-50"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {isArchetypePhase ? (
        <ArchetypeQuestionScreen
          question={archetypeQuestions[currentQuestionIndex]}
          value={currentAnswerValue() as ArchetypeAnswer | undefined}
          onAnswer={handleAnswer}
        />
      ) : (
        <ReadinessQuestionScreen
          question={forwardReadinessQuestions[currentQuestionIndex - ARCHETYPE_COUNT]}
          value={currentAnswerValue() as number | undefined}
          onAnswer={handleAnswer}
        />
      )}
    </WizardShell>
  )
}
