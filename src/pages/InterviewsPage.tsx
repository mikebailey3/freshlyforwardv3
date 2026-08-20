import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MemberLayout } from '@/components/MemberLayout'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import { Briefcase, Calendar, Loader2, MapPin, ArrowRight, Video } from 'lucide-react'
import type { Application } from '@/types'

const INTERVIEW_STATUSES = ['interview_requested', 'interview_scheduled']

export function InterviewsPage() {
  const { user } = useAuth()
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    supabase
      .from('applications')
      .select('*')
      .eq('member_id', user.id)
      .not('interview_date', 'is', null)
      .order('interview_date', { ascending: true })
      .then(({ data, error }) => {
        if (error) console.error('Error loading interviews:', error)
        setApplications((data as Application[]) || [])
        setLoading(false)
      })
  }, [user])

  if (loading) {
    return (
      <MemberLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      </MemberLayout>
    )
  }

  const now = new Date()
  const upcoming = applications.filter((a) => a.interview_date && new Date(a.interview_date) >= now)
  const past = applications.filter((a) => a.interview_date && new Date(a.interview_date) < now)

  return (
    <MemberLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-neutral-900 sm:text-3xl">Interviews</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Real employer interviews from your applications. Practicing? Head to Mock Interviews.
          </p>
        </div>
        <Link
          to="/mock-interviews"
          className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          <Video className="h-4 w-4" />
          Mock Interviews
        </Link>
      </div>

      {applications.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200 bg-white p-12 text-center">
          <Briefcase className="mx-auto h-12 w-12 text-neutral-300" />
          <p className="mt-4 text-sm text-neutral-500">
            No interviews scheduled yet. They will show up here as soon as an employer requests one.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {upcoming.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-serif text-lg font-semibold text-neutral-900">Upcoming</h2>
              {upcoming.map((app) => (
                <InterviewCard key={app.id} app={app} />
              ))}
            </div>
          )}
          {past.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-serif text-lg font-semibold text-neutral-900">Past</h2>
              {past.map((app) => (
                <InterviewCard key={app.id} app={app} />
              ))}
            </div>
          )}
        </div>
      )}
    </MemberLayout>
  )
}

function InterviewCard({ app }: { app: Application }) {
  const isActive = INTERVIEW_STATUSES.includes(app.status)
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6 transition-all hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          {isActive && (
            <span className="rounded-full bg-primary-600 px-3 py-1 text-xs font-medium text-white">
              Interview Scheduled
            </span>
          )}
          <h3 className="mt-3 font-serif text-lg font-semibold text-neutral-900">{app.job_title}</h3>
          <p className="flex items-center gap-1 text-sm text-neutral-600">
            <MapPin className="h-3.5 w-3.5" />
            {app.employer}
          </p>
          {app.interview_date && (
            <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-neutral-700">
              <Calendar className="h-4 w-4 text-primary-600" />
              {new Date(app.interview_date).toLocaleString('en-US', {
                weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
              })}
            </p>
          )}
          {app.date_submitted && (
            <p className="mt-1 text-xs text-neutral-400">Applied {formatDate(app.date_submitted)}</p>
          )}
        </div>
        <Link
          to={`/why-we-applied/${app.id}`}
          className="flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-primary-200 bg-primary-50 px-4 py-2 text-sm font-medium text-primary-700 transition-colors hover:bg-primary-100"
        >
          Prep Notes
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}
