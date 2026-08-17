import { createShopifyGraphQLClient } from './client';
import { ShopifyProductItem } from '../scoring/types';
import { getServiceSupabase } from '../supabase/client';

/**
 * Fetch all products from a Shopify store using cursor-based GraphQL pagination.
 * Respects rate limits with built-in retry logic.
 */
export async function fetchAllProducts(
  shopDomain: string,
  accessToken: string,
  options?: { limit?: number; maxPages?: number }
): Promise<ShopifyProductItem[]> {
  const client = await createShopifyGraphQLClient(shopDomain, accessToken);
  const pageSize = options?.limit || 50;
  const maxPages = options?.maxPages || 20; // Safety valve: max 1000 products

  const products: ShopifyProductItem[] = [];
  let hasNextPage = true;
  let cursor: string | null = null;
  let pageCount = 0;

  while (hasNextPage && pageCount < maxPages) {
    const query = `
      query FetchProducts($first: Int!, $after: String) {
        products(first: $first, after: $after) {
          edges {
            cursor
            node {
              id
              title
              handle
              descriptionHtml
              vendor
              productType
              status
              featuredImage {
                url
              }
              variants(first: 1) {
                edges {
                  node {
                    price
                  }
                }
              }
              metafields(first: 10, namespace: "geo_aeo") {
                edges {
                  node {
                    key
                    value
                    type
                  }
                }
              }
            }
          }
          pageInfo {
            hasNextPage
          }
        }
      }
    `;

    try {
      const response: any = await client.request(query, {
        variables: {
          first: pageSize,
          after: cursor,
        },
      });

      const edges = response.data?.products?.edges || [];

      for (const edge of edges) {
        const node = edge.node;
        cursor = edge.cursor;

        // Parse metafields
        const metafields: ShopifyProductItem['metafields'] = {};
        const metafieldEdges = node.metafields?.edges || [];
        for (const mfEdge of metafieldEdges) {
          const mf = mfEdge.node;
          if (mf.key === 'jsonld_schema') {
            try { metafields.jsonld_schema = JSON.parse(mf.value); } catch {}
          }
          if (mf.key === 'faq_data') {
            try { metafields.faq_data = JSON.parse(mf.value); } catch {}
          }
          if (mf.key === 'revision_history') {
            try { metafields.revision_history = JSON.parse(mf.value); } catch {}
          }
        }

        products.push({
          id: node.id,
          title: node.title,
          handle: node.handle,
          body_html: node.descriptionHtml || '',
          vendor: node.vendor || '',
          product_type: node.productType || '',
          status: node.status?.toLowerCase() as 'active' | 'draft' | 'archived',
          image_url: node.featuredImage?.url,
          price: node.variants?.edges?.[0]?.node?.price,
          metafields,
        });
      }

      hasNextPage = response.data?.products?.pageInfo?.hasNextPage ?? false;
      pageCount++;
    } catch (error: any) {
      // Handle rate limiting with exponential backoff
      if (error.response?.status === 429) {
        const retryAfter = parseInt(error.response.headers?.get('Retry-After') || '2', 10);
        console.warn(`Rate limited by Shopify. Retrying after ${retryAfter}s...`);
        await sleep(retryAfter * 1000);
        continue; // Retry the same page
      }
      console.error('Error fetching products from Shopify:', error);
      break;
    }
  }

  return products;
}

/**
 * Update a single product's description HTML on Shopify.
 */
export async function updateProductDescription(
  shopDomain: string,
  accessToken: string,
  productId: string,
  descriptionHtml: string
): Promise<{ success: boolean; error?: string }> {
  const client = await createShopifyGraphQLClient(shopDomain, accessToken);

  const mutation = `
    mutation ProductUpdate($input: ProductInput!) {
      productUpdate(input: $input) {
        product {
          id
          title
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  try {
    const response: any = await client.request(mutation, {
      variables: {
        input: {
          id: productId,
          descriptionHtml,
        },
      },
    });

    const userErrors = response.data?.productUpdate?.userErrors || [];
    if (userErrors.length > 0) {
      return { success: false, error: userErrors.map((e: any) => e.message).join(', ') };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Sync a batch of products to the Supabase products table.
 */
export async function syncProductsToSupabase(
  shopDomain: string,
  products: ShopifyProductItem[]
): Promise<{ synced: number; errors: number }> {
  const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true' || !process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (isDemo) return { synced: products.length, errors: 0 };

  const supabase = getServiceSupabase();
  let synced = 0;
  let errors = 0;

  // Batch upsert in chunks of 50
  const chunkSize = 50;
  for (let i = 0; i < products.length; i += chunkSize) {
    const chunk = products.slice(i, i + chunkSize);
    const rows = chunk.map((p) => ({
      shop_domain: shopDomain,
      shopify_product_id: p.id,
      title: p.title,
      handle: p.handle,
      body_html: p.body_html,
      vendor: p.vendor,
      product_type: p.product_type,
      status: p.status,
      image_url: p.image_url,
      last_synced_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('products')
      .upsert(rows, { onConflict: 'shop_domain,shopify_product_id' });

    if (error) {
      console.error('Supabase sync error:', error);
      errors += chunk.length;
    } else {
      synced += chunk.length;
    }
  }

  return { synced, errors };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
