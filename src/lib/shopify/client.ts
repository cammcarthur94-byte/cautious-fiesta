import '@shopify/shopify-api/adapters/node';
import { shopifyApi, ApiVersion, Session } from '@shopify/shopify-api';

export const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY || 'mock_key',
  apiSecretKey: process.env.SHOPIFY_API_SECRET || 'mock_secret',
  scopes: (process.env.SCOPES || 'read_products,write_products,read_metafields,write_metafields').split(','),
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
