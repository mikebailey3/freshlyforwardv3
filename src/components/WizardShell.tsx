import type { ReactNode } from 'react'
import { Compass, Check, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'

export interface WizardStep {
  key: string
  label: string
}

export interface WizardShellProps {
  steps: WizardStep[]
  currentStep: number
  completedSteps: string[]
  /** Omit to disable step-indicator navigation entirely (renders disabled buttons, not plain spans, for consistent a11y semantics). */
  onStepClick?: (index: number) => void
  onBack: () => void
  onNext: () => void
  backDisabled: boolean
  nextLabel: string
  /** Defaults to false -- must not change any existing consumer's behavior (e.g. OnboardingPage never passes this and always has a valid next action). */
  nextDisabled?: boolean
  /** Shown next to the Next button only while nextDisabled is true, e.g. "Select an answer to continue". */
  nextHint?: string
  /**
   * Required, not derived from brandLabel -- this is the exact
   * aria-label text on the progress bar. Kept explicit so no consumer
   * (including the original OnboardingPage this was extracted from)
   * ever silently gets different wording than it had before.
   */
  progressLabel: string
  saving?: boolean
  savedIndicator?: boolean
  /** Defaults to "FreshlyForward" -- matches OnboardingPage's original hardcoded wordmark. */
  brandLabel?: string
  children: ReactNode
}

export function WizardShell({
  steps,
  currentStep,
  completedSteps,
  onStepClick,
  onBack,
  onNext,
  backDisabled,
  nextLabel,
  progressLabel,
  nextDisabled = false,
  nextHint,
  saving = false,
  savedIndicator = false,
  brandLabel = 'FreshlyForward',
  children,
}: WizardShellProps) {
  const progress = ((currentStep + 1) / steps.length) * 100

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <Compass className="h-6 w-6 text-primary-600" />
            <span className="font-serif text-lg font-semibold text-neutral-900">{brandLabel}</span>
          </div>
          <div className="flex items-center gap-3">
            {saving && (
              <span className="flex items-center gap-1.5 text-xs text-neutral-500">
                <Loader2 className="h-3 w-3 animate-spin" />
                Saving…
              </span>
            )}
            {savedIndicator && (
              <span className="flex items-center gap-1.5 text-xs text-success-600 animate-fade-in">
                <Check className="h-3 w-3" />
                Saved
              </span>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-1.5 w-full bg-neutral-100">
          <div
            className="h-full bg-primary-600 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
            role="progressbar"
            aria-valuenow={Math.round(progress)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={progressLabel}
          />
        </div>

        {/* Step indicators */}
        <div className="mx-auto max-w-4xl px-4 py-2">
          <div className="hidden items-center justify-between sm:flex">
            {steps.map((step, i) => (
              <button
                key={step.key}
                type="button"
                disabled={!onStepClick}
                onClick={onStepClick ? () => onStepClick(i) : undefined}
                className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
                  i === currentStep
                    ? 'text-primary-600'
                    : completedSteps.includes(step.key)
                      ? 'text-success-600'
                      : 'text-neutral-400'
                } ${!onStepClick ? 'cursor-default' : ''}`}
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                    i === currentStep
                      ? 'bg-primary-600 text-white'
                      : completedSteps.includes(step.key)
                        ? 'bg-success-100 text-success-600'
                        : 'bg-neutral-200 text-neutral-500'
                  }`}
                >
                  {completedSteps.includes(step.key) ? <Check className="h-3 w-3" /> : i + 1}
                </span>
                <span className="hidden lg:inline">{step.label}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between sm:hidden">
            <span className="text-xs font-medium text-primary-600">
              Step {currentStep + 1} of {steps.length}
            </span>
            <span className="text-xs text-neutral-500">{steps[currentStep].label}</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-4xl px-4 py-8 pb-32 sm:px-6 sm:pb-24">
        <div key={currentStep} className="animate-fade-in">
          {children}
        </div>
      </main>

      {/* Sticky Navigation */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-neutral-200 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          <button
            onClick={onBack}
            disabled={backDisabled}
            className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>
          <div className="flex items-center gap-3">
            {nextDisabled && nextHint && (
              <span className="text-xs font-medium text-neutral-500">{nextHint}</span>
            )}
            <button
              onClick={onNext}
              disabled={nextDisabled}
              className="flex items-center gap-1.5 rounded-full bg-primary-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {nextLabel}
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
