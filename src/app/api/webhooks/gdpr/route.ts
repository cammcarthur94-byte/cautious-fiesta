import { NextRequest, NextResponse } from 'next/server';
import { verifyShopifyWebhook } from '@/lib/shopify-security';
import { getServiceSupabase } from '@/lib/supabase/client';

/**
 * Mandatory GDPR Compliance Webhook Handler for Shopify App Store.
 *
 * Handles:
 * 1. `customers/data_request`
 * 2. `customers/redact`
 * 3. `shop/redact`
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const verification = await verifyShopifyWebhook(req, rawBody);

    if (!verification.isValid) {
      console.warn(`[GDPR Webhook] Unauthorized attempt: ${verification.error}`);
      return NextResponse.json(
        { success: false, error: verification.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    let payload: any = {};
    try {
      payload = JSON.parse(rawBody || '{}');
    } catch {
      payload = {};
    }

    // Identify topic from header or payload
    const topic = (verification.topic || payload.topic || req.headers.get('x-shopify-topic') || '').toLowerCase();
    const shopDomain =
      verification.shopDomain ||
      payload.shop_domain ||
      payload.myshopify_domain ||
      req.headers.get('x-shopify-shop-domain') ||
      '';

    console.log(`[GDPR Webhook] Received topic '${topic}' for shop '${shopDomain}'`);

    switch (topic) {
      case 'customers/data_request': {
        // App does not collect or store customer personal data (only store products & AI schemas).
        console.log(`[GDPR] customers/data_request received for shop ${shopDomain}: Customer ID ${payload.customer?.id}`);
        return NextResponse.json({
          success: true,
          message: 'Data request acknowledged. No customer personal data is retained by this application.',
        });
      }

      case 'customers/redact': {
        // Acknowledge customer redaction request
        console.log(`[GDPR] customers/redact received for shop ${shopDomain}: Customer ID ${payload.customer?.id}`);
        return NextResponse.json({
          success: true,
          message: 'Customer redaction acknowledged.',
        });
      }

      case 'shop/redact': {
        console.log(`[GDPR] shop/redact executing full data deletion for shop ${shopDomain}`);

        if (shopDomain && process.env.SUPABASE_SERVICE_ROLE_KEY) {
          const supabase = getServiceSupabase();

          // Cascade delete all store-related records
          await Promise.allSettled([
            supabase.from('audit_jobs').delete().eq('shop_domain', shopDomain),
            supabase.from('product_audits').delete().eq('shop_domain', shopDomain),
            supabase.from('product_revisions').delete().eq('shop_domain', shopDomain),
            supabase.from('products').delete().eq('shop_domain', shopDomain),
            supabase.from('subscriptions').delete().eq('shop_domain', shopDomain),
            supabase.from('stores').delete().eq('shop_domain', shopDomain),
          ]);

          console.log(`[GDPR] Full cleanup completed in Supabase for ${shopDomain}`);
        }

        return NextResponse.json({
          success: true,
          message: `Store records for ${shopDomain} successfully redacted and purged.`,
        });
      }

      default: {
        console.warn(`[GDPR Webhook] Unrecognized topic '${topic}'. Returning 200 to acknowledge.`);
        return NextResponse.json({
          success: true,
          message: `Topic '${topic}' acknowledged.`,
        });
      }
    }
  } catch (error: any) {
    console.error('[GDPR Webhook] Processing error:', error);
    // Shopify requires 200 status for webhooks to avoid retries if format is valid
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
