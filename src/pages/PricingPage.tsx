import { useCallback, useEffect, useState } from 'react'
import { Check, Minus, Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { LinkButton, SectionHeading } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import type { MembershipPlan } from '@/types'

export function PricingPage() {
  const [plans, setPlans] = useState<MembershipPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPlans = useCallback(() => {
    setLoading(true)
    setError(null)
    supabase
      .from('membership_plans')
      .select('*')
      .eq('is_enabled', true)
      .eq('is_archived', false)
      .order('sort_order', { ascending: true })
      .then(({ data, error }) => {
        if (error || !data) {
          setError('Could not load plans. Please try again.')
        } else {
          setPlans(data as MembershipPlan[])
        }
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    fetchPlans()
  }, [fetchPlans])

  return (
    <main>
      <section className="page-hero page-hero-centered shell">
        <div>
          <p className="eyebrow">Simple, flexible pricing</p>
          <h1>Choose the support your search needs now.</h1>
          <p>Start focused or go fully hands-on. There are no long-term contracts, and concierge service can be paused anytime.</p>
        </div>
      </section>

      <section className="pricing-section shell">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20">
            <AlertCircle className="h-12 w-12 text-neutral-400" />
            <p className="text-neutral-600">{error}</p>
            <button type="button" className="button button-secondary button-small" onClick={fetchPlans}>
              <RefreshCw size={16} /> Try again
            </button>
          </div>
        ) : plans.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
            <AlertCircle className="h-12 w-12 text-neutral-400" />
            <p className="text-neutral-600">Plans aren't available to show right now.</p>
            <p className="text-sm text-neutral-500">
              Reach out on the <Link to="/contact">contact page</Link> and we'll walk you through pricing directly.
            </p>
          </div>
        ) : (
          <div className="pricing-grid">
            {plans.map((plan) => (
              <article className={`pricing-card${plan.is_featured ? ' pricing-featured' : ''}`} key={plan.slug}>
                {plan.badge && <span className="plan-label">{plan.badge}</span>}
                <h2>{plan.name}</h2>
                <p>{plan.description}</p>
                <div className="price">
                  <strong>{formatCurrency(plan.price_cents)}</strong>
                  <span>/{plan.interval}</span>
                </div>
                <ul>
                  {plan.features.map((feature) => (
                    <li key={feature}><Check />{feature}</li>
                  ))}
                </ul>
                <LinkButton to={`/signup?plan=${plan.slug}`} variant={plan.is_featured ? 'primary' : 'secondary'}>
                  Get started
                </LinkButton>
              </article>
            ))}
          </div>
        )}
        <div className="pricing-note">
          <Minus />
          <p><strong>No contracts. Pause anytime.</strong> Concierge service renews monthly only while you want active support. Application activity always requires your authorization.</p>
        </div>
      </section>

      <section className="faq-preview shell">
        <SectionHeading eyebrow="Straightforward by design" title="What pricing includes" />
        <div className="mini-faq">
          <div>
            <h3>Are there hidden fees?</h3>
            <p>No. Your selected service and included support are discussed clearly before work begins.</p>
          </div>
          <div>
            <h3>Can I change plans?</h3>
            <p>Yes. Your needs may change as interviews begin or your search direction evolves.</p>
          </div>
          <div>
            <h3>Is a job guaranteed?</h3>
            <p>No ethical career service can guarantee an offer. We guarantee care, transparency, and the work defined in your service.</p>
          </div>
        </div>
      </section>
    </main>
  )
}
