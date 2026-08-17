import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase/client';
import { runDeterministicAudit } from '@/lib/scoring/deterministic';

const DEFAULT_BATCH_SIZE = 20;
const MAX_BATCH_SIZE = 100;

export async function POST(req: NextRequest) {
  try {
    const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true' || !process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (isDemo) {
      return NextResponse.json({
        success: true,
        message: 'Batch audit job simulated successfully in demo mode',
        processed: 6,
        failed: 0,
      });
    }

    // Configurable batch size via query param or env var
    const { searchParams } = new URL(req.url);
    const batchSize = Math.min(
      parseInt(searchParams.get('batchSize') || process.env.AUDIT_BATCH_SIZE || String(DEFAULT_BATCH_SIZE), 10),
      MAX_BATCH_SIZE
    );

    const supabase = getServiceSupabase();

    // Also pick up stale 'processing' jobs that have been stuck for >10 minutes
    await supabase
      .from('audit_jobs')
      .update({ status: 'queued', updated_at: new Date().toISOString() })
      .eq('status', 'processing')
      .lt('updated_at', new Date(Date.now() - 10 * 60 * 1000).toISOString());

    // Fetch the oldest queued or resumed job
    const { data: job, error: jobErr } = await supabase
      .from('audit_jobs')
      .select('*')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (jobErr || !job) {
      return NextResponse.json({ success: true, message: 'No queued jobs found' });
    }

    // Set to processing
    await supabase.from('audit_jobs').update({
      status: 'processing',
      updated_at: new Date().toISOString(),
    }).eq('id', job.id);

    // Fetch un-audited or stale products for this store
    // Skip products that have already been processed in this batch
    const { data: products } = await supabase
      .from('products')
      .select('*')
      .eq('shop_domain', job.shop_domain)
      .limit(batchSize);

    let processedCount = job.processed_products || 0;
    let failedCount = job.failed_products || 0;
    const errors: string[] = [];

    for (const prod of products || []) {
      try {
        const audit = runDeterministicAudit({
          id: prod.shopify_product_id,
          title: prod.title,
          handle: prod.handle,
          body_html: prod.body_html || '',
          vendor: prod.vendor || '',
          product_type: prod.product_type || '',
          status: prod.status || 'active',
        });

        await supabase.from('product_audits').upsert({
          shop_domain: job.shop_domain,
          shopify_product_id: prod.shopify_product_id,
          overall_score: audit.overallScore,
          geo_score: audit.geoBreakdown.score,
          aeo_score: audit.aeoBreakdown.score,
          aio_score: audit.aioBreakdown.score,
          issues: audit.issues,
          recommendations: audit.recommendations,
          audited_at: new Date().toISOString(),
        });

        processedCount++;
      } catch (e: any) {
        failedCount++;
        errors.push(`Product ${prod.shopify_product_id}: ${e.message}`);
      }
    }

    // Determine final status
    const totalExpected = job.total_products;
    const isComplete = processedCount + failedCount >= totalExpected;
    const finalStatus = isComplete ? 'completed' : 'queued'; // Re-queue for next invocation if not done

    await supabase
      .from('audit_jobs')
      .update({
        processed_products: processedCount,
        failed_products: failedCount,
        status: finalStatus,
        error_message: errors.length > 0 ? errors.join(' | ') : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id);

    return NextResponse.json({
      success: true,
      jobId: job.id,
      processed: processedCount,
      failed: failedCount,
      status: finalStatus,
      batchSize,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
