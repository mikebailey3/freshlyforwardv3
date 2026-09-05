// Homepage Redesign Phase 1 / North Star fidelity pass: small radar/dot
// illustration for the Career Compass supporting-capability card, matching
// the North Star reference's small compass graphic. Purely decorative --
// no data, no claims, just concentric rings + a few plotted dots to read
// as "a compass/assessment visual" at a glance.
export function CareerCompassRadar() {
  const rings = [34, 24, 14]
  const dots = [
    { x: 40, y: 12 },
    { x: 62, y: 40 },
    { x: 46, y: 60 },
    { x: 18, y: 46 },
  ]

  return (
    <svg viewBox="0 0 80 80" className="h-16 w-16" aria-hidden="true">
      {rings.map((r) => (
        <circle key={r} cx="40" cy="40" r={r} fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1" />
      ))}
      <line x1="40" y1="6" x2="40" y2="74" stroke="currentColor" strokeOpacity="0.15" strokeWidth="1" />
      <line x1="6" y1="40" x2="74" y2="40" stroke="currentColor" strokeOpacity="0.15" strokeWidth="1" />
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r="3" fill="currentColor" />
      ))}
      <circle cx="40" cy="40" r="2.5" fill="currentColor" />
    </svg>
  )
}
