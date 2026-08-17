import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase/client';
import { evaluateProductWithGemini, SchemaError } from '@/lib/gemini-evaluator';

const BATCH_SIZE = 5;
const MAX_RETRY_LIMIT = 3;

export async function POST(req: NextRequest) {
  return handleCronQueueProcessor(req);
}

export async function GET(req: NextRequest) {
  return handleCronQueueProcessor(req);
}

async function handleCronQueueProcessor(req: NextRequest) {
  try {
    // =========================================================================
    // 1. Security Check: Verify Vercel Cron or Authorization Secret
    // =========================================================================
    const cronSecret = process.env.CRON_SECRET;
    const isVercelCron = req.headers.get('x-vercel-cron-schedule') !== null;
    const authHeader = req.headers.get('authorization');
    const urlSecret = req.nextUrl.searchParams.get('secret');

    if (cronSecret && cronSecret !== 'development_cron_secret') {
      const isValidBearer = authHeader === `Bearer ${cronSecret}`;
      const isValidUrlSecret = urlSecret === cronSecret;

      if (!isVercelCron && !isValidBearer && !isValidUrlSecret) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized invocation. Invalid Cron Secret.' },
          { status: 401 }
        );
      }
    }

    // Demo Mode Handler
    const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true' || !process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (isDemo) {
      return NextResponse.json({
        success: true,
        message: 'Vercel Cron batch queue processing simulated in Demo Mode.',
        processed: 5,
        failed: 0,
      });
    }

    const supabase = getServiceSupabase();

    // Recover stale processing jobs (stuck in 'processing' for >5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    await supabase
      .from('audit_queue')
      .update({ status: 'queued' })
      .eq('status', 'processing')
      .lt('created_at', fiveMinutesAgo);

    // =========================================================================
    // 2. Fetch Small Concurrency Batch (5 rows) from `audit_queue`
    // =========================================================================
    const { data: queueItems, error: fetchError } = await supabase
      .from('audit_queue')
      .select('*, products(*)')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchError || !queueItems || queueItems.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No pending product audits in audit_queue.',
        processedCount: 0,
      });
    }

    // =========================================================================
    // 3. Immediately Lock Rows to 'processing'
    // =========================================================================
    const itemIds = queueItems.map((item) => item.id);
    await supabase
      .from('audit_queue')
      .update({ status: 'processing' })
      .in('id', itemIds);

    // =========================================================================
    // 4. Concurrently Process Batch using Promise.allSettled()
    // =========================================================================
    const results = await Promise.allSettled(
      queueItems.map(async (item) => {
        const queueId = item.id;
        const shopId = item.shop_id;
        const productId = item.product_id;
        const currentRetries = (item.retry_count || 0) + 1;
        const product = item.products;

        if (!product) {
          throw new Error('Product catalog row missing from products table.');
        }

        try {
          // Execute Gemini Evaluation Engine
          const evaluation = await evaluateProductWithGemini({
            title: product.title,
            handle: product.handle,
            body_html: product.body_html || '',
            vendor: product.vendor,
            product_type: product.product_type,
            current_json_ld: product.current_json_ld,
          });

          // Insert into `product_scores`
          await supabase.from('product_scores').insert({
            product_id: productId,
            geo_score: evaluation.scores.geo,
            aeo_score: evaluation.scores.aeo,
            aio_score: evaluation.scores.aio,
            overall_score: evaluation.scores.overall,
            scoring_breakdown: evaluation.breakdown,
            created_at: new Date().toISOString(),
          });

          // Insert into `recommendations` with status: 'pending'
          await supabase.from('recommendations').insert({
            product_id: productId,
            suggested_description: evaluation.recommendations.optimized_description,
            structured_faqs: evaluation.recommendations.structured_faqs,
            generated_json_ld: evaluation.recommendations.generated_json_ld,
            status: 'pending',
            created_at: new Date().toISOString(),
          });

          // Update `audit_queue` to 'completed'
          await supabase
            .from('audit_queue')
            .update({
              status: 'completed',
              error_message: null,
              processed_at: new Date().toISOString(),
            })
            .eq('id', queueId);

          // Track usage via increment_optimization_usage RPC
          try {
            await supabase.rpc('increment_optimization_usage', { target_shop_id: shopId });
          } catch (rpcErr) {
            // Fallback manual count increment if RPC function is not created
            const { data: shop } = await supabase.from('shops').select('optimizations_used_this_month').eq('id', shopId).single();
            if (shop) {
              await supabase.from('shops').update({
                optimizations_used_this_month: (shop.optimizations_used_this_month || 0) + 1,
                updated_at: new Date().toISOString(),
              }).eq('id', shopId);
            }
          }

          return { success: true, queueId, productId };
        } catch (itemErr: any) {
          const errorMessage = itemErr.message || 'Worker processing error.';
          const isDeadLetter = currentRetries >= MAX_RETRY_LIMIT;
          const isSchemaError = itemErr instanceof SchemaError;

          // If retry_count >= 3 or severe error, mark as permanently failed (Dead Letter Queue)
          const newStatus = isDeadLetter ? 'failed' : 'queued';
          const errorLog = isDeadLetter
            ? `DEAD_LETTER_QUEUE: Failed ${MAX_RETRY_LIMIT} consecutive attempts. ${errorMessage}`
            : `Attempt ${currentRetries}/${MAX_RETRY_LIMIT} failed: ${errorMessage}`;

          await supabase
            .from('audit_queue')
            .update({
              status: newStatus,
              retry_count: currentRetries,
              error_message: errorLog,
              processed_at: isDeadLetter ? new Date().toISOString() : null,
            })
            .eq('id', queueId);

          throw itemErr;
        }
      })
    );

    // Calculate metrics
    const fulfilled = results.filter((r) => r.status === 'fulfilled').length;
    const rejected = results.filter((r) => r.status === 'rejected').length;

    return NextResponse.json({
      success: true,
      batchSize: queueItems.length,
      processed: fulfilled,
      failed: rejected,
    });
  } catch (error: any) {
    console.error('Vercel Cron Process Queue Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
