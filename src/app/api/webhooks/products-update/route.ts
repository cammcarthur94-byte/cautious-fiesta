import { NextRequest, NextResponse } from 'next/server';
import { runDeterministicAudit } from '@/lib/scoring/deterministic';
import { getServiceSupabase } from '@/lib/supabase/client';
import { verifyWebhookHmac } from '@/lib/shopify/verify';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const hmacHeader = req.headers.get('x-shopify-hmac-sha256') || '';
    const shopDomain = req.headers.get('x-shopify-shop-domain') || 'unknown.myshopify.com';

    // Verify webhook signature (skip in demo mode)
    const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
    if (!isDemo && process.env.SHOPIFY_API_SECRET) {
      if (!verifyWebhookHmac(rawBody, hmacHeader)) {
        console.error(`Webhook HMAC verification failed for shop: ${shopDomain}`);
        return NextResponse.json(
          { success: false, error: 'Webhook verification failed' },
          { status: 401 }
        );
      }
    }

    const product = JSON.parse(rawBody);

    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = getServiceSupabase();

      // Upsert product
      await supabase.from('products').upsert({
        shop_domain: shopDomain,
        shopify_product_id: String(product.id),
        title: product.title,
        handle: product.handle,
        body_html: product.body_html,
        vendor: product.vendor,
        product_type: product.product_type,
        status: product.status,
        image_url: product.image?.src,
        last_synced_at: new Date().toISOString(),
      });

      // Compute and update audit
      const audit = runDeterministicAudit({
        id: String(product.id),
        title: product.title,
        handle: product.handle,
        body_html: product.body_html || '',
        vendor: product.vendor || '',
        product_type: product.product_type || '',
        status: product.status || 'active',
      });

      await supabase.from('product_audits').upsert({
        shop_domain: shopDomain,
        shopify_product_id: String(product.id),
        overall_score: audit.overallScore,
        geo_score: audit.geoBreakdown.score,
        aeo_score: audit.aeoBreakdown.score,
        aio_score: audit.aioBreakdown.score,
        issues: audit.issues,
        recommendations: audit.recommendations,
        audited_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({ success: true, received: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
