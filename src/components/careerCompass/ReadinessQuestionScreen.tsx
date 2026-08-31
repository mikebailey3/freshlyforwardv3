import type { ReadinessQuestion } from '@/types/careerCompass'

interface ReadinessQuestionScreenProps {
  question: ReadinessQuestion
  /** Selected option INDEX, not the option's scoring value. */
  value: number | undefined
  onAnswer: (optionIndex: number) => void
}

/** Presentational only -- no data-fetching, no knowledge of assessment progress. */
export function ReadinessQuestionScreen({ question, value, onAnswer }: ReadinessQuestionScreenProps) {
  return (
    <div>
      <h2 className="font-serif text-2xl font-semibold text-neutral-900 sm:text-3xl">{question.text}</h2>
      <div className="mt-8 flex flex-col gap-3" role="group" aria-label={question.text}>
        {question.options.map((option, i) => (
          <button
            key={option.label}
            type="button"
            aria-pressed={value === i}
            onClick={() => onAnswer(i)}
            className={`rounded-2xl border-2 px-5 py-4 text-left text-base font-medium transition-colors ${
              value === i
                ? 'border-primary-600 bg-primary-50 text-primary-700'
                : 'border-neutral-200 bg-white text-neutral-700 hover:border-primary-300'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}
