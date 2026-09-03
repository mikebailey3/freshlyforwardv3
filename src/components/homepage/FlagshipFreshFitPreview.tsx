// Homepage Redesign Phase 1 / North Star fidelity pass: miniature product
// preview for the FreshFit flagship card. Score ring reuses the same real
// CircularProgress + tier language as HeroFreshFitCenterpiece. Breakdown
// rows use the actual JobMatchScoreBreakdown fields from src/types/index.ts
// (skillsCoverage / roleRelevance / locationFit / keywordDensity) rather
// than inventing category names like the reference image's "Leadership" or
// "Culture" -- those aren't real scoring dimensions in this codebase.
// Values shown are a hand-authored illustrative sample, labeled "Sample".
import { CircularProgress } from '@/components/CircularProgress'
import { getFreshFitTier, PRESENTATION_TIER_LABELS, DEFAULT_PRESENTATION_TIERS } from '@/lib/opportunityEngineTiers'

const SAMPLE_SCORE = 82

const SAMPLE_BREAKDOWN = [
  { label: 'Skills Coverage', value: 85 },
  { label: 'Role Relevance', value: 80 },
  { label: 'Location Fit', value: 72 },
  { label: 'Keyword Density', value: 68 },
]

export function FlagshipFreshFitPreview() {
  const tier = getFreshFitTier(SAMPLE_SCORE)
  const tierLabel = PRESENTATION_TIER_LABELS[tier]

  return (
    <div className="mt-4 flex items-start gap-4">
      <CircularProgress
        value={SAMPLE_SCORE}
        size={64}
        strokeWidth={6}
        suffix=""
        label={tierLabel}
        tierThresholds={{ success: DEFAULT_PRESENTATION_TIERS.highest, warning: DEFAULT_PRESENTATION_TIERS.stronger }}
      />
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[10px] uppercase tracking-wide text-[#7ee4b6]/70">Sample breakdown</p>
        <div className="mt-1.5 space-y-1.5">
          {SAMPLE_BREAKDOWN.map(({ label, value }) => (
            <div key={label} className="flex items-center gap-2">
              <span className="w-24 flex-shrink-0 truncate text-[11px] text-[#bac8d6]">{label}</span>
              <div className="h-1.5 flex-1 rounded-full bg-white/10">
                <div className="h-1.5 rounded-full bg-[#7ee4b6]" style={{ width: `${value}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
