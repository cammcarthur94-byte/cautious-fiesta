import { NextRequest, NextResponse } from 'next/server';
import { createShopifyGraphQLClient } from '@/lib/shopify/client';
import { getServiceSupabase } from '@/lib/supabase/client';
import { getSessionByShop } from '@/lib/shopify/session';

/**
 * GraphQL Query for fetching catalog products with cursor pagination.
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
    const { cursor = null, limit = 100 } = body;
    let shopDomain = body.shopDomain || body.shop_domain || body.shop;

    if (!shopDomain) {
      shopDomain = 'demo-store.myshopify.com';
    }

    // Resolve offline access token from session store if not passed in request body
    let accessToken = body.accessToken;
    if (!accessToken && shopDomain) {
      const session = await getSessionByShop(shopDomain);
      if (session) {
        accessToken = session.accessToken;
      }
    }

    const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true' || !accessToken;

    // =========================================================================
    // DEMO MODE / FALLBACK SIMULATION
    // =========================================================================
    if (isDemo) {
      return NextResponse.json({
        success: true,
        syncedCount: 6,
        hasNextPage: false,
        endCursor: null,
        shopId: 'demo-shop-uuid',
        message: 'Catalog sync simulated successfully in Demo Mode.',
      });
    }

    // =========================================================================
    // REAL SHOPIFY & SUPABASE SYNC FLOW
    // =========================================================================
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
      const { data: newShop, error: shopError } = await supabase
        .from('shops')
        .upsert(
          {
            shop_domain: shopDomain,
            access_token: accessToken,
            is_installed: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'shop_domain' }
        )
        .select('id')
        .single();

      if (shopError || !newShop) {
        throw new Error(`Failed to resolve shop record in Supabase: ${shopError?.message}`);
      }
      shopId = newShop.id;
    }

    // 2. Fetch page of products from Shopify GraphQL API
    const client = await createShopifyGraphQLClient(shopDomain, accessToken);
    const response: any = await client.request(PRODUCTS_GRAPHQL_QUERY, {
      variables: {
        first: Math.min(limit, 100),
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
      });
    }

    // 3. Transform GraphQL response into Supabase product records
    const productRows = edges.map((edge: any) => {
      const node = edge.node;
      const numericId = parseShopifyId(node.id);

      return {
        shop_id: shopId,
        shopify_product_id: numericId,
        title: node.title,
        handle: node.handle,
        body_html: node.descriptionHtml || '',
        status: (node.status || 'active').toLowerCase(),
        synced_at: new Date().toISOString(),
      };
    });

    // 4. Upsert product records into `products` table
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

    // 5. Insert corresponding audit queue records for background AI processing
    if (upsertedProducts && upsertedProducts.length > 0) {
      const queueRows = upsertedProducts.map((p) => ({
        shop_id: shopId,
        product_id: p.id,
        status: 'queued',
        created_at: new Date().toISOString(),
      }));

      const { error: queueError } = await supabase
        .from('audit_queue')
        .upsert(queueRows, {
          onConflict: 'shop_id,product_id',
        });

      if (queueError) {
        console.warn('Audit Queue Upsert Warning:', queueError.message);
      }
    }

    // 6. Return response for client-coordinated batching
    return NextResponse.json({
      success: true,
      syncedCount: edges.length,
      hasNextPage: pageInfo.hasNextPage || false,
      endCursor: pageInfo.endCursor || null,
      shopId,
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
