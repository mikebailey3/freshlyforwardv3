/** Success/warning color-band cutoffs. Defaults (80/50) preserve every
 * existing Dashboard call site's behavior untouched; Opportunity Engine
 * passes its own presentation tiers (see opportunityEngineTiers.ts) so
 * the two features never silently share -- or accidentally diverge on --
 * the same hardcoded numbers. */
interface CircularProgressTierThresholds {
  success: number
  warning: number
}

const DEFAULT_TIER_THRESHOLDS: CircularProgressTierThresholds = { success: 80, warning: 50 }

interface CircularProgressProps {
  value: number
  size?: number
  strokeWidth?: number
  label?: string
  /** Text appended after the numeric value. Defaults to '%' so every
   * existing caller (all of which render a percentage) is unaffected. */
  suffix?: string
  tierThresholds?: CircularProgressTierThresholds
}

export function CircularProgress({
  value,
  size = 80,
  strokeWidth = 8,
  label = 'Complete',
  suffix = '%',
  tierThresholds = DEFAULT_TIER_THRESHOLDS,
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(100, value))

  const colorClass = clamped >= tierThresholds.success ? 'text-success-500' : clamped >= tierThresholds.warning ? 'text-warning-500' : 'text-error-500'
  const textColorClass = clamped >= tierThresholds.success ? 'text-success-600' : clamped >= tierThresholds.warning ? 'text-warning-600' : 'text-error-600'

  return (
    <div className="relative" style={{ height: size, width: size }}>
      <svg className="h-full w-full -rotate-90" viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="currentColor" strokeWidth={strokeWidth}
          className="text-neutral-100"
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="currentColor" strokeWidth={strokeWidth}
          strokeDasharray={`${(clamped / 100) * circumference} ${circumference}`}
          strokeLinecap="round"
          className={`${colorClass} transition-all duration-700`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`font-mono font-bold ${textColorClass}`} style={{ fontSize: size * 0.22 }}>
          {clamped}{suffix}
        </span>
        {label && <span className="text-neutral-500" style={{ fontSize: size * 0.09 }}>{label}</span>}
      </div>
    </div>
  )
}
