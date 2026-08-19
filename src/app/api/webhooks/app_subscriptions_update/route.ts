import { NextRequest, NextResponse } from 'next/server';
import { verifyShopifyWebhook } from '@/lib/shopify-security';
import { upsertSubscriptionRecord, resolveCanonicalPlan, PlanTierKey } from '@/lib/billing';
import { getServiceSupabase } from '@/lib/supabase/client';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const verification = await verifyShopifyWebhook(req, rawBody);

    if (!verification.isValid) {
      console.warn(`[app_subscriptions_update] Unauthorized HMAC: ${verification.error}`);
      return NextResponse.json(
        { error: verification.error || 'HMAC verification failed' },
        { status: 401 }
      );
    }

    const payload = JSON.parse(rawBody || '{}');
    const appSub = payload.app_subscription || payload;

    if (!appSub) {
      return NextResponse.json({ error: 'No subscription payload found' }, { status: 400 });
    }

    const shopDomain =
      verification.shopDomain ||
      payload.shop_domain ||
      req.headers.get('x-shopify-shop-domain') ||
      '';

    const status = (appSub.status || 'ACTIVE').toUpperCase();
    const subName = (appSub.name || '').toUpperCase();
    const subscriptionId =
      appSub.admin_graphql_api_id ||
      (appSub.id ? `gid://shopify/AppSubscription/${appSub.id}` : null);

    // Determine canonical plan from subscription name/status
    // Map legacy BASIC/PRO webhook names → GROWTH_PILOT
    let activePlan: PlanTierKey = 'FREE';
    if (status === 'ACTIVE') {
      if (
        subName.includes('GROWTH_PILOT') ||
        subName.includes('GROWTH PILOT') ||
        subName.includes('BASIC') ||
        subName.includes('PRO')
      ) {
        activePlan = 'GROWTH_PILOT';
      }
    } else {
      // CANCELLED, FROZEN, EXPIRED, DECLINED → revert to FREE
      activePlan = 'FREE';
    }

    // Resolve through canonical resolver as a safety net
    activePlan = resolveCanonicalPlan(activePlan);

    const currentPeriodEnd = appSub.current_period_end
      ? new Date(appSub.current_period_end).toISOString()
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // Update subscriptions table
    await upsertSubscriptionRecord(shopDomain, {
      active_plan: activePlan,
      shopify_subscription_id: subscriptionId,
      status,
      billing_cycle_end: currentPeriodEnd,
    });

    // Keep shops table plan_tier + subscription_status in sync
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = getServiceSupabase();
      const planTier = activePlan === 'GROWTH_PILOT' ? 'growth_pilot' : 'free';
      const subscriptionStatus =
        status === 'ACTIVE' && activePlan !== 'FREE'
          ? 'active'
          : status === 'PENDING'
          ? 'trial'
          : 'inactive';

      await supabase
        .from('shops')
        .update({
          plan_tier: planTier,
          subscription_status: subscriptionStatus,
          shopify_subscription_id: subscriptionId,
          billing_cycle_end: currentPeriodEnd,
          updated_at: new Date().toISOString(),
        })
        .eq('shop_domain', shopDomain);
    }

    console.log(
      `[Webhook] app_subscriptions_update: ${shopDomain} → ${activePlan} (${status})`
    );

    return NextResponse.json({ success: true, shopDomain, activePlan, status });
  } catch (error: any) {
    console.error('[Webhook] Error processing app_subscriptions_update:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
