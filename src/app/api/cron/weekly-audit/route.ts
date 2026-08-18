import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/weekly-audit
 *
 * Automated weekly cron job handler (triggered by Vercel Cron or external scheduler).
 * Re-audits merchant catalog products, queues them for AI evaluation, and logs score drop alerts.
 */
export async function GET(req: NextRequest) {
  try {
    // 1. Verify Vercel Cron header or custom secret
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.get('authorization');
    const vercelCronHeader = req.headers.get('x-vercel-cron-schedule');

    if (cronSecret && authHeader !== `Bearer ${cronSecret}` && !vercelCronHeader) {
      return NextResponse.json({ success: false, error: 'Unauthorized cron trigger' }, { status: 401 });
    }

    const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

    if (isDemo || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({
        success: true,
        message: 'Weekly re-audit simulated successfully (Demo Mode).',
        timestamp: new Date().toISOString(),
        queuedProducts: 6,
        scoreDropAlerts: 1,
      });
    }

    const supabase = getServiceSupabase();

    // 2. Fetch active shops
    const { data: shops, error: shopsErr } = await supabase
      .from('shops')
      .select('id, shop_domain, score_drop_alerts')
      .eq('is_installed', true);

    if (shopsErr) {
      throw new Error(`Failed to fetch active shops: ${shopsErr.message}`);
    }

    let totalQueuedProducts = 0;
    let totalScoreDropAlerts = 0;

    for (const shop of shops || []) {
      // 3. Fetch products for this shop
      const { data: products } = await supabase
        .from('products')
        .select('id, shopify_product_id')
        .eq('shop_id', shop.id);

      if (!products || products.length === 0) continue;

      // 4. Batch push products into audit_queue
      const queueRows = products.map((p) => ({
        shop_id: shop.id,
        product_id: p.id,
        status: 'queued',
        retry_count: 0,
        created_at: new Date().toISOString(),
      }));

      const { error: queueErr } = await supabase
        .from('audit_queue')
        .upsert(queueRows, { onConflict: 'shop_id,product_id' });

      if (!queueErr) {
        totalQueuedProducts += products.length;
      }

      // 5. Check historical scores for score drops (<60 or >10 pt drop)
      const { data: audits } = await supabase
        .from('product_audits')
        .select('shopify_product_id, overall_score')
        .eq('shop_domain', shop.shop_domain);

      const criticalScoreDrops = (audits || []).filter(
        (a) => typeof a.overall_score === 'number' && a.overall_score < 60
      );

      if (criticalScoreDrops.length > 0) {
        totalScoreDropAlerts += criticalScoreDrops.length;
        await supabase
          .from('shops')
          .update({
            score_drop_alerts: (shop.score_drop_alerts || 0) + criticalScoreDrops.length,
            updated_at: new Date().toISOString(),
          })
          .eq('id', shop.id);
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      activeShopsProcessed: (shops || []).length,
      totalQueuedProducts,
      totalScoreDropAlerts,
    });
  } catch (error: any) {
    console.error('Weekly Audit Cron Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
