// Homepage Redesign Phase 1 / North Star fidelity pass: small decorative
// career-path graphic for the final CTA band, echoing the hero's
// HeroCareerPath without duplicating its complexity (no human figure, no
// floating cards -- this is a simple horizontal accent, matching the
// reference's slimmer footer treatment). Own gradient/filter ids so it can
// never collide with HeroCareerPath's ids on the same page.
export function FooterCareerPath({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 600 80" preserveAspectRatio="none" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="footer-path-gradient" x1="0" y1="70" x2="600" y2="10" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3a5f82" />
          <stop offset="1" stopColor="#7ee4b6" />
        </linearGradient>
      </defs>
      <path
        d="M 10 65 C 120 60, 200 45, 300 40 C 400 35, 480 20, 590 12"
        stroke="url(#footer-path-gradient)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="2 9"
        opacity="0.6"
      />
      <circle cx="10" cy="65" r="5" fill="#7ee4b6" opacity="0.8" />
      <circle cx="300" cy="40" r="4" fill="#7ee4b6" opacity="0.6" />
      <circle cx="590" cy="12" r="6" fill="#7ee4b6" />
    </svg>
  )
}
