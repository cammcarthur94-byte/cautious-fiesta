import { NextRequest, NextResponse } from 'next/server';
import { createShopifyGraphQLClient } from '@/lib/shopify/client';
import { getServiceSupabase } from '@/lib/supabase/client';
import { getSessionByShop } from '@/lib/shopify/session';
import { checkShopQuota } from '@/lib/billing/plan-limits';
import { runDeterministicAudit } from '@/lib/scoring/deterministic';

/**
 * Enhanced GraphQL Query for fetching catalog products, variants, and media.
 */
const PRODUCTS_GRAPHQL_QUERY = `
  query SyncCatalogProducts($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      edges {
        cursor
        node {
          id
          title
          handle
          descriptionHtml
          status
          vendor
          productType
          featuredImage {
            url
            altText
          }
          variants(first: 5) {
            edges {
              node {
                id
                price
                sku
              }
            }
          }
          media(first: 5) {
            edges {
              node {
                ... on MediaImage {
                  image {
                    url
                    altText
                  }
                }
              }
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

/**
 * Helper to parse numerical product ID from Shopify Global ID (gid://shopify/Product/12345).
 */
function parseShopifyId(gid: string): number {
  if (!gid) return 0;
  const parts = gid.split('/');
  const rawId = parts[parts.length - 1];
  return parseInt(rawId, 10) || 0;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { cursor = null, limit = 50 } = body;
    let shopDomain = body.shopDomain || body.shop_domain || body.shop;

    if (!shopDomain) {
      shopDomain = 'demo-store.myshopify.com';
    }

    // Verify shop plan quota limit before syncing
    const quotaStatus = await checkShopQuota(shopDomain);
    if (!quotaStatus.hasQuota) {
      return NextResponse.json(
        {
          success: false,
          error: `Monthly AI audit quota reached (${quotaStatus.usedCount}/${quotaStatus.planLimit} audits used) for your active ${quotaStatus.planName.toUpperCase()} plan. Please upgrade your subscription to sync and audit more products.`,
          quotaStatus,
        },
        { status: 429 }
      );
    }

    // Retrieve offline access token from Supabase session store
    let accessToken = body.accessToken || process.env.SHOPIFY_ACCESS_TOKEN || process.env.SHOPIFY_ADMIN_TOKEN;
    if (!accessToken && shopDomain && shopDomain !== 'demo-store.myshopify.com') {
      const session = await getSessionByShop(shopDomain);
      if (session) {
        accessToken = session.accessToken;
      }
    }

    // If access token is invalid or missing, prompt for OAuth re-authentication
    if (!accessToken && shopDomain !== 'demo-store.myshopify.com') {
      return NextResponse.json(
        {
          success: false,
          error: `Shopify Admin API access token not found for store "${shopDomain}". Please authorize app permissions via Shopify OAuth.`,
          reauthUrl: `/api/auth?shop=${encodeURIComponent(shopDomain)}`,
        },
        { status: 401 }
      );
    }

    const supabase = getServiceSupabase();

    // 1. Resolve or create Shop record in Supabase `shops` table
    let shopId: string | null = null;
    const { data: existingShop } = await supabase
      .from('shops')
      .select('id')
      .eq('shop_domain', shopDomain)
      .single();

    if (existingShop) {
      shopId = existingShop.id;
    } else {
      const { data: newShop } = await supabase
        .from('shops')
        .upsert(
          {
            shop_domain: shopDomain,
            access_token: accessToken || 'demo_token',
            is_installed: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'shop_domain' }
        )
        .select('id')
        .single();

      shopId = newShop?.id || null;
    }

    // =========================================================================
    // REAL SHOPIFY ADMIN GRAPHQL SYNC FLOW
    // =========================================================================
    const client = await createShopifyGraphQLClient(shopDomain, accessToken || 'demo_token');
    const response: any = await client.request(PRODUCTS_GRAPHQL_QUERY, {
      variables: {
        first: Math.min(limit, 50),
        after: cursor || null,
      },
    });

    const productsData = response.data?.products;
    const edges = productsData?.edges || [];
    const pageInfo = productsData?.pageInfo || { hasNextPage: false, endCursor: null };

    if (edges.length === 0) {
      return NextResponse.json({
        success: true,
        syncedCount: 0,
        hasNextPage: false,
        endCursor: null,
        shopId,
        quotaStatus,
      });
    }

    // Transform GraphQL response into Supabase product records
    const productRows = edges.map((edge: any) => {
      const node = edge.node;
      const numericId = parseShopifyId(node.id);

      // Extract first media image URL if available
      const mediaImageUrl = node.media?.edges?.[0]?.node?.image?.url;
      const featuredImageUrl = node.featuredImage?.url;
      const imageUrl = mediaImageUrl || featuredImageUrl || null;

      return {
        shop_id: shopId,
        shop_domain: shopDomain,
        shopify_product_id: numericId,
        title: node.title,
        handle: node.handle,
        body_html: node.descriptionHtml || '',
        vendor: node.vendor || '',
        product_type: node.productType || '',
        status: (node.status || 'active').toLowerCase(),
        image_url: imageUrl,
        synced_at: new Date().toISOString(),
      };
    });

    // Upsert product records into Supabase `products` table
    const { data: upsertedProducts, error: productsError } = await supabase
      .from('products')
      .upsert(productRows, {
        onConflict: 'shop_id,shopify_product_id',
      })
      .select('id, shopify_product_id');

    if (productsError) {
      console.error('Supabase Product Upsert Error:', productsError);
      throw new Error(`Failed to upsert products to database: ${productsError.message}`);
    }

    // Upsert initial audits for immediate display
    const auditRows = productRows.map((p: any) => {
      const audit = runDeterministicAudit({
        id: String(p.shopify_product_id),
        title: p.title,
        handle: p.handle,
        body_html: p.body_html,
        vendor: p.vendor,
        product_type: p.product_type,
        status: p.status,
        image_url: p.image_url,
      });

      return {
        shop_domain: shopDomain,
        shopify_product_id: p.shopify_product_id,
        overall_score: audit.overallScore,
        geo_score: audit.geoBreakdown.score,
        aeo_score: audit.aeoBreakdown.score,
        aio_score: audit.aioBreakdown.score,
        issues: audit.issues,
        recommendations: audit.recommendations,
        audited_at: new Date().toISOString(),
      };
    });

    await supabase.from('product_audits').upsert(auditRows, { onConflict: 'shopify_product_id' });

    // Insert corresponding rows into `audit_queue` table with status = 'queued'
    if (upsertedProducts && upsertedProducts.length > 0) {
      const queueRows = upsertedProducts.map((p) => ({
        shop_id: shopId,
        product_id: p.id,
        status: 'queued',
        created_at: new Date().toISOString(),
      }));

      await supabase.from('audit_queue').upsert(queueRows, { onConflict: 'shop_id,product_id' });
    }

    return NextResponse.json({
      success: true,
      syncedCount: edges.length,
      hasNextPage: pageInfo.hasNextPage || false,
      endCursor: pageInfo.endCursor || null,
      shopId,
      quotaStatus,
    });
  } catch (error: any) {
    console.error('Catalog Sync Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'An unexpected error occurred during catalog synchronization.',
      },
      { status: 500 }
    );
  }
}
