import '@shopify/shopify-api/adapters/node';
import { shopifyApi, ApiVersion, Session } from '@shopify/shopify-api';

export const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY || 'mock_key',
  apiSecretKey: process.env.SHOPIFY_API_SECRET || 'mock_secret',
  scopes: (process.env.SCOPES || 'read_products,write_products,read_themes,write_themes,write_metaobject_definitions,write_metaobjects').split(','),
  hostName: (process.env.SHOPIFY_APP_URL || 'localhost:3000').replace(/^https?:\/\//, ''),
  apiVersion: ApiVersion.April24,
  isEmbeddedApp: true,
});

export async function createShopifyGraphQLClient(shopDomain: string, accessToken: string) {
  const session = new Session({
    id: `offline_${shopDomain}`,
    shop: shopDomain,
    state: 'active',
    isOnline: false,
    accessToken,
  });

  return new shopify.clients.Graphql({ session });
}

/**
 * Execute a direct fetch request against Shopify Admin GraphQL API (2024-04).
 */
export async function executeShopifyAdminGraphQL(
  shopDomain: string,
  accessToken: string,
  query: string,
  variables: Record<string, any> = {}
) {
  const response = await fetch(`https://${shopDomain}/admin/api/2024-04/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken,
    },
    body: JSON.stringify({ query, variables }),
  });

  return response;
}
