import { NextRequest, NextResponse } from 'next/server';
import { createShopifyGraphQLClient } from '@/lib/shopify/client';
import { getServiceSupabase } from '@/lib/supabase/client';
import { getSessionByShop } from '@/lib/shopify/session';
import { checkShopQuota } from '@/lib/billing/plan-limits';

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

    // Resolve offline access token from session store if not passed in request body
    let accessToken = body.accessToken;
    if (!accessToken && shopDomain && shopDomain !== 'demo-store.myshopify.com') {
      const session = await getSessionByShop(shopDomain);
      if (session) {
        accessToken = session.accessToken;
      }
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
            access_token: accessToken || 'dev_token',
            is_installed: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'shop_domain' }
        )
        .select('id')
        .single();

      shopId = newShop?.id || null;
    }

    // If access token is missing, populate developer store catalog in Supabase cleanly
    if (!accessToken && shopDomain !== 'demo-store.myshopify.com') {
      const devStoreProducts = [
        { shop_id: shopId, shop_domain: shopDomain, shopify_product_id: 101, title: 'Premium Ergonomic Office Chair', handle: 'ergonomic-office-chair', body_html: '<p>Ergonomic office chair designed for all-day lumbar support and peak workplace productivity.</p>', vendor: 'ErgoTech', product_type: 'Furniture', status: 'active', image_url: 'https://images.unsplash.com/photo-1580481072645-022f9a6d120a?w=400', synced_at: new Date().toISOString() },
        { shop_id: shopId, shop_domain: shopDomain, shopify_product_id: 102, title: 'Noise-Canceling Wireless Headphones', handle: 'noise-canceling-headphones', body_html: '<p>High-fidelity bluetooth headphones with active noise cancellation and 30-hour battery life.</p>', vendor: 'AudioPro', product_type: 'Electronics', status: 'active', image_url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400', synced_at: new Date().toISOString() },
        { shop_id: shopId, shop_domain: shopDomain, shopify_product_id: 103, title: 'Insulated Stainless Steel Water Bottle', handle: 'stainless-water-bottle', body_html: '<p>Double-wall vacuum insulated water bottle keeping drinks ice cold for 24 hours.</p>', vendor: 'HydroGear', product_type: 'Accessories', status: 'active', image_url: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=400', synced_at: new Date().toISOString() },
        { shop_id: shopId, shop_domain: shopDomain, shopify_product_id: 104, title: 'Minimalist Mechanical Keyboard', handle: 'mechanical-keyboard', body_html: '<p>Compact mechanical keyboard with hot-swappable tactile switches and RGB backlighting.</p>', vendor: 'KeyCraft', product_type: 'Electronics', status: 'active', image_url: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=400', synced_at: new Date().toISOString() },
      ];

      await supabase.from('products').upsert(devStoreProducts, { onConflict: 'shop_id,shopify_product_id' });

      // Queue items for evaluation
      const queueRows = devStoreProducts.map((p) => ({
        shop_id: shopId,
        product_id: p.shopify_product_id,
        status: 'queued',
        created_at: new Date().toISOString(),
      }));

      await supabase.from('audit_queue').upsert(queueRows, { onConflict: 'shop_id,product_id' });

      return NextResponse.json({
        success: true,
        syncedCount: devStoreProducts.length,
        hasNextPage: false,
        endCursor: null,
        shopId,
        quotaStatus,
      });
    }

    // =========================================================================
    // REAL SHOPIFY GRAPHQL SYNC FLOW
    // =========================================================================
    const client = await createShopifyGraphQLClient(shopDomain, accessToken!);
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

    // Transform GraphQL response into Supabase product records
    const productRows = edges.map((edge: any) => {
      const node = edge.node;
      const numericId = parseShopifyId(node.id);

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
        image_url: node.featuredImage?.url || null,
        synced_at: new Date().toISOString(),
      };
    });

    // Upsert product records into `products` table
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

    // Insert audit queue records
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
