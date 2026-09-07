import { useEffect, useState } from 'react'
import { MemberLayout } from '@/components/MemberLayout'
import { useEntitlements } from '@/hooks/useEntitlements'
import { LockedFeatureCard, UpgradeModal } from '@/components/FeatureEntitlements'
import { CareerSuccessNextStepsTeaser } from '@/components/CareerSuccessNextStepsTeaser'
import { CareerSuccessRoadmapTeaser } from '@/components/CareerSuccessRoadmapTeaser'
import { CareerSuccessVaultTeaser } from '@/components/CareerSuccessVaultTeaser'
import { Sparkles, Loader2, Lock } from 'lucide-react'
import type { CareerSuccessItem, FeatureKey } from '@/types'
import { supabase } from '@/lib/supabase'

// Same rounded-2xl + shadow-sm card chrome introduced on Opportunity Engine
// (Sub-Project 3) and carried through Dashboard/Vault/Career Profile
// (Sub-Projects 4-6) -- this page's cards were still on the old
// sharp-cornered, shadow-less `border border-border bg-surface-card p-6`
// treatment before this pass.
const CARD_CLASS = 'rounded-2xl border border-border bg-surface-card p-6 shadow-sm'

const iconMap: Record<string, string> = {
  CalendarCheck: '📅',
  TrendingUp: '📈',
  Users: '👥',
  DollarSign: '💰',
  Heart: '❤️',
  Map: '🗺️',
  Radar: '📡',
  Sparkles: '✨',
}

const itemFeatureMap: Record<string, FeatureKey> = {
  'Workplace Success Coaching': 'workplace_success_coaching',
  'Promotion Planning': 'promotion_planning',
  'Salary Coaching': 'salary_coaching',
  'Leadership Development': 'leadership_development',
  'Career Roadmap': 'career_roadmap',
  'Achievement Vault': 'achievement_vault',
  'Resume Maintenance': 'resume_maintenance',
  'Quarterly Career Reviews': 'quarterly_career_reviews',
}

const featureRequiredPlan: Record<string, string> = {
  workplace_success_coaching: 'career-concierge',
  promotion_planning: 'career-concierge',
  salary_coaching: 'career-concierge',
  leadership_development: 'career-concierge',
  career_roadmap: 'career-concierge',
  achievement_vault: 'career-concierge',
  resume_maintenance: 'career-concierge',
  quarterly_career_reviews: 'career-concierge',
}

export function CareerSuccessPage() {
  const [items, setItems] = useState<CareerSuccessItem[]>([])
  const [loading, setLoading] = useState(true)
  const { canAccess } = useEntitlements()
  const [upgradeModal, setUpgradeModal] = useState<{ featureKey: FeatureKey; requiredPlan: string } | null>(null)

  useEffect(() => {
    supabase
      .from('career_success_items')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => {
        setItems((data as CareerSuccessItem[]) || [])
        setLoading(false)
      })
  }, [])

  return (
    <MemberLayout>
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary-600" />
          {/* `!` important modifiers: same pre-existing, unlayered global
              h1{font-size:clamp(...)} rule found during Sub-Projects 3-6
              (index.css) silently overrides plain text-2xl/text-3xl classes
              on a bare <h1>. Scoped locally here for the same reason. */}
          <h1 className="font-display !text-2xl font-semibold text-ink sm:!text-3xl">Career Success</h1>
        </div>
        <p className="mt-2 text-sm text-ink-muted">
          FreshlyForward continues helping you long after you secure employment. These tools support your
          long-term career growth and professional development.
        </p>
      </div>

      {/* Section: Your current focus -- Next Steps teaser, real data only. */}
      <div className="mb-6">
        <CareerSuccessNextStepsTeaser />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      ) : (
        <div className="mb-6">
          <h2 className="mb-4 font-display !text-lg font-semibold text-ink">Ongoing coaching &amp; growth services</h2>
          <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const featureKey = itemFeatureMap[item.title]
            const requiredPlan = featureKey ? featureRequiredPlan[featureKey] : undefined
            const hasAccess = !featureKey || canAccess(featureKey)

            if (!hasAccess && featureKey) {
              return (
                <LockedFeatureCard
                  key={item.id}
                  featureKey={featureKey}
                  requiredPlan={requiredPlan}
                  title={item.title}
                  description={item.description}
                  onUpgrade={() => setUpgradeModal({ featureKey, requiredPlan: requiredPlan || '' })}
                />
              )
            }

            return (
              <div
                key={item.id}
                className={`relative ${CARD_CLASS} transition-colors hover:border-primary-700`}
              >
                {item.is_coming_soon && (
                  <div className="absolute right-3 top-3">
                    <span className="rounded-full border border-accent-700 px-2.5 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wide text-accent-300">
                      <span aria-hidden="true">Coming Soon</span>
                      <span className="sr-only">This feature is coming soon and is not yet available.</span>
                    </span>
                  </div>
                )}
                <div className="mb-4 text-2xl">
                  {iconMap[item.icon] || <Sparkles className="h-6 w-6 text-primary-600" />}
                </div>
                <h3 className="font-display !text-lg font-semibold text-ink">{item.title}</h3>
                <p className="mt-2 text-sm text-ink-muted">{item.description}</p>

                {item.is_coming_soon && (
                  <div className="mt-4 rounded-xl border border-border bg-surface-subtle p-3">
                    <p className="text-xs text-ink-muted">
                      This feature is in development. You will be the first to know when it launches.
                    </p>
                  </div>
                )}
              </div>
            )
          })}
          </div>
        </div>
      )}

      {/* Section: Your roadmap + Your evidence -- both honest link-out
          teasers, side by side on desktop, stacked on mobile/tablet. */}
      <div className="mb-6 grid gap-6 md:grid-cols-2">
        <CareerSuccessRoadmapTeaser />
        <CareerSuccessVaultTeaser />
      </div>

      <div className="mt-6 rounded-2xl border border-dashed border-primary-700 bg-surface-subtle p-8 text-center">
        <h2 className="font-display !text-xl font-semibold text-ink">
          Your career does not stop at your next job.
        </h2>
        <p className="mt-3 text-sm text-ink-muted">
          FreshlyForward is built for long-term career success. From your first application to your last promotion,
          your Career Strategist is with you every step of the way.
        </p>
      </div>

      {upgradeModal && (
        <UpgradeModal
          feature={null}
          featureKey={upgradeModal.featureKey}
          requiredPlan={upgradeModal.requiredPlan}
          isOpen={!!upgradeModal}
          onClose={() => setUpgradeModal(null)}
        />
      )}
    </MemberLayout>
  )
}
