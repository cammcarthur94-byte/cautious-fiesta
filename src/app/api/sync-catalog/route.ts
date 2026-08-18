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
  console.log('[SyncCatalog] === Starting Catalog Synchronization ===');
  try {
    const body = await req.json().catch(() => ({}));
    const { cursor = null, limit = 50 } = body;
    let shopDomain = body.shopDomain || body.shop_domain || body.shop;

    if (!shopDomain) {
      shopDomain = 'demo-store.myshopify.com';
    }

    console.log('[SyncCatalog] Step 1: Resolving shop domain & plan quota for:', shopDomain);

    // Verify shop plan quota limit before syncing
    const quotaStatus = await checkShopQuota(shopDomain);
    console.log('[SyncCatalog] Quota status check:', {
      hasQuota: quotaStatus.hasQuota,
      usedCount: quotaStatus.usedCount,
      planLimit: quotaStatus.planLimit,
      planName: quotaStatus.planName,
    });

    if (!quotaStatus.hasQuota) {
      console.warn('[SyncCatalog] Quota exceeded for shop:', shopDomain);
      return NextResponse.json(
        {
          success: false,
          error: `Monthly AI audit quota reached (${quotaStatus.usedCount}/${quotaStatus.planLimit} audits used) for your active ${quotaStatus.planName.toUpperCase()} plan. Please upgrade your subscription to sync more products.`,
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

    console.log('[SyncCatalog] Step 2: Access Token Status:', {
      hasAccessToken: Boolean(accessToken),
      tokenPrefix: accessToken ? `${accessToken.substring(0, 6)}...` : 'NONE',
    });

    // If access token is invalid or missing, prompt for OAuth re-authentication
    if (!accessToken && shopDomain !== 'demo-store.myshopify.com') {
      console.error('[SyncCatalog] Error: Missing access token for domain:', shopDomain);
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
    console.log('[SyncCatalog] Step 3: Resolving shop UUID in Supabase shops table...');
    let shopId: string | null = null;
    const { data: existingShop, error: shopLookupErr } = await supabase
      .from('shops')
      .select('id')
      .eq('shop_domain', shopDomain)
      .single();

    if (shopLookupErr) {
      console.log('[SyncCatalog] Existing shop lookup notice:', shopLookupErr.message);
    }

    if (existingShop) {
      shopId = existingShop.id;
    } else {
      const { data: newShop, error: shopUpsertErr } = await supabase
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

      if (shopUpsertErr) {
        console.error('[SyncCatalog] Supabase Shops Upsert Error:', shopUpsertErr.message, shopUpsertErr.details);
      }
      shopId = newShop?.id || null;
    }

    console.log('[SyncCatalog] Resolved Supabase shop_id UUID:', shopId);

    // =========================================================================
    // 2. QUERY SHOPIFY ADMIN GRAPHQL API
    // =========================================================================
    console.log('[SyncCatalog] Step 4: Executing Shopify GraphQL PRODUCTS_GRAPHQL_QUERY...');
    const client = await createShopifyGraphQLClient(shopDomain, accessToken || 'demo_token');
    
    let response: any;
    try {
      response = await client.request(PRODUCTS_GRAPHQL_QUERY, {
        variables: {
          first: Math.min(limit, 50),
          after: cursor || null,
        },
      });
    } catch (gqlErr: any) {
      console.error('[SyncCatalog] Shopify GraphQL Request Failed:', {
        message: gqlErr.message,
        response: gqlErr.response,
      });
      return NextResponse.json(
        {
          success: false,
          error: `Shopify Admin API GraphQL Request Failed: ${gqlErr.message}`,
        },
        { status: 502 }
      );
    }

    const productsData = response.data?.products;
    const edges = productsData?.edges || [];
    const pageInfo = productsData?.pageInfo || { hasNextPage: false, endCursor: null };

    console.log('[SyncCatalog] Shopify GraphQL Response Summary:', {
      fetchedEdgesCount: edges.length,
      hasNextPage: pageInfo.hasNextPage,
      endCursor: pageInfo.endCursor,
    });

    if (edges.length === 0) {
      console.log('[SyncCatalog] No products returned from Shopify GraphQL for shop:', shopDomain);
      return NextResponse.json({
        success: true,
        syncedCount: 0,
        hasNextPage: false,
        endCursor: null,
        shopId,
        quotaStatus,
      });
    }

    // =========================================================================
    // 3. TRANSFORM & UPSERT INTO SUPABASE `products` TABLE
    // =========================================================================
    console.log('[SyncCatalog] Step 5: Transforming products and upserting into Supabase...');
    const productRows = edges.map((edge: any) => {
      const node = edge.node;
      const numericId = parseShopifyId(node.id);

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

    // Upsert product records into Supabase `products` table using unique constraint (shop_id, shopify_product_id)
    const { data: upsertedProducts, error: productsError } = await supabase
      .from('products')
      .upsert(productRows, {
        onConflict: 'shop_id,shopify_product_id',
      })
      .select('id, shopify_product_id');

    if (productsError) {
      console.error('[SyncCatalog] Supabase Product Upsert Failure:', {
        message: productsError.message,
        details: productsError.details,
        code: productsError.code,
      });
      throw new Error(`Failed to upsert products to database: ${productsError.message} (${productsError.details || 'No details'})`);
    }

    console.log('[SyncCatalog] Successfully upserted product rows count:', upsertedProducts?.length || 0);

    // =========================================================================
    // 4. UPSERT INITIAL AUDITS & INSERT INTO `audit_queue`
    // =========================================================================
    console.log('[SyncCatalog] Step 6: Generating initial deterministic audits & updating audit_queue...');
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

    const { error: auditErr } = await supabase.from('product_audits').upsert(auditRows, { onConflict: 'shopify_product_id' });
    if (auditErr) {
      console.warn('[SyncCatalog] Product Audits Upsert Notice:', auditErr.message);
    }

    // Insert corresponding rows into `audit_queue` table with status = 'queued'
    if (upsertedProducts && upsertedProducts.length > 0 && shopId) {
      const queueRows = upsertedProducts.map((p) => ({
        shop_id: shopId,
        product_id: p.id,
        status: 'queued',
        created_at: new Date().toISOString(),
      }));

      const { error: queueError } = await supabase.from('audit_queue').upsert(queueRows, { onConflict: 'shop_id,product_id' });
      if (queueError) {
        console.warn('[SyncCatalog] Audit Queue Upsert Notice:', queueError.message, queueError.details);
      } else {
        console.log('[SyncCatalog] Queued background items count:', queueRows.length);
      }
    }

    console.log('[SyncCatalog] === Catalog Synchronization Completed Successfully ===');
    return NextResponse.json({
      success: true,
      syncedCount: edges.length,
      hasNextPage: pageInfo.hasNextPage || false,
      endCursor: pageInfo.endCursor || null,
      shopId,
      quotaStatus,
    });
  } catch (error: any) {
    console.error('[SyncCatalog] FATAL Sync Error:', {
      message: error.message,
      stack: error.stack,
    });
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'An unexpected error occurred during catalog synchronization.',
      },
      { status: 500 }
    );
  }
}
