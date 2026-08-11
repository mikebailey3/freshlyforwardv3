export interface StripeProduct {
  id: string;
  priceId: string;
  name: string;
  shortName: string;
  description: string;
  features: string[];
  price: number;
  currency: string;
  currencySymbol: string;
  mode: 'payment' | 'subscription';
  badge?: string;
  featured?: boolean;
}

export const STRIPE_PRODUCTS: StripeProduct[] = [
  {
    id: 'prod_V36pwdH8PbWaoS',
    priceId: 'price_1U31z92ZEWovO3fFi85CqNwH',
    name: 'FreshlyForward Career Kickstart',
    shortName: 'Career Kickstart',
    description:
      'A personalized career-start package designed to strengthen your job search. Includes a professional resume review and optimization, career-goal assessment, personalized job-search strategy, and recommendations from a FreshlyForward Career Strategist.',
    features: [
      'Professional resume review & optimization',
      'Career-goal assessment',
      'Personalized job-search strategy',
      'Recommendations from a Career Strategist',
    ],
    price: 49.0,
    currency: 'usd',
    currencySymbol: '$',
    mode: 'payment',
    badge: 'One-time',
  },
  {
    id: 'prod_V36Ukm3MXyBugM',
    priceId: 'price_1U31z82ZEWovO3fFyUC9z7mj',
    name: 'FreshlyForward Founding Member',
    shortName: 'Founding Member',
    description:
      'Early-access Career Success Membership with personalized career guidance, hand-selected opportunities, hand-crafted applications, professional cover letters, weekly progress reports, and direct access to a Career Strategist.',
    features: [
      'Personalized career guidance',
      'Hand-selected opportunities',
      'Hand-crafted applications',
      'Professional cover letters',
      'Weekly progress reports',
      'Direct access to a Career Strategist',
    ],
    price: 39.0,
    currency: 'usd',
    currencySymbol: '$',
    mode: 'subscription',
  },
  {
    id: 'prod_V38azMCU2P9lhx',
    priceId: 'price_1U32JY2ZEWovO3fF9tS0jxYS',
    name: 'FreshlyForward Career Growth',
    shortName: 'Career Growth',
    description:
      'Everything in Founding Member, plus weekly 30-minute mock interviews, deeper interview prep, resume updates, priority messaging, career strategy reviews.',
    features: [
      'Everything in Founding Member',
      'Weekly 30-minute mock interviews',
      'Deeper interview prep',
      'Resume updates',
      'Priority messaging',
      'Career strategy reviews',
    ],
    price: 99.0,
    currency: 'usd',
    currencySymbol: '$',
    mode: 'subscription',
    featured: true,
    badge: 'Most Popular',
  },
  {
    id: 'prod_V38cgsYX3VE2Ym',
    priceId: 'price_1U32Lc2ZEWovO3fF1FYzzxRo',
    name: 'FreshlyForward Career Concierge',
    shortName: 'Career Concierge',
    description:
      'Everything in Career Growth, plus workplace success coaching, promotion planning, compensation coaching, leadership development, quarterly career reviews, career roadmap, ongoing resume maintenance.',
    features: [
      'Everything in Career Growth',
      'Workplace success coaching',
      'Promotion planning & compensation coaching',
      'Leadership development',
      'Quarterly career reviews',
      'Career roadmap',
      'Ongoing resume maintenance',
    ],
    price: 199.0,
    currency: 'usd',
    currencySymbol: '$',
    mode: 'subscription',
  },
];

export function getProductByPriceId(priceId: string): StripeProduct | undefined {
  return STRIPE_PRODUCTS.find((p) => p.priceId === priceId);
}

export function formatPrice(product: StripeProduct): string {
  return `${product.currencySymbol}${product.price.toFixed(0)}`;
}