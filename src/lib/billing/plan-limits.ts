import { getServiceSupabase } from '@/lib/supabase/client';

export interface PlanQuotaStatus {
  hasQuota: boolean;
  usedCount: number;
  planLimit: number;
  planName: string;
}

export const PLAN_LIMITS: Record<string, number> = {
  free: 25,
  growth: 250,
  enterprise: 10000,
};

/**
 * Check if a shop has remaining monthly AI optimization quota based on their active plan.
 */
export async function checkShopQuota(shopDomain: string): Promise<PlanQuotaStatus> {
  const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true' || !process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (isDemo) {
    return {
      hasQuota: true,
      usedCount: 5,
      planLimit: 25,
      planName: 'free',
    };
  }

  const supabase = getServiceSupabase();
  const { data: shop } = await supabase
    .from('shops')
    .select('plan_name, optimizations_used_this_month')
    .eq('shop_domain', shopDomain)
    .single();

  const planName = (shop?.plan_name || 'free').toLowerCase();
  const usedCount = shop?.optimizations_used_this_month || 0;
  const planLimit = PLAN_LIMITS[planName] || 25;

  return {
    hasQuota: usedCount < planLimit,
    usedCount,
    planLimit,
    planName,
  };
}
