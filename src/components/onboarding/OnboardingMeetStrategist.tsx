import { useEffect, useState } from 'react'
import { User, Mail, Calendar, MessageSquare } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface OnboardingStepProps {
  onNext: () => void
  onBack: () => void
}

export function OnboardingMeetStrategist({ onNext }: OnboardingStepProps) {
  const [strategistName, setStrategistName] = useState<string | null>(null)

  useEffect(() => {
    supabase.rpc('get_my_strategist').then(({ data }) => {
      const row = Array.isArray(data) ? data[0] : null
      if (row?.strategist_name) setStrategistName(row.strategist_name)
    })
  }, [])

  return (
    <div>
      <h1 className="font-serif text-3xl font-semibold text-ink sm:text-4xl">
        Meet Your Career Strategist
      </h1>
      <p className="mt-4 text-lg text-ink-muted">
        Your Career Strategist is a dedicated human professional who will personally guide your job search.
      </p>

      <div className="mt-10 border border-border bg-surface-card p-6 sm:p-8">
        <div className="flex flex-col items-center gap-6 sm:flex-row">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary-950">
            <User className="h-12 w-12 text-primary-600" />
          </div>
          <div className="text-center sm:text-left">
            <h2 className="font-serif text-xl font-semibold text-ink">
              {strategistName ? strategistName : 'Your Dedicated Strategist'}
            </h2>
            <p className="mt-2 text-sm text-ink-muted">
              You will be matched with a Career Strategist who understands your industry and career goals.
              They will be your single point of contact throughout your membership.
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {[
            { icon: Mail, title: 'Direct Messaging', desc: 'Message your Strategist anytime. No bots, no tickets.' },
            { icon: Calendar, title: 'Strategy Sessions', desc: 'Regular check-ins to keep your search on track.' },
            { icon: MessageSquare, title: 'Personalized Guidance', desc: 'Real advice from a real person who knows your story.' },
            { icon: User, title: 'One Point of Contact', desc: 'No rotating reps or call centers. Just your Strategist.' },
          ].map((item) => (
            <div key={item.title} className="flex items-start gap-3 border border-border bg-surface-subtle p-4">
              <item.icon className="h-5 w-5 flex-shrink-0 text-primary-600" />
              <div>
                <h3 className="text-sm font-semibold text-ink">{item.title}</h3>
                <p className="mt-0.5 text-xs text-ink-muted">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-6 text-center text-sm text-ink-muted">
        {strategistName
          ? `${strategistName} has already been notified and sent you a welcome message — check Messages after onboarding.`
          : "Your Strategist will be assigned as soon as your account is set up."}
      </p>
    </div>
  )
}
