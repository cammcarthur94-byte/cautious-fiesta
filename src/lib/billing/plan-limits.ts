import { getServiceSupabase } from '@/lib/supabase/client';
import { PLAN_TIERS, resolveCanonicalPlan } from './plans';

export interface PlanQuotaStatus {
  hasQuota: boolean;
  hasProductQuota: boolean;
  usedCount: number;
  planLimit: number;
  syncedProducts: number;
  productLimit: number;
  planName: string;
  planTier: string;
}

/**
 * Monthly AI evaluation limits per canonical plan tier.
 * Free: 1 evaluation/month (strict quota for Gemini AI calls)
 * Growth Pilot: 50 evaluations/month
 */
export const EVAL_LIMITS: Record<string, number> = {
  free: 1,
  growth_pilot: 50,
  // Legacy aliases kept for safety
  growth: 50,
  enterprise: 50,
};

/**
 * Maximum product catalog size per canonical plan tier.
 * Free: 10 products (hard cap — enforced at sync time)
 * Growth Pilot: 500 products
 */
export const PRODUCT_LIMITS: Record<string, number> = {
  free: 10,
  growth_pilot: 500,
  growth: 500,
  enterprise: 500,
};

/**
 * Check if a shop has remaining monthly AI evaluation quota AND product catalog quota.
 * Reads from the `subscriptions` table as the single authoritative source of plan tier.
 * Falls back to `shops.plan_name` if no subscription record exists.
 */
export async function checkShopQuota(shopDomain: string): Promise<PlanQuotaStatus> {
  const isDemo =
    process.env.NEXT_PUBLIC_DEMO_MODE === 'true' || !process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (isDemo) {
    return {
      hasQuota: true,
      hasProductQuota: true,
      usedCount: 0,
      planLimit: 1,
      syncedProducts: 0,
      productLimit: 10,
      planName: 'Free Plan',
      planTier: 'free',
    };
  }

  const supabase = getServiceSupabase();

  // 1. Try the subscriptions table first (authoritative source)
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('active_plan, optimizations_used_this_month, billing_cycle_end, status')
    .eq('shop_domain', shopDomain)
    .single();

  // 2. Fetch product count + plan_name fallback from shops
  const { data: shop } = await supabase
    .from('shops')
    .select('plan_name, plan_tier, synced_products_count, monthly_evaluations_used')
    .eq('shop_domain', shopDomain)
    .single();

  // Resolve canonical plan tier
  let canonicalPlan: string = 'free';
  if (sub?.active_plan && sub.status === 'ACTIVE') {
    canonicalPlan = resolveCanonicalPlan(sub.active_plan) === 'GROWTH_PILOT'
      ? 'growth_pilot'
      : 'free';
  } else if (shop?.plan_tier) {
    canonicalPlan = shop.plan_tier;
  } else if (shop?.plan_name) {
    canonicalPlan = shop.plan_name.toLowerCase();
  }

  const evalLimit = EVAL_LIMITS[canonicalPlan] ?? 1;
  const productLimit = PRODUCT_LIMITS[canonicalPlan] ?? 10;

  // Prefer subscription eval usage; fall back to shops counter
  const usedCount =
    sub?.optimizations_used_this_month ??
    shop?.monthly_evaluations_used ??
    0;

  const syncedProducts = shop?.synced_products_count ?? 0;

  // Resolve display name from PLAN_TIERS config
  const planConfigKey = canonicalPlan === 'growth_pilot' ? 'GROWTH_PILOT' : 'FREE';
  const planName = PLAN_TIERS[planConfigKey]?.name ?? canonicalPlan;

  return {
    hasQuota: usedCount < evalLimit,
    hasProductQuota: syncedProducts < productLimit,
    usedCount,
    planLimit: evalLimit,
    syncedProducts,
    productLimit,
    planName,
    planTier: canonicalPlan,
  };
}
