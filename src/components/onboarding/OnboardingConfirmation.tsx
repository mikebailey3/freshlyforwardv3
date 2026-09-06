import { useAuth } from '@/context/AuthContext'
import { Check, CreditCard, Calendar, Shield } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type { MemberProfile } from '@/types'

interface OnboardingStepProps {
  onNext: () => void
  onBack: () => void
  profile: MemberProfile | null
  user: { id: string; email?: string } | null
  checkoutSuccess?: boolean
}

export function OnboardingConfirmation({ profile, checkoutSuccess }: OnboardingStepProps) {
  return (
    <div>
      <h1 className="font-serif text-3xl font-semibold text-ink sm:text-4xl">
        Membership Confirmation
      </h1>
      <p className="mt-4 text-lg text-ink-muted">
        Review your membership details below.
      </p>

      {checkoutSuccess && (
        <div className="mt-6 flex items-center gap-3 border border-success-700 border-l-4 border-l-success-600 bg-success-950 p-4">
          <Check className="h-5 w-5 text-success-600" />
          <p className="text-sm font-medium text-success-300">Payment successful! Your membership is now active.</p>
        </div>
      )}

      <div className="mt-8 border border-border bg-surface-card p-6 sm:p-8">
        <div className="flex items-center gap-3 border-b border-border pb-4">
          <CreditCard className="h-8 w-8 text-primary-600" />
          <div>
            <h2 className="font-serif text-lg font-semibold text-ink">Active Membership</h2>
            <p className="text-sm text-ink-muted">
              {profile?.subscription_status === 'active' ? 'Your membership is active.' : 'Membership will be activated after payment.'}
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink-muted">Status</span>
            <span className={`text-sm font-semibold capitalize ${
              profile?.subscription_status === 'active' ? 'text-success-600' : 'text-ink'
            }`}>
              {profile?.subscription_status || 'pending'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink-muted">Billing Cycle</span>
            <span className="text-sm font-semibold text-ink">Monthly</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink-muted">Next Billing Date</span>
            <span className="text-sm font-semibold text-ink">
              {new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="flex items-start gap-2 border border-border bg-surface-subtle p-3">
            <Calendar className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary-600" />
            <div>
              <p className="text-xs font-semibold text-ink">Pause Anytime</p>
              <p className="text-xs text-ink-muted">Pause your membership and resume when ready.</p>
            </div>
          </div>
          <div className="flex items-start gap-2 border border-border bg-surface-subtle p-3">
            <Shield className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary-600" />
            <div>
              <p className="text-xs font-semibold text-ink">Cancel Anytime</p>
              <p className="text-xs text-ink-muted">No long-term contracts. Cancel whenever you need.</p>
            </div>
          </div>
        </div>
      </div>

      <p className="mt-6 text-center text-sm text-ink-muted">
        You can manage your billing, invoices, and payment methods from the Membership page at any time.
      </p>
    </div>
  )
}
