import { useEffect, useState } from 'react'
import { MemberLayout } from '@/components/MemberLayout'
import { useAuth } from '@/context/AuthContext'
import { getTimeline } from '@/lib/profile'
import { formatDate } from '@/lib/utils'
import {
  Compass, FileCheck, FileText, User, Calendar, Mail, Briefcase,
  Award, TrendingUp, Sparkles, Loader2, CheckCircle2,
} from 'lucide-react'
import type { CareerTimelineEvent } from '@/types'

const eventIcons: Record<string, typeof User> = {
  joined: Compass,
  questionnaire_completed: FileCheck,
  resume_uploaded: FileText,
  profile_updated: User,
  mock_interview: Calendar,
  application_submitted: Mail,
  interview_scheduled: Briefcase,
  offer_received: Award,
  promotion_coaching: TrendingUp,
  career_review: Sparkles,
  membership_activated: CheckCircle2,
  onboarding_completed: CheckCircle2,
}

export function TimelinePage() {
  const { user } = useAuth()
  const [events, setEvents] = useState<CareerTimelineEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    getTimeline(user.id).then((data) => {
      setEvents(data)
      setLoading(false)
    })
  }, [user])

  return (
    <MemberLayout>
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-semibold text-ink sm:text-3xl">Career Timeline</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Every milestone in your FreshlyForward journey, from start to success.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      ) : events.length > 0 ? (
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-4 top-0 h-full w-0.5 bg-border sm:left-1/2" />

          <div className="space-y-6">
            {events.map((event, i) => {
              const Icon = eventIcons[event.event_type] || CheckCircle2
              const isLeft = i % 2 === 0
              return (
                <div
                  key={event.id}
                  className={`relative flex items-start gap-4 sm:gap-0 ${
                    isLeft ? 'sm:flex-row' : 'sm:flex-row-reverse'
                  }`}
                >
                  {/* Dot */}
                  <div className="relative z-10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary-600 ring-4 ring-primary-950 sm:absolute sm:left-1/2 sm:-translate-x-1/2">
                    <Icon className="h-4 w-4 text-white" />
                  </div>

                  {/* Card */}
                  <div className={`flex-1 sm:w-1/2 ${isLeft ? 'sm:pr-8' : 'sm:pl-8'}`}>
                    <div className="border border-border border-l-4 border-l-primary-600 bg-surface-card p-4 transition-colors">
                      <p className="font-mono text-xs text-ink-muted">{formatDate(event.event_date)}</p>
                      <p className="mt-1 font-serif text-sm font-semibold text-ink">{event.event_title}</p>
                      {event.event_description && (
                        <p className="mt-1 text-sm text-ink-muted">{event.event_description}</p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="border border-border bg-surface-card p-12 text-center">
          <Compass className="mx-auto h-12 w-12 text-ink-muted" />
          <p className="mt-4 text-sm text-ink-muted">
            Your timeline will populate as your career journey progresses. Complete onboarding to get started!
          </p>
        </div>
      )}
    </MemberLayout>
  )
}
