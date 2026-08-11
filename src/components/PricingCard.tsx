import { useState } from 'react';
import type { StripeProduct } from '../stripe-config';
import { formatPrice } from '../stripe-config';
import { supabase } from '../lib/supabase';

interface PricingCardProps {
  product: StripeProduct;
  isCurrentPlan?: boolean;
  onAuthRequired: () => void;
}

export function PricingCard({ product, isCurrentPlan, onAuthRequired }: PricingCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCheckout = async () => {
    setError(null);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      onAuthRequired();
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            price_id: product.priceId,
            success_url: `${window.location.origin}/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${window.location.origin}/pricing`,
            mode: product.mode,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Checkout failed');
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(false);
    }
  };

  return (
    <div className={`pricing-card ${product.featured ? 'pricing-card--featured' : ''} ${isCurrentPlan ? 'pricing-card--current' : ''}`}>
      {product.badge && (
        <div className="pricing-card__badge">{product.badge}</div>
      )}

      <div className="pricing-card__header">
        <h3 className="pricing-card__name">{product.shortName}</h3>
        <div className="pricing-card__price">
          <span className="pricing-card__amount">{formatPrice(product)}</span>
          <span className="pricing-card__period">
            {product.mode === 'subscription' ? '/month' : ' one-time'}
          </span>
        </div>
        <p className="pricing-card__description">{product.description}</p>
      </div>

      <ul className="pricing-card__features">
        {product.features.map((feature) => (
          <li key={feature} className="pricing-card__feature">
            <span className="pricing-card__check" aria-hidden="true">✓</span>
            {feature}
          </li>
        ))}
      </ul>

      <div className="pricing-card__footer">
        {error && <p className="pricing-card__error">{error}</p>}
        {isCurrentPlan ? (
          <button className="btn btn--current" disabled>Current Plan</button>
        ) : (
          <button
            className={`btn ${product.featured ? 'btn--primary' : 'btn--outline'} btn--full`}
            onClick={handleCheckout}
            disabled={loading}
          >
            {loading ? (
              <span className="btn__loader">
                <span className="spinner" />
                Redirecting…
              </span>
            ) : (
              product.mode === 'payment' ? 'Get Started' : 'Subscribe'
            )}
          </button>
        )}
      </div>
    </div>
  );
}