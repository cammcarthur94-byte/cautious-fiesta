import { NextRequest, NextResponse } from 'next/server';
import { verifyShopifyWebhook } from '@/lib/shopify-security';
import { deleteSession } from '@/lib/shopify/session';
import { getServiceSupabase } from '@/lib/supabase/client';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const verification = await verifyShopifyWebhook(req, rawBody);

    if (!verification.isValid) {
      console.warn(`[app_uninstalled] HMAC verification failed: ${verification.error}`);
      return NextResponse.json(
        { success: false, error: verification.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const shopDomain = verification.shopDomain;
    console.log(`[app_uninstalled] Handling uninstall for shop: ${shopDomain}`);

    // 1. Delete or remove store session
    if (shopDomain) {
      await deleteSession(shopDomain);
    }

    // 2. Clean up or cancel active subscription tracking in Supabase
    if (shopDomain && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = getServiceSupabase();

      // Cancel subscription tracking
      await supabase
        .from('subscriptions')
        .update({
          status: 'CANCELLED',
          shopify_subscription_id: null,
          active_plan: 'FREE',
          updated_at: new Date().toISOString(),
        })
        .eq('shop_domain', shopDomain);

      // Clean up queued / running background jobs
      await supabase.from('audit_jobs').delete().eq('shop_domain', shopDomain);

      console.log(`[app_uninstalled] Successfully updated subscriptions and cleared audit jobs for ${shopDomain}`);
    }

    return NextResponse.json({ success: true, shopDomain, uninstalled: true });
  } catch (error: any) {
    console.error('[app_uninstalled] Processing error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
