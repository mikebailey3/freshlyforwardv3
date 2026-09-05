// Homepage Redesign Phase 1 / North Star fidelity pass: wavy connecting
// line behind the "How FreshlyForward Works" steps, replacing the old flat
// straight divider to match the reference's curved connector. Purely
// decorative (aria-hidden); step content/order is unchanged.
export function HowItWorksConnector({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 1000 60"
      preserveAspectRatio="none"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M 20 30 C 140 0, 240 60, 360 30 C 480 0, 580 60, 700 30 C 800 0, 880 60, 980 30"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray="1 10"
        strokeLinecap="round"
      />
    </svg>
  )
}
