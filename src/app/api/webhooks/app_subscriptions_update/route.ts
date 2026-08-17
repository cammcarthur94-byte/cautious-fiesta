import { NextRequest, NextResponse } from 'next/server';
import { verifyShopifyWebhook } from '@/lib/shopify-security';
import { upsertSubscriptionRecord, PlanTierKey } from '@/lib/billing';

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

    const shopDomain = verification.shopDomain || payload.shop_domain || req.headers.get('x-shopify-shop-domain') || '';
    const status = (appSub.status || 'ACTIVE').toUpperCase();
    const name = (appSub.name || '').toUpperCase();
    const subscriptionId = appSub.admin_graphql_api_id || (appSub.id ? `gid://shopify/AppSubscription/${appSub.id}` : null);

    // Determine active plan from subscription name
    let activePlan: PlanTierKey = 'FREE';
    if (status === 'ACTIVE') {
      if (name.includes('PRO')) {
        activePlan = 'PRO';
      } else if (name.includes('BASIC')) {
        activePlan = 'BASIC';
      }
    } else {
      // If cancelled, frozen, or expired, revert to FREE
      activePlan = 'FREE';
    }

    const currentPeriodEnd = appSub.current_period_end
      ? new Date(appSub.current_period_end).toISOString()
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    await upsertSubscriptionRecord(shopDomain, {
      active_plan: activePlan,
      shopify_subscription_id: subscriptionId,
      status,
      billing_cycle_end: currentPeriodEnd,
    });

    console.log(`[Webhook] Updated subscription for ${shopDomain}: ${activePlan} (${status})`);

    return NextResponse.json({ success: true, shopDomain, activePlan, status });
  } catch (error: any) {
    console.error('[Webhook] Error processing app_subscriptions_update:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
