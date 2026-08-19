import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase/client';
import { getSessionByShop, exchangeSessionTokenForOfflineAccessToken } from '@/lib/shopify/session';
import { checkShopQuota } from '@/lib/billing/plan-limits';
import { runDeterministicAudit } from '@/lib/scoring/deterministic';

/**
 * Shopify Admin API GraphQL Query for fetching catalog products, variants, and media.
 */
const PRODUCTS_GRAPHQL_QUERY = `
  query getProducts($first: Int!, $after: String) {
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
          images(first: 5) {
            edges {
              node {
                url
                altText
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
  console.log('[SyncCatalog] === Executing Shopify Catalog Import ===');
  try {
    const body = await req.json().catch(() => ({}));
    const { cursor = null, limit = 50 } = body;
    let shopDomain = body.shopDomain || body.shop_domain || body.shop;

    if (!shopDomain) {
      shopDomain = 'visibly-test-store.myshopify.com';
    }

    console.log('[SyncCatalog] Target Shop Domain:', shopDomain);

    // 1. Check Plan Quota (AI evaluations + product catalog cap)
    const quotaStatus = await checkShopQuota(shopDomain);
    console.log('[SyncCatalog] Plan Quota Status:', quotaStatus);

    // Block if the product catalog cap has been reached (Free tier: 10 products)
    if (!quotaStatus.hasProductQuota) {
      console.warn('[SyncCatalog] Product catalog cap reached for:', shopDomain);
      return NextResponse.json(
        {
          success: false,
          error: `Product catalog limit reached (${quotaStatus.syncedProducts}/${quotaStatus.productLimit} products) on your ${quotaStatus.planName} plan. Upgrade to Growth Pilot ($29/mo) to sync up to 500 products with weekly automated audits.`,
          upgradeUrl: `/pricing?shop=${encodeURIComponent(shopDomain)}`,
          quotaStatus,
        },
        { status: 429 }
      );
    }

    // Block if monthly AI evaluation quota is exhausted
    if (!quotaStatus.hasQuota) {
      console.warn('[SyncCatalog] AI evaluation quota exceeded for:', shopDomain);
      return NextResponse.json(
        {
          success: false,
          error: `Monthly AI evaluation limit reached (${quotaStatus.usedCount}/${quotaStatus.planLimit} used) on your ${quotaStatus.planName} plan. Upgrade to Growth Pilot ($29/mo) for 50 AI evaluations/month.`,
          upgradeUrl: `/pricing?shop=${encodeURIComponent(shopDomain)}`,
          quotaStatus,
        },
        { status: 429 }
      );
    }

    // 2. Resolve Access Token from Supabase session store or Token Exchange
    let authHeader = req.headers.get('authorization') || '';
    let sessionToken = authHeader.replace(/^Bearer\s+/i, '').trim() || body.sessionToken || body.idToken;
    let accessToken = body.accessToken || process.env.SHOPIFY_ACCESS_TOKEN || process.env.SHOPIFY_ADMIN_TOKEN;

    if (!accessToken && shopDomain && shopDomain !== 'demo-store.myshopify.com') {
      const session = await getSessionByShop(shopDomain);
      if (session?.accessToken) {
        accessToken = session.accessToken;
      } else if (sessionToken) {
        accessToken = await exchangeSessionTokenForOfflineAccessToken(shopDomain, sessionToken);
      }
    }

    console.log('[SyncCatalog] Token Resolution - AccessToken Present:', Boolean(accessToken));

    if (!accessToken && shopDomain !== 'demo-store.myshopify.com') {
      console.error('[SyncCatalog] Authentication Error: No access token found for store:', shopDomain);
      return NextResponse.json(
        {
          success: false,
          error: `Shopify Admin API access token not found for store "${shopDomain}". Please click "Authorize App" to connect your store.`,
          reauthUrl: `/api/auth?shop=${encodeURIComponent(shopDomain)}`,
        },
        { status: 401 }
      );
    }

    // 3. Resolve Shop UUID from Supabase `shops` table
    const supabase = getServiceSupabase();
    let shopId: string | null = null;

    const { data: existingShop, error: shopLookupErr } = await supabase
      .from('shops')
      .select('id')
      .eq('shop_domain', shopDomain)
      .single();

    if (shopLookupErr) {
      console.log('[SyncCatalog] Shop UUID lookup info:', shopLookupErr.message);
    }

    if (existingShop) {
      shopId = existingShop.id;
    } else {
      const { data: newShop, error: shopUpsertErr } = await supabase
        .from('shops')
        .upsert(
          {
            shop_domain: shopDomain,
            access_token: accessToken || '',
            is_installed: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'shop_domain' }
        )
        .select('id')
        .single();

      if (shopUpsertErr) {
        console.error('[SyncCatalog] Shops table upsert error:', shopUpsertErr.message, shopUpsertErr.details);
      }
      shopId = newShop?.id || null;
    }

    console.log('[SyncCatalog] Resolved Shop UUID:', shopId);

    // =========================================================================
    // 4. FETCH PRODUCTS VIA SHOPIFY ADMIN GRAPHQL API (2024-04) WITH TIMEOUT
    // =========================================================================
    const shopifyApiUrl = `https://${shopDomain}/admin/api/2024-04/graphql.json`;
    console.log('[SyncCatalog] Issuing GraphQL POST to:', shopifyApiUrl);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 seconds timeout

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (accessToken) {
      headers['X-Shopify-Access-Token'] = accessToken;
    } else if (sessionToken) {
      headers['Authorization'] = `Bearer ${sessionToken}`;
    }

    let gqlResponse: Response;
    try {
      gqlResponse = await fetch(shopifyApiUrl, {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          query: PRODUCTS_GRAPHQL_QUERY,
          variables: {
            first: Math.min(limit, 50),
            after: cursor || null,
          },
        }),
      });
    } catch (gqlFetchErr: any) {
      if (gqlFetchErr.name === 'AbortError') {
        console.error('[SyncCatalog] Shopify Admin API Request Timed Out (10s AbortController)');
        return NextResponse.json(
          {
            success: false,
            error: 'Shopify Admin API request timed out after 10 seconds. Please check network connection and try again.',
          },
          { status: 504 }
        );
      }
      console.error('[SyncCatalog] Shopify Admin API Network Fetch Error:', gqlFetchErr.message);
      return NextResponse.json(
        {
          success: false,
          error: `Network error connecting to Shopify Admin API: ${gqlFetchErr.message}`,
        },
        { status: 502 }
      );
    } finally {
      clearTimeout(timeoutId);
    }

    console.log('[SyncCatalog] Shopify Admin API HTTP Status Code:', gqlResponse.status);

    if (!gqlResponse.ok) {
      const rawErrorText = await gqlResponse.text();
      console.error('[SyncCatalog] Shopify Admin API Error Response Body:', rawErrorText);

      if (gqlResponse.status === 401) {
        return NextResponse.json(
          {
            success: false,
            error: `Shopify OAuth Authentication Failed (HTTP 401). Access token is invalid or revoked. Please re-authorize app permissions.`,
            reauthUrl: `/api/auth?shop=${encodeURIComponent(shopDomain)}`,
          },
          { status: 401 }
        );
      }

      if (gqlResponse.status === 429) {
        return NextResponse.json(
          {
            success: false,
            error: `Shopify GraphQL API Rate Limit Exceeded (HTTP 429). Please wait a few seconds before retrying.`,
          },
          { status: 429 }
        );
      }

      if (gqlResponse.status === 401 || gqlResponse.status === 403) {
        console.warn('[SyncCatalog] Stale/invalid access token detected. Clearing session from Supabase...');
        await supabase.from('shops').update({ access_token: null }).eq('shop_domain', shopDomain);
        await supabase.from('stores').delete().eq('shop_domain', shopDomain);
        return NextResponse.json(
          {
            success: false,
            error: 'Shopify authorization expired or invalid. Please authorize the app to generate a fresh token.',
            reauthUrl: `/api/auth?shop=${encodeURIComponent(shopDomain)}`,
          },
          { status: 401 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: `Shopify Admin API returned HTTP ${gqlResponse.status}: ${rawErrorText}`,
        },
        { status: gqlResponse.status }
      );
    }

    const gqlResult = await gqlResponse.json();

    if (gqlResult.errors && gqlResult.errors.length > 0) {
      console.error('[SyncCatalog] Shopify GraphQL User Errors:', gqlResult.errors);
      return NextResponse.json(
        {
          success: false,
          error: `Shopify GraphQL Error: ${gqlResult.errors.map((e: any) => e.message).join('; ')}`,
        },
        { status: 400 }
      );
    }

    const productsData = gqlResult.data?.products;
    const edges = productsData?.edges || [];
    const pageInfo = productsData?.pageInfo || { hasNextPage: false, endCursor: null };

    console.log(`[SyncCatalog] Successfully fetched ${edges.length} products from Shopify.`);

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

    // =========================================================================
    // 5. UPSERT PRODUCTS INTO SUPABASE
    // =========================================================================
    const productRows = edges.map((edge: any) => {
      const node = edge.node;
      const numericId = parseShopifyId(node.id);

      const featuredImageUrl = node.featuredImage?.url;
      const imagesFirstUrl = node.images?.edges?.[0]?.node?.url;
      const imageUrl = featuredImageUrl || imagesFirstUrl || null;

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

    console.log('[SyncCatalog] Upserting products to Supabase using unique constraint (shop_id, shopify_product_id)...');
    const { data: upsertedProducts, error: productsError } = await supabase
      .from('products')
      .upsert(productRows, {
        onConflict: 'shop_id,shopify_product_id',
      })
      .select('id, shopify_product_id');

    if (productsError) {
      console.error('[SyncCatalog] Supabase Products Upsert Error:', {
        message: productsError.message,
        details: productsError.details,
        code: productsError.code,
      });
      throw new Error(`Failed to upsert products to Supabase database: ${productsError.message} (${productsError.details || 'No details'})`);
    }

    console.log('[SyncCatalog] Upserted products count in Supabase:', upsertedProducts?.length || 0);

    // =========================================================================
    // 6. UPSERT INITIAL AUDITS & INSERT INTO AUDIT QUEUE
    // =========================================================================
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
        console.log(`[SyncCatalog] Queued ${queueRows.length} items for background AI evaluation.`);
      }
    }

    // Increment synced_products_count on shops table for quota tracking
    if (edges.length > 0 && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      await supabase
        .from('shops')
        .update({
          synced_products_count: Math.min(
            quotaStatus.productLimit,
            (quotaStatus.syncedProducts || 0) + edges.length
          ),
          updated_at: new Date().toISOString(),
        })
        .eq('shop_domain', shopDomain);
    }

    console.log('[SyncCatalog] === Catalog Sync Completed Successfully ===');
    return NextResponse.json({
      success: true,
      syncedCount: edges.length,
      hasNextPage: pageInfo.hasNextPage || false,
      endCursor: pageInfo.endCursor || null,
      shopId,
      quotaStatus,
    });
  } catch (error: any) {
    console.error('[SyncCatalog] Fatal Error during Catalog Sync:', {
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
