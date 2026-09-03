// Homepage Redesign Phase 1 / North Star fidelity pass: miniature product
// preview for the Opportunity Engine flagship card. Styled after the real
// MatchCard.tsx (CircularProgress FreshFit badge, title/company, salary
// tag, matched-skill pills) so this reads as "the actual product," not an
// invented UI -- but the two rows shown are hand-authored sample matches,
// clearly labeled "Sample", never live account data.
import { CircularProgress } from '@/components/CircularProgress'

const SAMPLE_MATCHES = [
  { title: 'Senior Product Manager', company: 'Acme Inc.', salary: '$120K - $130K', score: 88, skills: ['Product Strategy', 'Roadmapping'] },
  { title: 'Product Manager', company: 'GlobalTech', salary: '$110K - $135K', score: 74, skills: ['Discovery'] },
]

export function FlagshipOpportunityPreview() {
  return (
    <div className="mt-4 space-y-2.5">
      <p className="font-mono text-[10px] uppercase tracking-wide text-[#7ee4b6]/70">Sample matches</p>
      {SAMPLE_MATCHES.map((match) => (
        <div key={match.title} className="flex items-center gap-3 rounded-lg bg-white/5 p-3">
          <CircularProgress value={match.score} size={40} strokeWidth={4} suffix="" label="" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{match.title}</p>
            <p className="truncate text-xs text-[#bac8d6]">{match.company} &middot; {match.salary}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
