import { Award, Briefcase, Target, TrendingUp } from 'lucide-react'
import { CircularProgress } from '@/components/CircularProgress'

const FLOATING_CARDS = [
  { icon: Briefcase, label: 'Top Opportunity', value: 'Strong Match', position: 'left-0 top-6' },
  { icon: TrendingUp, label: 'Profile Strength', value: '78 · Good', position: 'right-0 top-0' },
  { icon: Target, label: 'Goal Progress', value: '75% on track', position: 'bottom-20 left-2' },
  { icon: Award, label: 'Achievement Vault', value: '23 assets', position: 'bottom-6 right-2' },
] as const

/**
 * The hero's product-as-proof composition: a FreshFit score ring centerpiece,
 * a handful of floating sample stat cards, and a glowing CSS/SVG trajectory
 * path -- deliberately no raster image (see Redesign_Project.txt's
 * performance guidance: prefer gradients/borders/glows over shipped images).
 * Entire composition is decorative/illustrative; the one sr-only caption
 * plus the visible "Sample dashboard preview" caption (same copy already
 * used in HowItWorksPage.tsx) are the only things a screen reader announces
 * here, so this never reads as a real embedded dashboard.
 */
export function HeroProductVisual() {
  return (
    <div>
      <div className="relative mx-auto aspect-square w-full max-w-md" aria-hidden="true">
        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-primary-950/0 via-primary-500/10 to-primary-400/20 blur-2xl" />

        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 400 400" fill="none">
          <path
            d="M40 340 C 140 340, 160 220, 260 200 S 360 100, 360 60"
            stroke="url(#heroPathGlow)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <defs>
            <linearGradient id="heroPathGlow" x1="40" y1="340" x2="360" y2="60" gradientUnits="userSpaceOnUse">
              <stop stopColor="var(--color-primary-600)" stopOpacity="0.15" />
              <stop offset="1" stopColor="var(--color-primary-400)" stopOpacity="0.9" />
            </linearGradient>
          </defs>
        </svg>

        <div className="absolute inset-0 flex items-center justify-center">
          <div className="rounded-full border border-border bg-surface-card/90 p-6 shadow-2xl shadow-primary-500/20 backdrop-blur">
            <CircularProgress value={82} size={140} strokeWidth={10} label="FreshFit Score" />
          </div>
        </div>

        {FLOATING_CARDS.map(({ icon: Icon, label, value, position }) => (
          <div
            key={label}
            className={`absolute ${position} hidden w-36 rounded-xl border border-border bg-surface-card/95 p-3 shadow-lg backdrop-blur sm:block`}
          >
            <Icon className="h-4 w-4 text-primary-400" aria-hidden="true" />
            <p className="mt-1.5 text-[11px] font-semibold text-ink-muted">{label}</p>
            <p className="text-sm font-bold text-ink">{value}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-center font-mono text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
        Sample dashboard preview
      </p>
    </div>
  )
}
