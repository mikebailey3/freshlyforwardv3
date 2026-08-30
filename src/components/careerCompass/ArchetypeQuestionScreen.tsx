import type { ArchetypeAnswer, ArchetypeQuestion } from '@/types/careerCompass'

interface ArchetypeQuestionScreenProps {
  question: ArchetypeQuestion
  value: ArchetypeAnswer | undefined
  onAnswer: (value: ArchetypeAnswer) => void
}

const SCALE: ArchetypeAnswer[] = [1, 2, 3, 4, 5]

/** Presentational only -- no data-fetching, no knowledge of assessment progress. */
export function ArchetypeQuestionScreen({ question, value, onAnswer }: ArchetypeQuestionScreenProps) {
  return (
    <div>
      <h2 className="font-serif text-2xl font-semibold text-neutral-900 sm:text-3xl">{question.text}</h2>
      <div className="mt-8" role="group" aria-label="Rate your agreement, 1 to 5">
        <div className="flex items-center justify-between text-xs font-medium text-neutral-500">
          <span>Strongly disagree</span>
          <span>Strongly agree</span>
        </div>
        <div className="mt-3 grid grid-cols-5 gap-3">
          {SCALE.map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={value === n}
              onClick={() => onAnswer(n)}
              className={`flex h-14 items-center justify-center rounded-full border-2 text-lg font-semibold transition-colors ${
                value === n
                  ? 'border-primary-600 bg-primary-600 text-white'
                  : 'border-neutral-300 bg-white text-neutral-700 hover:border-primary-400'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
