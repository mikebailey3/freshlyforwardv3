import { User, Mail, Calendar, MessageSquare } from 'lucide-react'

interface OnboardingStepProps {
  onNext: () => void
  onBack: () => void
}

export function OnboardingMeetStrategist({ onNext }: OnboardingStepProps) {
  return (
    <div>
      <h1 className="font-serif text-3xl font-semibold text-neutral-900 sm:text-4xl">
        Meet Your Career Strategist
      </h1>
      <p className="mt-4 text-lg text-neutral-600">
        Your Career Strategist is a dedicated human professional who will personally guide your job search.
      </p>

      <div className="mt-10 rounded-2xl border border-neutral-200 bg-white p-6 sm:p-8">
        <div className="flex flex-col items-center gap-6 sm:flex-row">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-primary-100 to-secondary-100">
            <User className="h-12 w-12 text-primary-600" />
          </div>
          <div className="text-center sm:text-left">
            <h2 className="font-serif text-xl font-semibold text-neutral-900">Your Dedicated Strategist</h2>
            <p className="mt-2 text-sm text-neutral-600">
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
            <div key={item.title} className="flex items-start gap-3 rounded-xl bg-neutral-50 p-4">
              <item.icon className="h-5 w-5 flex-shrink-0 text-primary-600" />
              <div>
                <h3 className="text-sm font-semibold text-neutral-900">{item.title}</h3>
                <p className="mt-0.5 text-xs text-neutral-600">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-6 text-center text-sm text-neutral-500">
        Your Strategist will be assigned after you complete your questionnaire so we can match you with the best fit.
      </p>
    </div>
  )
}
