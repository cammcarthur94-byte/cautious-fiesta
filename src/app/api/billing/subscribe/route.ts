import { NextRequest, NextResponse } from 'next/server';
import {
  createAppSubscriptionGraphQL,
  upsertSubscriptionRecord,
  PLAN_TIERS,
  PlanTierKey,
  resolveCanonicalPlan,
} from '@/lib/billing';
import { getSessionByShop } from '@/lib/shopify/session';

const VALID_PLAN_KEYS: PlanTierKey[] = ['FREE', 'GROWTH_PILOT'];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { searchParams } = new URL(req.url);

    const rawPlanName = (body.planName || searchParams.get('plan') || '').toUpperCase();
    const shopDomain = body.shopDomain || searchParams.get('shop') || 'demo-store.myshopify.com';

    // Resolve canonical plan (handles legacy BASIC/PRO → GROWTH_PILOT)
    const planName = resolveCanonicalPlan(rawPlanName) as PlanTierKey;

    if (!planName || !VALID_PLAN_KEYS.includes(planName)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid plan specified. Must be 'FREE' or 'GROWTH_PILOT'. Received: '${rawPlanName}'.`,
        },
        { status: 400 }
      );
    }

    // Downgrading to FREE
    if (planName === 'FREE') {
      await upsertSubscriptionRecord(shopDomain, {
        active_plan: 'FREE',
        shopify_subscription_id: null,
        status: 'ACTIVE',
      });

      return NextResponse.json({
        success: true,
        message: 'Successfully downgraded to Free Plan.',
        activePlan: 'FREE',
        redirectUrl: `/?shop=${encodeURIComponent(shopDomain)}&billing=downgraded`,
      });
    }

    // Check for demo mode or missing credentials
    const session = await getSessionByShop(shopDomain);
    const isDemo =
      process.env.NEXT_PUBLIC_DEMO_MODE === 'true' ||
      !session?.accessToken ||
      session.accessToken === 'demo_access_token';

    const appUrl =
      process.env.SHOPIFY_APP_URL ||
      `https://${req.headers.get('host') || 'localhost:3000'}`;

    const returnUrl = `${appUrl}/?shop=${encodeURIComponent(shopDomain)}&billing=success&plan=${planName}`;

    if (isDemo) {
      // In demo mode, simulate immediate plan upgrade without Shopify billing call
      await upsertSubscriptionRecord(shopDomain, {
        active_plan: planName,
        shopify_subscription_id: `demo_sub_${Date.now()}`,
        status: 'ACTIVE',
        billing_cycle_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      });

      return NextResponse.json({
        success: true,
        isDemo: true,
        confirmationUrl: returnUrl,
        plan: PLAN_TIERS[planName],
      });
    }

    // Real Shopify GraphQL App Subscription Creation
    const { confirmationUrl, appSubscriptionId } = await createAppSubscriptionGraphQL({
      shopDomain,
      accessToken: session!.accessToken,
      planKey: 'GROWTH_PILOT', // Only paid tier
      returnUrl,
    });

    // Mark as pending until Shopify webhook confirms activation
    await upsertSubscriptionRecord(shopDomain, {
      shopify_subscription_id: appSubscriptionId,
      status: 'PENDING',
    });

    return NextResponse.json({
      success: true,
      confirmationUrl,
      appSubscriptionId,
      plan: PLAN_TIERS[planName],
    });
  } catch (error: any) {
    console.error('[BillingSubscribe] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  // Support GET redirect for direct link clicking (e.g. from email CTAs)
  const { searchParams } = new URL(req.url);
  const rawPlan = (searchParams.get('plan') || 'GROWTH_PILOT').toUpperCase();
  const plan = resolveCanonicalPlan(rawPlan) as PlanTierKey;
  const shop = searchParams.get('shop') || 'demo-store.myshopify.com';

  const host = req.headers.get('host') || 'localhost:3000';
  const protocol = host.includes('localhost') ? 'http' : 'https';

  const postRes = await fetch(`${protocol}://${host}/api/billing/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ planName: plan, shopDomain: shop }),
  });

  const data = await postRes.json();
  if (data.confirmationUrl) {
    return NextResponse.redirect(data.confirmationUrl);
  }

  return NextResponse.redirect(
    `${protocol}://${host}/pricing?error=${encodeURIComponent(data.error || 'Failed to initialize subscription')}&shop=${encodeURIComponent(shop)}`
  );
}
