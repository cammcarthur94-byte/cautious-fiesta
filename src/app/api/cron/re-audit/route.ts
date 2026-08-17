import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase/client';
import { cleanupStaleJobs } from '@/lib/supabase/queue';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized cron request' }, { status: 401 });
    }

    const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true' || !process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (isDemo) {
      return NextResponse.json({
        success: true,
        message: 'Cron job simulated in demo mode: Catalog scan queued',
        timestamp: new Date().toISOString(),
      });
    }

    const supabase = getServiceSupabase();

    // Clean up any stale processing jobs first
    const staleCount = await cleanupStaleJobs(10);
    if (staleCount > 0) {
      console.log(`Cleaned up ${staleCount} stale audit jobs`);
    }

    // Fetch all active store domains
    const { data: stores } = await supabase.from('stores').select('shop_domain');
    let enqueuedCount = 0;

    for (const store of stores || []) {
      const { count } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('shop_domain', store.shop_domain);

      if (count && count > 0) {
        await supabase.from('audit_jobs').insert({
          shop_domain: store.shop_domain,
          status: 'queued',
          total_products: count,
          processed_products: 0,
          failed_products: 0,
        });
        enqueuedCount++;
      }
    }

    // Trigger queue processing immediately after enqueueing
    if (enqueuedCount > 0) {
      const appUrl = process.env.SHOPIFY_APP_URL || `https://${req.headers.get('host')}`;
      try {
        await fetch(`${appUrl}/api/queue/process`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (e) {
        console.error('Failed to trigger queue processing after cron enqueue:', e);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Enqueued re-audits for ${enqueuedCount} stores (${staleCount} stale jobs cleaned)`,
      enqueuedCount,
      staleJobsCleaned: staleCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
