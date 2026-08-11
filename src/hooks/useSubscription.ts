import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { UserSubscription } from '../types';
import { getProductByPriceId } from '../stripe-config';

interface SubscriptionState {
  subscription: UserSubscription | null;
  activePlanName: string | null;
  isActive: boolean;
  loading: boolean;
}

export function useSubscription(userId: string | undefined) {
  const [state, setState] = useState<SubscriptionState>({
    subscription: null,
    activePlanName: null,
    isActive: false,
    loading: true,
  });

  useEffect(() => {
    if (!userId) {
      setState({ subscription: null, activePlanName: null, isActive: false, loading: false });
      return;
    }

    async function fetchSubscription() {
      const { data, error } = await supabase
        .from('stripe_user_subscriptions')
        .select('*')
        .maybeSingle();

      if (error || !data) {
        setState({ subscription: null, activePlanName: null, isActive: false, loading: false });
        return;
      }

      const sub = data as UserSubscription;
      const isActive = sub.subscription_status === 'active' || sub.subscription_status === 'trialing';
      const product = sub.price_id ? getProductByPriceId(sub.price_id) : undefined;

      setState({
        subscription: sub,
        activePlanName: isActive && product ? product.shortName : null,
        isActive,
        loading: false,
      });
    }

    fetchSubscription();
  }, [userId]);

  return state;
}