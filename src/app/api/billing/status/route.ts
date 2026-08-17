import { NextRequest, NextResponse } from 'next/server';
import { checkUsageLimit, PLAN_TIERS, getSubscription } from '@/lib/billing';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const shopDomain = searchParams.get('shop') || 'demo-store.myshopify.com';

    const usage = await checkUsageLimit(shopDomain);
    const subscription = await getSubscription(shopDomain);

    return NextResponse.json({
      success: true,
      shopDomain,
      subscription,
      usage,
      tiers: PLAN_TIERS,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
