import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useBadges } from '@/hooks/useBadges'
import { AchievementBadgeCircle } from '@/components/Badges'
import { Award, Loader2, ArrowRight } from 'lucide-react'

const CARD_CLASS = 'rounded-2xl border border-border bg-surface-card p-6 shadow-sm'

/**
 * "Your evidence" teaser for Career Success (Sub-Project 7).
 *
 * Real data only -- reuses useBadges(), the exact hook
 * AchievementVaultPage.tsx already uses, and deliberately stops at a
 * concise summary (count + most recent badge) rather than re-rendering the
 * full membership/achievement badge grid, per the spec's "do not duplicate
 * the full Vault UI" instruction. No second query against the `badges`
 * table -- the earned-of-total fraction is Vault's job, not this teaser's.
 */
export function CareerSuccessVaultTeaser() {
  const { user } = useAuth()
  const { earnedBadges, loading } = useBadges(user?.id)
  const mostRecent = earnedBadges[0]

  return (
    <div className={CARD_CLASS}>
      <div className="flex items-center gap-2">
        <Award className="h-5 w-5 text-primary-600" />
        <h2 className="font-display !text-lg font-semibold text-ink">Your evidence</h2>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
        </div>
      ) : earnedBadges.length > 0 && mostRecent?.badge ? (
        <div className="mt-3 flex items-center gap-3">
          <AchievementBadgeCircle badge={mostRecent.badge} size="md" />
          <div>
            <p className="text-sm text-ink">
              {earnedBadges.length} badge{earnedBadges.length === 1 ? '' : 's'} earned.
            </p>
            <p className="text-sm text-ink-muted">Most recent: {mostRecent.badge.name}</p>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-ink-muted">
          No badges earned yet. Complete your Career Profile and land your first interview to
          start earning.
        </p>
      )}

      <Link
        to="/achievement-vault"
        className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-400"
      >
        View Achievement Vault
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </div>
  )
}
