import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { ARCHETYPE_LABELS } from '@/lib/careerCompass'
import type { ArchetypeKey } from '@/types/careerCompass'

interface CompassSummaryCardProps {
  result: { primary_archetype: ArchetypeKey; primary_barrier: string } | null
}

export function CompassSummaryCard({ result }: CompassSummaryCardProps) {
  return (
    <div className="border border-neutral-200 bg-white p-6">
      <div className="flex items-center gap-2">
        <Compass className="h-5 w-5 text-primary-600" />
        <h3 className="font-serif text-base font-semibold text-neutral-900">Career Compass</h3>
      </div>
      {result ? (
        <div className="mt-3">
          <p className="text-sm text-neutral-700">
            Primary archetype: <span className="font-semibold">{ARCHETYPE_LABELS[result.primary_archetype]}</span>
          </p>
          <p className="mt-1 text-sm text-neutral-700">Primary barrier: {result.primary_barrier}</p>
          <Link to="/career-compass/results" className="mt-2 inline-block text-xs font-medium text-primary-600 hover:underline">
            View full results
          </Link>
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-sm text-neutral-600">You haven't taken the Career Compass yet.</p>
          <Link
            to="/career-compass"
            className="mt-2 inline-block rounded-full bg-primary-600 px-4 py-2 text-xs font-semibold text-white hover:bg-primary-700"
          >
            Take the free assessment
          </Link>
        </div>
      )}
    </div>
  )
}
