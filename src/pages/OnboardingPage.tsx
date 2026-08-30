import { useState, useEffect, useCallback, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { ensureProfile, addTimelineEvent } from '@/lib/profile'
import { WizardShell } from '@/components/WizardShell'
import { OnboardingWelcome } from '@/components/onboarding/OnboardingWelcome'
import { OnboardingMeetStrategist } from '@/components/onboarding/OnboardingMeetStrategist'
import { OnboardingHowItWorks } from '@/components/onboarding/OnboardingHowItWorks'
import { OnboardingQuestionnaire } from '@/components/onboarding/OnboardingQuestionnaire'
import { OnboardingDocumentUpload } from '@/components/onboarding/OnboardingDocumentUpload'
import { OnboardingConfirmation } from '@/components/onboarding/OnboardingConfirmation'
import { OnboardingDashboardIntro } from '@/components/onboarding/OnboardingDashboardIntro'
import { OnboardingCelebration } from '@/components/onboarding/OnboardingCelebration'
import { Loader2 } from 'lucide-react'

const onboardingSteps = [
  { key: 'welcome', label: 'Welcome', component: OnboardingWelcome },
  { key: 'meet_strategist', label: 'Meet Your Strategist', component: OnboardingMeetStrategist },
  { key: 'how_it_works', label: 'How It Works', component: OnboardingHowItWorks },
  { key: 'questionnaire', label: 'Questionnaire', component: OnboardingQuestionnaire },
  { key: 'document_upload', label: 'Document Upload', component: OnboardingDocumentUpload },
  { key: 'confirmation', label: 'Membership Confirmation', component: OnboardingConfirmation },
  { key: 'dashboard_intro', label: 'Dashboard Introduction', component: OnboardingDashboardIntro },
  { key: 'celebration', label: 'Completion', component: OnboardingCelebration },
]

export function OnboardingPage() {
  const { user, profile, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [currentStep, setCurrentStep] = useState(0)
  const [completedSteps, setCompletedSteps] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [savedIndicator, setSavedIndicator] = useState(false)
  const [loading, setLoading] = useState(true)

  const checkoutSuccess = searchParams.get('checkout') === 'success'

  const loadProgress = useCallback(async () => {
    if (!user) return

    const { data } = await supabase
      .from('onboarding_progress')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (data) {
      setCompletedSteps(data.completed_steps || [])
      if (data.current_step) {
        const stepIndex = onboardingSteps.findIndex((s) => s.key === data.current_step)
        if (stepIndex >= 0) setCurrentStep(stepIndex)
      }
    } else {
      await supabase.from('onboarding_progress').insert({
        user_id: user.id,
        current_step: 'welcome',
        completed_steps: [],
      })
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    if (user) {
      ensureProfile(user.id).then(() => loadProgress())
    }
  }, [user, loadProgress])

  const saveProgress = useCallback(
    async (step: number, completed: string[]) => {
      if (!user) return
      setSaving(true)
      const stepKey = onboardingSteps[step]?.key
      await supabase
        .from('onboarding_progress')
        .update({
          current_step: stepKey,
          completed_steps: completed,
        })
        .eq('user_id', user.id)
      setSaving(false)
      setSavedIndicator(true)
      setTimeout(() => setSavedIndicator(false), 2000)
    },
    [user],
  )

  const handleNext = useCallback(async () => {
    const stepKey = onboardingSteps[currentStep].key
    if (!completedSteps.includes(stepKey)) {
      const updated = [...completedSteps, stepKey]
      setCompletedSteps(updated)
      await saveProgress(currentStep, updated)
    }

    if (currentStep < onboardingSteps.length - 1) {
      const next = currentStep + 1
      setCurrentStep(next)
      await saveProgress(next, completedSteps)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      // Complete onboarding
      if (user) {
        await supabase
          .from('onboarding_progress')
          .update({ completed_at: new Date().toISOString() })
          .eq('user_id', user.id)

        await supabase
          .from('member_profiles')
          .update({
            onboarding_completed: true,
            onboarding_completed_at: new Date().toISOString(),
          })
          .eq('user_id', user.id)

        await addTimelineEvent(user.id, 'onboarding_completed', 'Onboarding Completed', 'You completed the FreshlyForward onboarding.')
        await refreshProfile()
      }
      navigate('/dashboard')
    }
  }, [currentStep, completedSteps, user, navigate, saveProgress, refreshProfile])

  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [currentStep])

  const handleSkipToStep = useCallback(
    (stepIndex: number) => {
      setCurrentStep(stepIndex)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    },
    [],
  )

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    )
  }

  const CurrentComponent = onboardingSteps[currentStep].component
  const isLastStep = currentStep === onboardingSteps.length - 1

  return (
    <WizardShell
      steps={onboardingSteps}
      currentStep={currentStep}
      completedSteps={completedSteps}
      onStepClick={handleSkipToStep}
      onBack={handleBack}
      onNext={handleNext}
      backDisabled={currentStep === 0}
      nextLabel={isLastStep ? 'Go to Dashboard' : 'Continue'}
      progressLabel="Onboarding progress"
      saving={saving}
      savedIndicator={savedIndicator}
    >
      <CurrentComponent
        onNext={handleNext}
        onBack={handleBack}
        profile={profile}
        user={user}
        checkoutSuccess={checkoutSuccess}
      />
    </WizardShell>
  )
}
