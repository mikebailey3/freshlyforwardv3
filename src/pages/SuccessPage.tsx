import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getProductByPriceId } from '../stripe-config';
import type { UserSubscription, UserOrder } from '../types';

type SuccessState = 'loading' | 'subscription' | 'payment' | 'error';

export function SuccessPage() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [state, setState] = useState<SuccessState>('loading');
  const [planName, setPlanName] = useState<string | null>(null);

  useEffect(() => {
    let attempts = 0;
    const maxAttempts = 8;

    async function checkStatus() {
      attempts++;

      // Check subscriptions first
      const { data: subData } = await supabase
        .from('stripe_user_subscriptions')
        .select('*')
        .maybeSingle();

      if (subData) {
        const sub = subData as UserSubscription;
        if (sub.subscription_status === 'active' || sub.subscription_status === 'trialing') {
          const product = sub.price_id ? getProductByPriceId(sub.price_id) : undefined;
          setPlanName(product?.shortName ?? 'your plan');
          setState('subscription');
          return;
        }
      }

      // Check orders
      const { data: orderData } = await supabase
        .from('stripe_user_orders')
        .select('*')
        .order('order_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (orderData) {
        const order = orderData as UserOrder;
        if (order.payment_status === 'paid') {
          setState('payment');
          return;
        }
      }

      if (attempts < maxAttempts) {
        setTimeout(checkStatus, 1500);
      } else {
        // Assume success even if webhook hasn't fired yet
        setState('payment');
      }
    }

    checkStatus();
  }, [sessionId]);

  if (state === 'loading') {
    return (
      <main className="success-page">
        <div className="success-card">
          <div className="success-spinner">
            <span className="spinner spinner--lg" />
          </div>
          <p className="success-card__loading-text">Confirming your payment…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="success-page">
      <div className="success-card">
        <div className="success-card__icon">🎉</div>
        <h1 className="success-card__headline">
          {state === 'subscription' ? 'Welcome aboard!' : 'Purchase complete!'}
        </h1>
        <p className="success-card__message">
          {state === 'subscription'
            ? `Your ${planName} subscription is now active. Your Career Strategist will be in touch shortly.`
            : 'Your Career Kickstart package is confirmed. Expect to hear from your Career Strategist within 1 business day.'}
        </p>

        <div className="success-card__steps">
          <h3>What happens next</h3>
          <ol>
            <li>You'll receive a confirmation email with details.</li>
            <li>A dedicated Career Strategist will be assigned to your account.</li>
            <li>You'll be contacted to schedule your first session.</li>
          </ol>
        </div>

        <div className="success-card__actions">
          <Link to="/pricing" className="btn btn--primary">View your plan</Link>
        </div>
      </div>
    </main>
  );
}