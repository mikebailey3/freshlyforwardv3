import { useMemo } from 'react'
import { calculateSearchReadiness } from '@/lib/profile'
import { TrendingUp, AlertCircle, Check } from 'lucide-react'
import type { MemberProfile } from '@/types'

export function SearchReadinessWidget({ profile }: { profile: MemberProfile | null }) {
  const { score, missing } = useMemo(() => {
    if (!profile) return { score: 0, missing: [] }
    return calculateSearchReadiness(profile)
  }, [profile])

  const scoreColor = score >= 80 ? 'text-success-600' : score >= 50 ? 'text-warning-600' : 'text-error-600'
  const barColor = score >= 80 ? 'bg-success-500' : score >= 50 ? 'bg-warning-500' : 'bg-error-500'

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100">
          <TrendingUp className="h-5 w-5 text-primary-600" />
        </div>
        <div>
          <h3 className="font-serif text-base font-semibold text-neutral-900">Search Readiness</h3>
          <p className="text-xs text-neutral-500">Profile completeness</p>
        </div>
      </div>

      {/* Score */}
      <div className="mt-6 flex items-center justify-center">
        <div className="relative h-32 w-32">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50" cy="50" r="42"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              className="text-neutral-100"
            />
            <circle
              cx="50" cy="50" r="42"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              strokeDasharray={`${(score / 100) * 264} 264`}
              strokeLinecap="round"
              className={`${score >= 80 ? 'text-success-500' : score >= 50 ? 'text-warning-500' : 'text-error-500'} transition-all duration-700`}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`font-serif text-3xl font-bold ${scoreColor}`}>{score}%</span>
            <span className="text-xs text-neutral-500">Complete</span>
          </div>
        </div>
      </div>

      {/* Missing items */}
      {missing.length > 0 ? (
        <div className="mt-6">
          <p className="mb-3 text-xs font-semibold text-neutral-700">Complete these to improve your readiness:</p>
          <ul className="space-y-2">
            {missing.slice(0, 5).map((item) => (
              <li key={item.field} className="flex items-start gap-2 text-sm text-neutral-600">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning-500" />
                <span>{item.label}</span>
              </li>
            ))}
            {missing.length > 5 && (
              <li className="text-xs text-neutral-400">+ {missing.length - 5} more</li>
            )}
          </ul>
        </div>
      ) : (
        <div className="mt-6 flex items-center gap-2 rounded-lg bg-success-50 p-3">
          <Check className="h-5 w-5 text-success-600" />
          <p className="text-sm text-success-700">Your profile is complete. Your Strategist has everything needed.</p>
        </div>
      )}
    </div>
  )
}
