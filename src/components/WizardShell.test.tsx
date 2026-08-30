import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { WizardShell, type WizardStep } from './WizardShell'

const steps: WizardStep[] = [
  { key: 'welcome', label: 'Welcome' },
  { key: 'details', label: 'Details' },
  { key: 'done', label: 'Done' },
]

function renderShell(overrides: Partial<ComponentProps<typeof WizardShell>> = {}) {
  const defaultProps: ComponentProps<typeof WizardShell> = {
    steps,
    currentStep: 1,
    completedSteps: ['welcome'],
    onStepClick: vi.fn(),
    onBack: vi.fn(),
    onNext: vi.fn(),
    backDisabled: false,
    nextLabel: 'Continue',
    progressLabel: 'Onboarding progress',
    children: <div>Step content</div>,
  }
  const props = { ...defaultProps, ...overrides }
  render(<WizardShell {...props} />)
  return props
}

describe('WizardShell', () => {
  it('renders the given progressLabel as the progress bar aria-label, not derived from brandLabel', () => {
    renderShell({ progressLabel: 'Custom wizard progress', brandLabel: 'SomeOtherBrand' })
    expect(screen.getByRole('progressbar', { name: 'Custom wizard progress' })).toBeInTheDocument()
  })

  it('renders the default brandLabel "FreshlyForward" when brandLabel is omitted', () => {
    renderShell()
    expect(screen.getByText('FreshlyForward')).toBeInTheDocument()
  })

  it('renders a custom brandLabel when provided', () => {
    renderShell({ brandLabel: 'Acme Compass' })
    expect(screen.getByText('Acme Compass')).toBeInTheDocument()
    expect(screen.queryByText('FreshlyForward')).not.toBeInTheDocument()
  })

  it('calls onStepClick with the correct index when a step-indicator button is clicked', () => {
    const onStepClick = vi.fn()
    renderShell({ onStepClick })
    screen.getByRole('button', { name: /Done/ }).click()
    expect(onStepClick).toHaveBeenCalledWith(2)
  })

  it('disables step-indicator buttons when onStepClick is omitted', () => {
    renderShell({ onStepClick: undefined })
    const stepButton = screen.getByRole('button', { name: /Welcome/ })
    expect(stepButton).toBeDisabled()
  })

  it('reflects backDisabled on the Back button', () => {
    const { rerender } = render(
      <WizardShell
        steps={steps}
        currentStep={0}
        completedSteps={[]}
        onBack={vi.fn()}
        onNext={vi.fn()}
        backDisabled
        nextLabel="Continue"
        progressLabel="Onboarding progress"
      >
        <div>Step content</div>
      </WizardShell>,
    )
    expect(screen.getByRole('button', { name: /Back/ })).toBeDisabled()

    rerender(
      <WizardShell
        steps={steps}
        currentStep={0}
        completedSteps={[]}
        onBack={vi.fn()}
        onNext={vi.fn()}
        backDisabled={false}
        nextLabel="Continue"
        progressLabel="Onboarding progress"
      >
        <div>Step content</div>
      </WizardShell>,
    )
    expect(screen.getByRole('button', { name: /Back/ })).not.toBeDisabled()
  })

  it('calls onNext when the Next button is clicked', () => {
    const onNext = vi.fn()
    renderShell({ onNext })
    screen.getByRole('button', { name: /Continue/ }).click()
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  it('calls onBack when the Back button is clicked', () => {
    const onBack = vi.fn()
    renderShell({ onBack, backDisabled: false })
    screen.getByRole('button', { name: /Back/ }).click()
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('renders children inside the content area', () => {
    renderShell({ children: <div>Unique child content marker</div> })
    expect(screen.getByText('Unique child content marker')).toBeInTheDocument()
  })

  it('leaves the Next button enabled when nextDisabled is omitted, preserving existing consumers like OnboardingPage', () => {
    renderShell()
    expect(screen.getByRole('button', { name: /Continue/ })).not.toBeDisabled()
  })

  it('disables the Next button when nextDisabled is true', () => {
    renderShell({ nextDisabled: true })
    expect(screen.getByRole('button', { name: /Continue/ })).toBeDisabled()
  })

  it('shows nextHint only while nextDisabled is true', () => {
    const { rerender } = render(
      <WizardShell
        steps={steps}
        currentStep={0}
        completedSteps={[]}
        onBack={vi.fn()}
        onNext={vi.fn()}
        backDisabled={false}
        nextLabel="Continue"
        nextDisabled
        nextHint="Select an answer to continue"
        progressLabel="Onboarding progress"
      >
        <div>Step content</div>
      </WizardShell>,
    )
    expect(screen.getByText('Select an answer to continue')).toBeInTheDocument()

    rerender(
      <WizardShell
        steps={steps}
        currentStep={0}
        completedSteps={[]}
        onBack={vi.fn()}
        onNext={vi.fn()}
        backDisabled={false}
        nextLabel="Continue"
        nextDisabled={false}
        nextHint="Select an answer to continue"
        progressLabel="Onboarding progress"
      >
        <div>Step content</div>
      </WizardShell>,
    )
    expect(screen.queryByText('Select an answer to continue')).not.toBeInTheDocument()
  })
})
