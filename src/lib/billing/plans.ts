export type PlanTierKey = 'FREE' | 'GROWTH_PILOT';

/**
 * Legacy plan keys from the old 3-tier model.
 * Used only for backwards-compatible webhook handling — map to canonical tiers.
 */
export type LegacyPlanTierKey = 'BASIC' | 'PRO';

/**
 * All accepted plan key strings (canonical + legacy aliases).
 */
export type AnyPlanTierKey = PlanTierKey | LegacyPlanTierKey;

export interface PlanConfig {
  id: PlanTierKey;
  name: string;
  price: number;
  currencyCode: string;
  interval: 'EVERY_30_DAYS' | 'ANNUAL';
  /** Max AI evaluations (Gemini-powered) per billing cycle */
  limit: number;
  /** Max products the merchant can sync/track (catalog cap) */
  productLimit: number;
  /** Whether weekly automated re-audits are included */
  weeklyAudits: boolean;
  /** Whether multi-engine visibility tracking is included */
  multiEngineTracking: boolean;
  description: string;
  badge?: string;
  features: string[];
}

export const PLAN_TIERS: Record<PlanTierKey, PlanConfig> = {
  FREE: {
    id: 'FREE',
    name: 'Free Plan',
    price: 0,
    currencyCode: 'USD',
    interval: 'EVERY_30_DAYS',
    limit: 1,
    productLimit: 10,
    weeklyAudits: false,
    multiEngineTracking: false,
    description: 'Get started with AI search readiness scoring for up to 10 products.',
    features: [
      'Up to 10 products in catalog',
      '1 AI evaluation per month',
      'Deterministic GEO, AEO & AIO scoring',
      'Overall Store AI Readiness Score',
      'Manual single-product audit inspection',
      'Community support',
    ],
  },
  GROWTH_PILOT: {
    id: 'GROWTH_PILOT',
    name: 'Growth Pilot',
    price: 29.0,
    currencyCode: 'USD',
    interval: 'EVERY_30_DAYS',
    limit: 50,
    productLimit: 500,
    weeklyAudits: true,
    multiEngineTracking: true,
    description: 'Full AI optimization suite for growing Shopify stores — 500 products, weekly audits.',
    badge: 'Most Popular',
    features: [
      'Up to 500 products in catalog',
      '50 AI evaluations per month',
      'Weekly automated catalog re-audits',
      'Multi-engine tracking (ChatGPT, Perplexity, Gemini)',
      'One-click Gemini AI description enhancement',
      'JSON-LD Schema & FAQ automated injection',
      'Rollback safety backup history',
      'Priority email support',
    ],
  },
};

/**
 * Maps legacy plan keys (BASIC, PRO) to their canonical Growth Pilot equivalent.
 * Used in webhook handlers to handle existing Shopify subscriptions gracefully.
 */
export const LEGACY_PLAN_MAP: Record<LegacyPlanTierKey, PlanTierKey> = {
  BASIC: 'GROWTH_PILOT',
  PRO: 'GROWTH_PILOT',
};

/**
 * Resolve any plan key string (including legacy aliases) to a canonical PlanTierKey.
 */
export function resolveCanonicalPlan(raw: string): PlanTierKey {
  const upper = (raw || '').toUpperCase() as AnyPlanTierKey;
  if (upper === 'FREE') return 'FREE';
  if (upper === 'GROWTH_PILOT') return 'GROWTH_PILOT';
  if (upper === 'BASIC' || upper === 'PRO') return 'GROWTH_PILOT';
  return 'FREE'; // safe fallback
}

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
  /** Catalog product count (relevant to Free tier cap) */
  syncedProducts: number;
  productLimit: number;
  productCapReached: boolean;
  message?: string;
}
