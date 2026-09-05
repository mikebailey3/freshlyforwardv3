import { HeroFreshFitCenterpiece } from '@/components/homepage/HeroFreshFitCenterpiece'
import { HeroFloatingCard } from '@/components/homepage/HeroFloatingCard'

// Homepage Hero Redesign round 4: mobile previously hid the ENTIRE
// graphic (text-only hero below `md`), which the owner correctly called
// out as losing FreshlyForward's visual identity entirely on the most
// common viewport. This is a dedicated, compact, horizontal mini-journey
// -- NOT a shrunk copy of the desktop/tablet SVG composition (that was
// explicitly ruled out) -- built as its own small component so it stays
// simple and doesn't bloat HeroCareerPath.tsx with a third coordinate
// system. Same visual language (gradient path line, glow, mint accents,
// the real FreshFit ring) at mobile scale: person -> path -> FreshFit ->
// one opportunity card. Rendered by LandingPage.tsx directly below the
// checklist row, visible only below `md` (the tablet/desktop composition
// takes over from `md` up).
export function HeroMobileJourney() {
  return (
    <div className="reveal relative mt-8 h-28 w-full md:hidden" style={{ animationDelay: '.3s' }}>
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="hero-mobile-path-gradient" x1="6" y1="60" x2="78" y2="35" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#5b8cb8" />
            <stop offset="1" stopColor="#7ee4b6" />
          </linearGradient>
        </defs>
        <path
          d="M 11 70 C 26 60, 36 48, 46 46 C 58 44, 66 40, 78 34"
          stroke="url(#hero-mobile-path-gradient)"
          strokeWidth="1"
          strokeLinecap="round"
          strokeDasharray="0.6 2.2"
          vectorEffect="non-scaling-stroke"
        />
        <circle cx="78" cy="34" r="1.6" fill="#7ee4b6" />
        {/* Small stylized figure, same pictogram as the desktop/tablet path.
           Scaled up from an initial pass that rendered as an indistinct
           speck at mobile size -- confirmed via screenshot, not guessed. */}
        <g transform="translate(11, 70) scale(0.17)">
          <circle cx="0" cy="-34" r="8" fill="#e4ecf3" />
          <path d="M -7 -24 C -9 -10, -8 2, -4 10 L 4 10 C 6 0, 7 -12, 9 -24 C 4 -28, -3 -28, -7 -24 Z" fill="#e4ecf3" />
          <path d="M -4 8 L -14 30 L -8 33 L 0 10 Z" fill="#e4ecf3" />
          <path d="M 4 8 L 14 24 L 9 28 L 0 10 Z" fill="#e4ecf3" />
        </g>
      </svg>

      <div className="absolute left-[32%] top-1/2 z-10 -translate-x-1/2 -translate-y-1/2">
        <HeroFreshFitCenterpiece size={92} />
      </div>

      <HeroFloatingCard className="right-0 top-0 z-10 !px-3 !py-2">
        <p className="text-[9px] font-semibold uppercase tracking-wide text-[#7ee4b6]">Top Opportunity</p>
        <p className="mt-0.5 text-xs font-semibold text-white">Senior Product Manager</p>
      </HeroFloatingCard>
    </div>
  )
}
