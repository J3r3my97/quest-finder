import Stripe from 'stripe';

// Lazy initialization to avoid errors during build
let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeInstance) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not set');
    }
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripeInstance;
}

// Proxy for backwards compatibility
export const stripe = new Proxy({} as Stripe, {
  get(_, prop) {
    return Reflect.get(getStripe(), prop);
  },
});

// Price IDs for subscription plans - these should be created in Stripe Dashboard
export const PRICE_IDS = {
  BASIC: process.env.STRIPE_PRICE_BASIC || 'price_basic',
  PRO: process.env.STRIPE_PRICE_PRO || 'price_pro',
  ENTERPRISE: process.env.STRIPE_PRICE_ENTERPRISE || 'price_enterprise',
} as const;

// Map Stripe price IDs to subscription tiers
export const PRICE_TO_TIER: Record<string, 'BASIC' | 'PRO' | 'ENTERPRISE'> = {
  [PRICE_IDS.BASIC]: 'BASIC',
  [PRICE_IDS.PRO]: 'PRO',
  [PRICE_IDS.ENTERPRISE]: 'ENTERPRISE',
};

// Subscription tier features
export const TIER_FEATURES = {
  FREE: {
    searchesPerDay: 10,
    savedSearches: 3,
    alerts: false,
    apiAccess: false,
  },
  BASIC: {
    searchesPerDay: 100,
    savedSearches: 10,
    alerts: true,
    apiAccess: false,
  },
  PRO: {
    searchesPerDay: -1, // unlimited
    savedSearches: 25,
    alerts: true,
    apiAccess: true,
  },
  ENTERPRISE: {
    searchesPerDay: -1, // unlimited
    savedSearches: -1, // unlimited
    alerts: true,
    apiAccess: true,
  },
} as const;
