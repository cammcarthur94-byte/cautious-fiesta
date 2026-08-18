import { NextRequest, NextResponse } from 'next/server';
import { getMockProductsWithAudits } from '@/lib/mock/sample-catalog';
import { getServiceSupabase } from '@/lib/supabase/client';
import { runDeterministicAudit } from '@/lib/scoring/deterministic';
import { ShopifyProductItem } from '@/lib/scoring/types';
import { checkShopQuota } from '@/lib/billing/plan-limits';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('q')?.toLowerCase() || '';
    const pillarFilter = searchParams.get('pillar') || 'all';
    const scoreRange = searchParams.get('scoreRange') || 'all';
    const category = searchParams.get('category') || 'all';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const shopDomain = searchParams.get('shop') || 'demo-store.myshopify.com';

    const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true' || !process.env.SUPABASE_SERVICE_ROLE_KEY;

    let products: ShopifyProductItem[];

    if (isDemo) {
      // Demo mode: use mock catalog
      products = getMockProductsWithAudits();
    } else {
      // Live mode: fetch from Supabase with joined audit scores
      products = await fetchLiveProducts(shopDomain, page, limit);
    }

    // Apply client-side filters
    if (search) {
      products = products.filter(
        p => p.title.toLowerCase().includes(search) || p.vendor.toLowerCase().includes(search)
      );
    }

    if (category !== 'all') {
      products = products.filter(p => p.product_type.toLowerCase() === category.toLowerCase());
    }

    if (scoreRange === 'critical') {
      products = products.filter(p => (p.audit?.overallScore || 0) < 50);
    } else if (scoreRange === 'warning') {
      products = products.filter(p => (p.audit?.overallScore || 0) >= 50 && (p.audit?.overallScore || 0) < 80);
    } else if (scoreRange === 'healthy') {
      products = products.filter(p => (p.audit?.overallScore || 0) >= 80);
    }

    if (pillarFilter === 'geo_fail') {
      products = products.filter(p => (p.audit?.geoBreakdown.score || 0) < 60);
    } else if (pillarFilter === 'aeo_fail') {
      products = products.filter(p => (p.audit?.aeoBreakdown.score || 0) < 60);
    } else if (pillarFilter === 'aio_fail') {
      products = products.filter(p => (p.audit?.aioBreakdown.score || 0) < 60);
    }

    const quotaStatus = await checkShopQuota(shopDomain);

    return NextResponse.json({
      success: true,
      count: products.length,
      page,
      products,
      optimizationsUsed: quotaStatus.usedCount,
      planLimit: quotaStatus.planLimit,
      planName: quotaStatus.planName,
      hasQuota: quotaStatus.hasQuota,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

/**
 * Fetch products from Supabase with their latest audit scores.
 */
async function fetchLiveProducts(
  shopDomain: string,
  page: number,
  limit: number
): Promise<ShopifyProductItem[]> {
  const supabase = getServiceSupabase();
  const offset = (page - 1) * limit;

  // Fetch products
  let query = supabase
    .from('products')
    .select('*')
    .order('synced_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (shopDomain) {
    query = query.eq('shop_domain', shopDomain);
  }

  const { data: products, error } = await query;
  if (error || !products) return [];

  // Fetch latest audits for these products
  const productIds = products.map((p: any) => p.shopify_product_id);
  const { data: audits } = await supabase
    .from('product_audits')
    .select('*')
    .in('shopify_product_id', productIds)
    .order('audited_at', { ascending: false });

  // Create a map of latest audit per product
  const auditMap = new Map<string, any>();
  for (const audit of audits || []) {
    if (!auditMap.has(audit.shopify_product_id)) {
      auditMap.set(audit.shopify_product_id, audit);
    }
  }

  // Map to ShopifyProductItem with audit data
  return products.map((p: any) => {
    const product: ShopifyProductItem = {
      id: p.shopify_product_id,
      title: p.title,
      handle: p.handle,
      body_html: p.body_html || '',
      vendor: p.vendor || '',
      product_type: p.product_type || '',
      status: p.status || 'active',
      image_url: p.image_url,
    };

    // If we have a stored audit, use it; otherwise compute fresh
    const storedAudit = auditMap.get(p.shopify_product_id);
    if (storedAudit) {
      product.audit = {
        productId: p.shopify_product_id,
        overallScore: storedAudit.overall_score,
        geoBreakdown: { score: storedAudit.geo_score, weight: 0.40, subScores: {} },
        aeoBreakdown: { score: storedAudit.aeo_score, weight: 0.35, subScores: {} },
        aioBreakdown: { score: storedAudit.aio_score, weight: 0.25, subScores: {} },
        issues: storedAudit.issues || [],
        recommendations: storedAudit.recommendations || {},
        auditedAt: storedAudit.audited_at,
      };
    } else {
      product.audit = runDeterministicAudit(product);
    }

    return product;
  });
}
