import { Link } from 'react-router-dom'
import {
  LayoutDashboard, User, CreditCard, FileText, Calendar,
  MessageSquare, TrendingUp, Compass,
} from 'lucide-react'

interface OnboardingStepProps {
  onNext: () => void
  onBack: () => void
}

export function OnboardingDashboardIntro({ onNext }: OnboardingStepProps) {
  const features = [
    { icon: User, title: 'Career Profile', desc: 'Your complete career profile, populated from your questionnaire.' },
    { icon: TrendingUp, title: 'Search Readiness', desc: 'See how complete your profile is and what to add next.' },
    { icon: Calendar, title: 'Career Timeline', desc: 'Track every milestone in your FreshlyForward journey.' },
    { icon: MessageSquare, title: 'Messages', desc: 'Direct communication with your Career Strategist.' },
    { icon: FileText, title: 'Documents', desc: 'Upload and manage your resume and other documents.' },
    { icon: CreditCard, title: 'Membership', desc: 'Manage your billing, pause, or cancel anytime.' },
    { icon: Compass, title: 'Career Success', desc: 'Tools for long-term career growth — coming soon.' },
    { icon: LayoutDashboard, title: 'Dashboard', desc: 'Your home base — everything in one place.' },
  ]

  return (
    <div>
      <h1 className="font-serif text-3xl font-semibold text-neutral-900 sm:text-4xl">
        Your Dashboard
      </h1>
      <p className="mt-4 text-lg text-neutral-600">
        Your dashboard is your home base. Here is everything you will find there.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {features.map((feature) => (
          <div
            key={feature.title}
            className="flex items-start gap-3 border border-neutral-200 border-l-4 border-l-primary-600 bg-white p-5 transition-all"
          >
            <feature.icon className="h-6 w-6 flex-shrink-0 text-primary-600" />
            <div>
              <h3 className="font-serif text-base font-semibold text-neutral-900">{feature.title}</h3>
              <p className="mt-1 text-sm text-neutral-600">{feature.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 border border-primary-300 border-l-4 border-l-primary-600 bg-primary-50 p-5 text-center">
        <p className="text-sm text-primary-700">
          Ready to explore? Your dashboard is just one click away.
        </p>
      </div>
    </div>
  )
}
