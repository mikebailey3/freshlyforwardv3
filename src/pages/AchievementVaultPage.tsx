import { useEffect, useState } from 'react'
import { MemberLayout } from '@/components/MemberLayout'
import { useAuth } from '@/context/AuthContext'
import { useBadges } from '@/hooks/useBadges'
import { MembershipBadgeShield, AchievementBadgeCircle } from '@/components/Badges'
import { supabase } from '@/lib/supabase'
import { Award, Loader2 } from 'lucide-react'
import type { Badge } from '@/types'

// Same rounded-2xl + shadow-sm card chrome introduced on Opportunity
// Engine (Sub-Project 3) and carried into Dashboard (Sub-Project 4) --
// this page's two cards were still on the old sharp-cornered, shadow-less
// `border border-border bg-surface-card p-6` treatment before this pass.
const CARD_CLASS = 'rounded-2xl border border-border bg-surface-card p-6 shadow-sm'

export function AchievementVaultPage() {
  const { user } = useAuth()
  const { earnedBadges, hasBadge, loading: badgesLoading } = useBadges(user?.id)
  const [allBadges, setAllBadges] = useState<Badge[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('badges')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .then(({ data, error }) => {
        if (error) console.error('Error loading badges:', error)
        setAllBadges((data as Badge[]) || [])
        setLoading(false)
      })
  }, [])

  const membershipBadges = allBadges.filter((b) => b.badge_type === 'membership')
  const achievementBadges = allBadges.filter((b) => b.badge_type === 'achievement')
  const earnedCount = earnedBadges.length

  if (loading || badgesLoading) {
    return (
      <MemberLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      </MemberLayout>
    )
  }

  return (
    <MemberLayout>
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-primary-950">
          <Award className="h-5 w-5 text-primary-500" />
        </div>
        <div>
          {/* `!` important modifiers: same pre-existing, unlayered global
              h1{font-size:clamp(...)} rule found during Sub-Project 3/4
              (index.css) silently overrides plain text-2xl/text-3xl
              classes on a bare <h1>. Scoped locally here for the same
              reason as before -- the global rule also affects the
              already-locked homepage hero, so it's not touched globally
              as a side effect of this page's redesign. */}
          <h1 className="font-display !text-2xl font-semibold text-ink sm:!text-3xl">Achievement Vault</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {earnedCount} of {allBadges.length} badges earned. Every badge is earned through real progress.
          </p>
        </div>
      </div>

      <div className={CARD_CLASS}>
        <h2 className="font-display !text-base font-semibold text-ink">Membership Badges</h2>
        <p className="mt-1 text-xs text-ink-muted">Show your current membership and special status.</p>
        <div className="mt-5 flex flex-wrap gap-8">
          {membershipBadges.map((badge) => (
            <div key={badge.id} className={`flex flex-col items-center ${hasBadge(badge.slug) ? '' : 'opacity-30 grayscale'}`}>
              <MembershipBadgeShield badge={badge} size="lg" />
              <p className="mt-2 max-w-[110px] text-center text-xs font-semibold text-ink">{badge.name}</p>
              <p className="mt-0.5 max-w-[130px] text-center text-[11px] text-ink-muted">{badge.description}</p>
            </div>
          ))}
        </div>
      </div>

      <div className={`mt-6 ${CARD_CLASS}`}>
        <h2 className="font-display !text-base font-semibold text-ink">Achievement Badges</h2>
        <p className="mt-1 text-xs text-ink-muted">Earned by reaching meaningful milestones.</p>
        <div className="mt-5 grid grid-cols-2 gap-6 sm:grid-cols-4 lg:grid-cols-6">
          {achievementBadges.map((badge) => {
            const earned = hasBadge(badge.slug)
            return (
              <div key={badge.id} className="flex flex-col items-center">
                <AchievementBadgeCircle badge={badge} size="lg" locked={!earned} />
                <p className={`mt-2 text-center text-xs font-medium ${earned ? 'text-ink' : 'text-ink-muted'}`}>
                  {badge.name}
                </p>
                <p className="mt-0.5 text-center text-[11px] text-ink-muted">{badge.description}</p>
              </div>
            )
          })}
        </div>
      </div>

      {earnedCount === 0 && (
        <div className="mt-6 rounded-2xl border border-dashed border-border bg-surface-subtle p-6 text-center">
          <p className="text-sm text-ink-muted">
            You haven't earned any badges yet. Complete your Career Profile, submit applications, and land
            interviews to start unlocking achievements.
          </p>
        </div>
      )}
    </MemberLayout>
  )
}
