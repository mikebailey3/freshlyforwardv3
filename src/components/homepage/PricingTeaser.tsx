// Homepage Redesign Phase 1 / Task 8: Pricing section teaser. Fetches the
// exact same `membership_plans` data PricingPage.tsx uses (same table,
// same is_enabled/is_archived/sort_order filters) -- per the locked spec
// decision, pricing must never be hardcoded here. Deliberately does not
// introduce a new shared hook: every other page that reads membership_plans
// (PricingPage, MembershipPage, CheckoutPage, the admin pages) already
// writes its own small supabase call rather than sharing one, so this
// follows the codebase's existing convention instead of adding a new
// abstraction on top of it.
import { useEffect, useState } from 'react'
import { AlertCircle, Check, Loader2 } from 'lucide-react'
import { LinkButton } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import type { MembershipPlan } from '@/types'

export function PricingTeaser() {
  const [plans, setPlans] = useState<MembershipPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('membership_plans')
      .select('*')
      .eq('is_enabled', true)
      .eq('is_archived', false)
      .order('sort_order', { ascending: true })
      .then(({ data, error }) => {
        if (error || !data) {
          setError('Could not load plans right now.')
        } else {
          setPlans(data as MembershipPlan[])
        }
        setLoading(false)
      })
  }, [])

  return (
    <section className="shell py-20" aria-labelledby="pricing-title">
      <div className="text-center">
        <p className="eyebrow">Simple, flexible pricing</p>
        <h2 id="pricing-title" className="font-display mt-2 text-3xl font-semibold sm:text-4xl">Choose the support your search needs now.</h2>
        <p className="mx-auto mt-4 max-w-xl text-neutral-600">No long-term contracts. Every plan includes real human support.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-[color:var(--color-primary-600)]" aria-label="Loading plans" />
        </div>
      ) : error || plans.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <AlertCircle className="h-10 w-10 text-neutral-400" aria-hidden="true" />
          <p className="text-neutral-600">{error ?? "Plans aren't available to show right now."}</p>
        </div>
      ) : (
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <article
              key={plan.slug}
              className={`flex flex-col rounded-[var(--radius)] border p-8 shadow-[var(--shadow)] ${
                plan.is_featured ? 'border-[color:var(--color-primary-600)] bg-[color:var(--color-primary-50)]' : 'border-neutral-200 bg-white'
              }`}
            >
              {plan.badge && (
                <span className="mb-3 w-fit rounded-full bg-[color:var(--color-primary-600)] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">{plan.badge}</span>
              )}
              <h3 className="font-display text-xl font-semibold">{plan.name}</h3>
              <p className="mt-2 text-sm text-neutral-600">{plan.description}</p>
              <div className="mt-4 flex items-baseline gap-1">
                <strong className="text-3xl font-bold">{formatCurrency(plan.price_cents)}</strong>
                <span className="text-sm text-neutral-500">/{plan.interval}</span>
              </div>
              <ul className="mt-5 space-y-2 text-sm text-neutral-700">
                {plan.features.slice(0, 4).map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check size={16} className="mt-0.5 flex-shrink-0 text-[color:var(--color-primary-600)]" aria-hidden="true" />
                    {feature}
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                <LinkButton to={`/signup?plan=${plan.slug}`} variant={plan.is_featured ? 'primary' : 'secondary'}>
                  Get started
                </LinkButton>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="mt-10 flex justify-center">
        <LinkButton to="/pricing" variant="secondary">See full pricing details</LinkButton>
      </div>
    </section>
  )
}
