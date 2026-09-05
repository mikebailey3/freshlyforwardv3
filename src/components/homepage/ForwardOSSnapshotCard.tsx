import { HeroFreshFitRing } from '@/components/homepage/HeroFreshFitRing'

// Homepage Hero Redesign round 10: replaces the entire round 6-9 lineage
// (winding SVG path, walking figure, 8 absolutely-positioned floating
// cards, a separate hand-tuned mobile-only component) with ONE snapshot
// card, per the owner's approved "Direction A" mockup
// (docs/superpowers/visual-review/2026-09-05-hero-mockups/direction-a.html)
// and the locked implementation design
// (docs/superpowers/specs/2026-09-05-hero-direction-a-implementation-design.md).
//
// Deliberately simple by design, not by omission -- the owner was explicit
// that this must NOT grow back into a card collection: exactly two product
// signals (FreshFit/Top Opportunity as the primary proof, Search Readiness
// as the one secondary signal), one Recommended Next Action payoff, one
// quiet strategist trust line. No connector lines, no decorative path, no
// person illustration, no extra feature callouts.
//
// SAMPLE DATA ONLY -- every value here (82, Senior Product Manager, 78,
// Interview Practice) is hand-authored marketing copy, matching this
// codebase's existing hero-illustrative-data convention (see the removed
// HeroFloatingCard cards' own SAMPLE DATA comments in git history). Never
// wired to real member/session data.
//
// Reuses the existing design system rather than inventing new tokens: the
// card surface (gradient, border, shadow) is the same technique
// HeroFloatingCard.tsx used, just applied to one larger card instead of
// eight small ones; the ring is the existing HeroFreshFitRing segmented
// dial (glow-free -- the "excessive glow" the owner ruled out lived only in
// the now-removed HeroFreshFitCenterpiece wrapper's radial-glow div, not in
// the ring itself); text colors reuse the exact mint (#7ee4b6) / body
// (#bac8d6) values already used throughout LandingPage.tsx.
//
// Responsive behavior is intentionally a single breakpoint: below `lg` the
// ring+opportunity row stacks and centers (this is the "independently
// composed for mobile" requirement -- not a shrunk copy of the desktop
// row, an actual different flex direction); at `lg`+ it's a side-by-side
// row. Every other row (Search Readiness, Next Action, strategist line)
// uses the same full-width layout at every breakpoint since none of them
// needed to change shape to read well narrow.
export function ForwardOSSnapshotCard() {
  return (
    <div
      data-testid="forwardos-snapshot-card"
      className="relative rounded-3xl border border-white/20 bg-gradient-to-b from-[color-mix(in_srgb,var(--navy-soft),white_9%)] to-[color-mix(in_srgb,var(--navy-soft),black_22%)] p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1),0_0_0_1px_rgba(126,228,182,0.08),0_22px_38px_-12px_rgba(0,0,0,0.7)] ring-1 ring-white/10 sm:p-9"
    >
      <div className="flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-hero-sans text-[11px] font-bold uppercase tracking-widest text-[#7ee4b6]">
          Your ForwardOS Snapshot
        </p>
        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#7a8ba0]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#7ee4b6]" aria-hidden="true" /> Illustrative preview
        </span>
      </div>

      {/* Primary proof: FreshFit ring + Top Opportunity. Side-by-side at
          lg+, stacked/centered below lg -- the one row in this card that
          actually changes shape between mobile and desktop. */}
      <div className="mt-7 flex flex-col items-center gap-5 text-center lg:flex-row lg:items-center lg:gap-7 lg:text-left">
        <div className="relative h-[155px] w-[155px] flex-shrink-0">
          <HeroFreshFitRing value={82} size={155} strokeWidth={12} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono text-4xl font-bold text-[#7ee4b6]">82</span>
            <span className="text-sm text-[#bac8d6]">Strong Match</span>
          </div>
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#7ee4b6]">Top Opportunity</p>
          <p className="mt-1 text-lg font-bold text-white">Senior Product Manager</p>
          <p className="text-sm text-[#bac8d6]">$120K&ndash;$130K &middot; Remote</p>
        </div>
      </div>

      <div className="mt-7 h-px w-full bg-white/10" aria-hidden="true" />

      {/* The one secondary signal -- Search Readiness, the real product
          term (see design doc for why this replaced "Resume Strength").
          Deliberately smaller/quieter than the ring above it. */}
      <div className="mt-7">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[#7ee4b6]">Search Readiness</p>
          <p className="text-sm text-[#bac8d6]">
            <span className="font-mono text-base font-bold text-white">78</span> &middot; Good
          </p>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-[78%] rounded-full bg-[#7ee4b6]" />
        </div>
      </div>

      <div className="mt-7 h-px w-full bg-white/10" aria-hidden="true" />

      {/* Payoff: intelligence -> recommended next action. */}
      <div className="mt-7 flex items-center gap-3 rounded-2xl border border-[#7ee4b6]/25 bg-[#7ee4b6]/10 px-4 py-3.5">
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#7ee4b6]/20 text-[#7ee4b6]" aria-hidden="true">
          &#8594;
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wide text-[#7ee4b6]">Recommended Next Action</p>
          <p className="text-sm font-semibold text-white">Interview Practice &middot; Today, 2:00 PM</p>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-2.5 text-sm text-[#bac8d6]">
        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-[#7ee4b6]" aria-hidden="true">
          &#9787;
        </span>
        Your strategist is here if you need a second opinion.
      </div>
    </div>
  )
}
