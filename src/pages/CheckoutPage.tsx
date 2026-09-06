import { useState, useEffect, type FormEvent } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { ensureProfile } from '@/lib/profile'
import { formatCurrency } from '@/lib/utils'
import { Compass, Check, AlertCircle, Loader2, CreditCard, Tag } from 'lucide-react'
import type { MembershipPlan } from '@/types'

export function CheckoutPage() {
  const { planSlug } = useParams<{ planSlug: string }>()
  const { user, session } = useAuth()
  const navigate = useNavigate()
  const [plan, setPlan] = useState<MembershipPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [discountCode, setDiscountCode] = useState('')
  const [appliedDiscount, setAppliedDiscount] = useState<string | null>(null)
  const [discountError, setDiscountError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return

    Promise.all([
      supabase
        .from('membership_plans')
        .select('*')
        .eq('slug', planSlug)
        .eq('is_enabled', true)
        .eq('is_archived', false)
        .maybeSingle()
        .then(({ data, error }) => {
          if (error || !data) {
            setError('Plan not found.')
            return null
          }
          setPlan(data as MembershipPlan)
          return data
        }),
      ensureProfile(user.id),
    ]).finally(() => setLoading(false))
  }, [user, planSlug])

  const handleApplyDiscount = async (e: FormEvent) => {
    e.preventDefault()
    setDiscountError(null)

    if (!discountCode.trim()) return

    const { data, error } = await supabase
      .from('discount_codes')
      .select('*')
      .eq('code', discountCode.trim().toUpperCase())
      .eq('is_active', true)
      .maybeSingle()

    if (error || !data) {
      setDiscountError('Invalid or expired discount code.')
      return
    }

    const discount = data as { code: string; discount_type: string; discount_value: number }
    setAppliedDiscount(discount.code)
  }

  const handleCheckout = async () => {
    if (!user || !plan) return
    setProcessing(true)
    setError(null)

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
      const response = await fetch(`${supabaseUrl}/functions/v1/stripe-checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // The real signed-in user's session token identifies the caller
          // for the edge function's auth.getUser() check; the anon key is
          // only the API-gateway key, not a substitute for it.
          Authorization: `Bearer ${session?.access_token}`,
          apikey: anonKey,
        },
        body: JSON.stringify({
          plan_slug: plan.slug,
          discount_code: appliedDiscount,
        }),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || 'Checkout setup failed. Stripe may not be configured yet.')
      }

      const data = await response.json()

      if (data.url) {
        window.location.href = data.url
        return
      }

      if (data.fallback) {
        // The server (stripe-checkout edge function) now always performs
        // this member_profiles activation itself before returning
        // fallback: true -- the client no longer writes it directly.
        navigate('/onboarding')
        return
      }

      throw new Error('Unexpected response from checkout service.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout failed. Please try again.')
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    )
  }

  if (!plan) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-bg">
        <AlertCircle className="h-12 w-12 text-ink-muted" />
        <p className="mt-4 text-ink-muted">{error || 'Plan not found.'}</p>
        <Link to="/pricing" className="mt-4 text-primary-600 hover:underline">
          View all plans
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <Link to="/" className="mb-8 flex items-center gap-2">
          <Compass className="h-7 w-7 text-primary-600" />
          <span className="font-display text-xl font-semibold text-ink">FreshlyForward</span>
        </Link>

        <div className="rounded-2xl border border-border bg-surface-card p-8 shadow-sm">
          <h1 className="font-display text-2xl font-semibold text-ink">Checkout</h1>
          <p className="mt-2 text-sm text-ink-muted">Review your plan and complete your purchase.</p>

          {/* Plan Summary */}
          <div className="mt-6 rounded-xl border border-border border-l-4 border-l-primary-600 bg-surface-subtle p-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-display text-lg font-semibold text-ink">{plan.name}</h2>
                {plan.badge && (
                  <span className="mt-1 inline-block rounded-full border border-primary-700 px-2.5 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wide text-primary-300">
                    {plan.badge}
                  </span>
                )}
                <p className="mt-2 text-sm text-ink-muted">{plan.description}</p>
              </div>
              <div className="text-right">
                <div className="font-display text-3xl font-bold text-ink">
                  {formatCurrency(plan.price_cents)}
                </div>
                <div className="text-sm text-ink-muted">/{plan.interval}</div>
              </div>
            </div>

            <ul className="mt-4 space-y-2">
              {plan.features.map((feature, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-ink-muted">
                  <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-success-600" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Discount Code */}
          <div className="mt-6">
            <label className="block text-sm font-medium text-ink-muted">Discount Code</label>
            <form onSubmit={handleApplyDiscount} className="mt-1 flex gap-2">
              <div className="relative flex-1">
                <Tag className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
                <input
                  type="text"
                  value={discountCode}
                  onChange={(e) => setDiscountCode(e.target.value)}
                  placeholder="Enter discount code"
                  className="w-full rounded-full border border-border py-2.5 pl-10 pr-3 text-sm text-ink focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
              <button
                type="submit"
                className="rounded-full border border-border px-4 py-2.5 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-hover"
              >
                Apply
              </button>
            </form>
            {appliedDiscount && (
              <p className="mt-2 text-sm text-success-400">Discount code "{appliedDiscount}" applied.</p>
            )}
            {discountError && (
              <p className="mt-2 text-sm text-error-400">{discountError}</p>
            )}
          </div>

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-error-700 bg-error-950 px-4 py-3 text-sm text-error-300">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Checkout Button */}
          <button
            onClick={handleCheckout}
            disabled={processing}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-primary-600 px-6 py-3.5 text-base font-semibold text-white shadow-sm transition-colors hover:bg-primary-700 disabled:opacity-60"
          >
            {processing ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Processing…
              </>
            ) : (
              <>
                <CreditCard className="h-5 w-5" />
                Complete Checkout
              </>
            )}
          </button>

          <p className="mt-4 text-center text-xs text-ink-muted">
            Your membership can be paused or canceled anytime according to our billing policy.
          </p>
        </div>
      </div>
    </div>
  )
}
