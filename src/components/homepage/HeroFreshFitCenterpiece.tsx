import { CircularProgress } from '@/components/CircularProgress'
import { DEFAULT_PRESENTATION_TIERS } from '@/lib/opportunityEngineTiers'

// Homepage Redesign Phase 1 / Task 3: the hero's FreshFit centerpiece.
//
// SAMPLE DATA ONLY -- this is a hand-authored marketing score, never wired
// to any real member's data. Reuses the real CircularProgress component
// (scaled via its `size` prop) and the real Opportunity Engine tier
// *thresholds* (opportunityEngineTiers.ts, via `tierThresholds` below) so
// the ring's color banding never diverges from the actual feature's
// success/warning cutoffs.
//
// Hard requirement carried over from ForwardScoreWidget.tsx's same
// constraint: never caption this with "hiring probability", "salary
// potential"/"guaranteed salary", "employer", "human worth", or "objective
// prediction" language -- it's a directional fit snapshot, same framing as
// the real Forward Score and FreshFit.
//
// Hero fidelity round 7 (North Star ring typography pass): the caption
// under the score is now the literal marketing copy "Strong Match" (this
// component always displays the same hardcoded 82 sample, so it's a fixed
// string here rather than a `PRESENTATION_TIER_LABELS` lookup -- that
// lookup produces "Highest Fit", which is the real Opportunity Engine's
// own tier language used on actual match cards elsewhere in the product;
// this hero ring is a separate illustrative marketing display and isn't
// changing that real feature's terminology). The bottom "Sample" watermark
// is removed -- the component's own SAMPLE DATA ONLY comment (and the
// still-labeled "Sample" captions on the flagship preview cards further
// down the page) already establish this is illustrative, so a third
// repeated disclaimer directly under the ring was redundant clutter the
// North Star reference doesn't have. Vertical rhythm tightened to match
// the reference's caption / ring / sub-label stack.
//
// `size`: owner checkpoint round 1 added this so the tablet composition
// can reuse the same component at a smaller footprint instead of a
// duplicate implementation -- compact padding/text kick in automatically
// below 150px.
const SAMPLE_SCORE = 82
const SAMPLE_LABEL = 'Strong Match'

export function HeroFreshFitCenterpiece({ size = 168 }: { size?: number }) {
  const compact = size < 150

  return (
    <div className="relative flex flex-col items-center gap-2">
      {/* Soft radial glow behind the ring instead of a boxed card -- matches
          the North Star's floating centerpiece treatment. */}
      <div
        className="absolute left-1/2 top-1/2 -z-10 h-[140%] w-[140%] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-60 blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(126,228,182,0.35) 0%, rgba(10,26,45,0) 70%)' }}
        aria-hidden="true"
      />
      <p className={`font-mono font-semibold uppercase tracking-widest text-[#7ee4b6] ${compact ? 'text-[10px]' : 'text-xs'}`}>
        FreshFit Score
      </p>
      <CircularProgress
        value={SAMPLE_SCORE}
        size={size}
        strokeWidth={compact ? 9 : 12}
        suffix=""
        label={SAMPLE_LABEL}
        tierThresholds={{ success: DEFAULT_PRESENTATION_TIERS.highest, warning: DEFAULT_PRESENTATION_TIERS.stronger }}
      />
    </div>
  )
}
