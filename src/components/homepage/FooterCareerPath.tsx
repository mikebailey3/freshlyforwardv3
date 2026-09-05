// Homepage North Star fidelity pass: Final CTA multi-milestone career-path
// motif, replacing the old thin 3-dot dashed strip. Echoes HeroCareerPath's
// glow/gradient/dash-flow language (same `.hero-path-line` animation class,
// which already respects prefers-reduced-motion app-wide via the global
// media-query override in index.css -- no new motion CSS needed) without
// duplicating the hero's composition: no FreshFit ring, no walking figure,
// no floating cards.
//
// Deliberately does NOT draw its own node circles -- the real milestone
// dots live in LandingPage.tsx's HTML <ol> (same pattern HeroCareerPath
// uses: decorative SVG behind, real accessible text/markup on top). This
// component is positioned via a wrapper sized to exactly match that <ol>'s
// own dot row height (`h-3`, 12px), so the line passes through the dots'
// true rendered position instead of a guessed absolute offset -- an earlier
// version guessed `top-5` against the row and rendered visibly below the
// dots. `overflow-visible` plus a taller-than-the-box viewBox lets the
// path's very slight rise read as "climbing" without needing an arrowhead
// (which, drawn as raw SVG coordinates in the first attempt, clipped at the
// viewBox edge and visually crossed through the last label's text).
export function FooterCareerPath({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`overflow-visible ${className}`}
      viewBox="0 0 1000 12"
      preserveAspectRatio="none"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="final-cta-path-gradient" x1="0" y1="10" x2="1000" y2="2" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3a5f82" />
          <stop offset="1" stopColor="#7ee4b6" />
        </linearGradient>
        <filter id="final-cta-path-glow" x="-5%" y="-400%" width="110%" height="900%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Soft glow layer, duplicate of the same path. A gentle, shallow
          rise (10 -> 2 across the full width) reads as forward progress
          without needing a separate arrowhead glyph. */}
      <path
        d="M 100 10 C 300 8, 500 6, 700 4 C 800 3, 850 2.5, 900 2"
        stroke="url(#final-cta-path-gradient)"
        strokeWidth="4"
        strokeLinecap="round"
        opacity="0.5"
        filter="url(#final-cta-path-glow)"
      />

      {/* Crisp foreground stroke with the same upward-flowing dash animation
          HeroCareerPath uses. */}
      <path
        className="hero-path-line"
        d="M 100 10 C 300 8, 500 6, 700 4 C 800 3, 850 2.5, 900 2"
        stroke="url(#final-cta-path-gradient)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray="2 8"
      />
    </svg>
  )
}
