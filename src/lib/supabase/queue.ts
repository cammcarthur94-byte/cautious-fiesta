import { getServiceSupabase } from './client';
import { AuditJob } from '../scoring/types';

export async function createAuditJob(shopDomain: string, productCount: number): Promise<AuditJob> {
  const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true' || !process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (isDemo) {
    return {
      id: 'demo-job-' + Date.now(),
      shopDomain,
      status: 'processing',
      totalProducts: productCount,
      processedProducts: 0,
      failedProducts: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from('audit_jobs')
    .insert({
      shop_domain: shopDomain,
      status: 'queued',
      total_products: productCount,
      processed_products: 0,
      failed_products: 0
    })
    .select('*')
    .single();

  if (error) throw error;
  return {
    id: data.id,
    shopDomain: data.shop_domain,
    status: data.status,
    totalProducts: data.total_products,
    processedProducts: data.processed_products,
    failedProducts: data.failed_products,
    errorMessage: data.error_message,
    createdAt: data.created_at,
    updatedAt: data.updated_at
  };
}

export async function updateAuditJobProgress(
  jobId: string,
  processedIncrement: number,
  failedIncrement: number = 0,
  status?: 'processing' | 'completed' | 'failed'
): Promise<void> {
  const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true' || !process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (isDemo) return;

  const supabase = getServiceSupabase();
  const { data: job } = await supabase.from('audit_jobs').select('*').eq('id', jobId).single();
  if (!job) return;

  const updatedProcessed = job.processed_products + processedIncrement;
  const updatedFailed = job.failed_products + failedIncrement;
  const isComplete = updatedProcessed + updatedFailed >= job.total_products;

  await supabase
    .from('audit_jobs')
    .update({
      processed_products: updatedProcessed,
      failed_products: updatedFailed,
      status: status || (isComplete ? 'completed' : 'processing'),
      updated_at: new Date().toISOString()
    })
    .eq('id', jobId);
}

/**
 * Get the current status of an audit job for real-time progress polling.
 */
export async function getAuditJobStatus(jobId: string): Promise<AuditJob | null> {
  const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true' || !process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (isDemo) {
    return {
      id: jobId,
      shopDomain: 'demo-store.myshopify.com',
      status: 'completed',
      totalProducts: 6,
      processedProducts: 6,
      failedProducts: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from('audit_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    shopDomain: data.shop_domain,
    status: data.status,
    totalProducts: data.total_products,
    processedProducts: data.processed_products,
    failedProducts: data.failed_products,
    errorMessage: data.error_message,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Get the latest audit job for a shop (for dashboard status display).
 */
export async function getLatestAuditJob(shopDomain: string): Promise<AuditJob | null> {
  const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true' || !process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (isDemo) return null;

  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from('audit_jobs')
    .select('*')
    .eq('shop_domain', shopDomain)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    shopDomain: data.shop_domain,
    status: data.status,
    totalProducts: data.total_products,
    processedProducts: data.processed_products,
    failedProducts: data.failed_products,
    errorMessage: data.error_message,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Clean up stale jobs that have been stuck in 'processing' for too long.
 */
export async function cleanupStaleJobs(staleMinutes: number = 10): Promise<number> {
  const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true' || !process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (isDemo) return 0;

  const supabase = getServiceSupabase();
  const staleThreshold = new Date(Date.now() - staleMinutes * 60 * 1000).toISOString();

  const { data } = await supabase
    .from('audit_jobs')
    .update({ status: 'failed', error_message: 'Job timed out', updated_at: new Date().toISOString() })
    .eq('status', 'processing')
    .lt('updated_at', staleThreshold)
    .select('id');

  return data?.length || 0;
}
