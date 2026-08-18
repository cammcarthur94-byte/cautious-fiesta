export type PlanTierKey = 'FREE' | 'BASIC' | 'PRO';

export interface PlanConfig {
  id: PlanTierKey;
  name: string;
  price: number;
  currencyCode: string;
  interval: 'EVERY_30_DAYS' | 'ANNUAL';
  limit: number;
  description: string;
  badge?: string;
  features: string[];
}

export const PLAN_TIERS: Record<PlanTierKey, PlanConfig> = {
  FREE: {
    id: 'FREE',
    name: 'Free Tier',
    price: 0,
    currencyCode: 'USD',
    interval: 'EVERY_30_DAYS',
    limit: 5,
    description: 'Essential AI visibility audit for small catalogs and testing.',
    features: [
      'Max 5 product optimizations / month',
      'Deterministic GEO, AEO & AIO scoring engine',
      'Overall Store AI Readiness Score',
      'Manual single-product audit inspection',
      'Community support',
    ],
  },
  BASIC: {
    id: 'BASIC',
    name: 'Basic Plan',
    price: 29.0,
    currencyCode: 'USD',
    interval: 'EVERY_30_DAYS',
    limit: 1000,
    badge: 'Most Popular',
    description: 'Complete automation toolkit for growing Shopify stores.',
    features: [
      'Up to 1,000 product optimizations / month',
      'Full catalog sync & background batch auditing',
      'One-click Gemini AI description enhancement',
      'JSON-LD Schema & FAQ automated injection',
      'Rollback safety backup history',
      'Priority email support',
    ],
  },
  PRO: {
    id: 'PRO',
    name: 'Pro Plan',
    price: 99.0,
    currencyCode: 'USD',
    interval: 'EVERY_30_DAYS',
    limit: 10000,
    badge: 'Power Seller',
    description: 'High-volume AI search engine dominance for enterprise scale.',
    features: [
      'Up to 10,000 product optimizations / month',
      'All Basic Tier features included',
      'Multi-engine visibility tracking (Perplexity, ChatGPT, Gemini)',
      'Automated recurring nightly re-audits (Cron)',
      'Custom JSON-LD schema extensions',
      'Dedicated support & 1-on-1 onboarding',
    ],
  },
};

export interface SubscriptionRecord {
  id?: string;
  shop_domain: string;
  active_plan: PlanTierKey;
  billing_cycle_end: string;
  optimizations_used_this_month: number;
  shopify_subscription_id: string | null;
  status: string;
  created_at?: string;
  updated_at?: string;
}

export interface UsageCheckResult {
  allowed: boolean;
  activePlan: PlanTierKey;
  planName: string;
  used: number;
  limit: number;
  remaining: number;
  percent: number;
  billingCycleEnd: string;
  message?: string;
}
