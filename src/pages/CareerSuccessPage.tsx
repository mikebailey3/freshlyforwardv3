import { useEffect, useState } from 'react'
import { MemberLayout } from '@/components/MemberLayout'
import { useEntitlements } from '@/hooks/useEntitlements'
import { LockedFeatureCard, UpgradeModal } from '@/components/FeatureEntitlements'
import { Sparkles, Loader2, Lock } from 'lucide-react'
import type { CareerSuccessItem, FeatureKey } from '@/types'
import { supabase } from '@/lib/supabase'

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
          <h1 className="font-serif text-2xl font-semibold text-neutral-900 sm:text-3xl">Career Success</h1>
        </div>
        <p className="mt-2 text-sm text-neutral-600">
          FreshlyForward continues helping you long after you secure employment. These tools support your
          long-term career growth and professional development.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
                className="relative border border-neutral-200 bg-white p-6 transition-colors hover:border-primary-300"
              >
                {item.is_coming_soon && (
                  <div className="absolute right-3 top-3">
                    <span className="border border-accent-300 px-2.5 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wide text-accent-700">
                      Coming Soon
                    </span>
                  </div>
                )}
                <div className="mb-4 text-2xl">
                  {iconMap[item.icon] || <Sparkles className="h-6 w-6 text-primary-600" />}
                </div>
                <h3 className="font-serif text-lg font-semibold text-neutral-900">{item.title}</h3>
                <p className="mt-2 text-sm text-neutral-600">{item.description}</p>

                {item.is_coming_soon && (
                  <div className="mt-4 border border-neutral-200 bg-neutral-50 p-3">
                    <p className="text-xs text-neutral-500">
                      This feature is in development. You will be the first to know when it launches.
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-12 border border-dashed border-primary-400 bg-[var(--cream)] p-8 text-center">
        <h2 className="font-serif text-xl font-semibold text-neutral-900">
          Your career does not stop at your next job.
        </h2>
        <p className="mt-3 text-sm text-neutral-600">
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
