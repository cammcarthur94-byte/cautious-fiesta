import { createShopifyGraphQLClient } from './shopify/client';

export interface GraphQLThrottleStatus {
  maximumAvailable: number;
  currentlyAvailable: number;
  restoreRate: number;
}

export interface GraphQLCostExtension {
  requestedQueryCost: number;
  actualQueryCost?: number;
  throttleStatus: GraphQLThrottleStatus;
}

export interface GraphQLResponse<T = any> {
  data?: T;
  errors?: Array<{ message: string; locations?: any; path?: string[] }>;
  extensions?: {
    cost?: GraphQLCostExtension;
  };
}

export class ShopifyRateLimitError extends Error {
  retryAfterSeconds: number;

  constructor(message: string, retryAfterSeconds: number = 2) {
    super(message);
    this.name = 'ShopifyRateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a Shopify GraphQL query with cost tracking and exponential backoff.
 */
export async function executeShopifyGraphQLQuery<T = any>(
  shopDomain: string,
  accessToken: string,
  query: string,
  variables: Record<string, any> = {},
  maxRetries: number = 3
): Promise<GraphQLResponse<T>> {
  const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true' || !accessToken;

  if (isDemo) {
    return {
      data: {} as T,
      extensions: {
        cost: {
          requestedQueryCost: 1,
          actualQueryCost: 1,
          throttleStatus: {
            maximumAvailable: 1000,
            currentlyAvailable: 999,
            restoreRate: 50,
          },
        },
      },
    };
  }

  const client = await createShopifyGraphQLClient(shopDomain, accessToken);
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      const response: any = await client.request(query, { variables });

      // Inspect Cost Tracking extensions
      const cost = response.extensions?.cost as GraphQLCostExtension | undefined;
      if (cost && cost.throttleStatus) {
        const requestedQueryCost = cost.requestedQueryCost || 1;
        const { currentlyAvailable, restoreRate, maximumAvailable } = cost.throttleStatus;

        // If bucket capacity is low, pause to refill bucket
        if (currentlyAvailable < requestedQueryCost) {
          const waitMs = Math.ceil((requestedQueryCost - currentlyAvailable) / restoreRate) * 1000;
          console.warn(
            `[Shopify GraphQL Cost Throttling] Bucket low (${currentlyAvailable}/${maximumAvailable}). Pausing ${waitMs}ms.`
          );
          await sleep(waitMs);
        }
      }

      // Check for user or GraphQL level throttling errors
      if (response.errors && response.errors.some((e: any) => e.message?.toLowerCase().includes('throttled'))) {
        throw new ShopifyRateLimitError('Shopify GraphQL API Throttled', 2);
      }

      return response as GraphQLResponse<T>;
    } catch (error: any) {
      attempt++;

      const status = error.response?.status || error.statusCode;
      const isRateLimit = status === 429 || error instanceof ShopifyRateLimitError || error.message?.includes('Throttled');

      if (isRateLimit && attempt <= maxRetries) {
        // Parse Retry-After header if provided
        const retryHeader = error.response?.headers?.get?.('Retry-After');
        let waitSeconds = retryHeader ? parseInt(retryHeader, 10) : Math.pow(2, attempt);

        if (isNaN(waitSeconds) || waitSeconds <= 0) {
          waitSeconds = Math.pow(2, attempt);
        }

        // Add small jitter
        const jitterMs = Math.floor(Math.random() * 500);
        const totalWaitMs = waitSeconds * 1000 + jitterMs;

        console.warn(
          `[Shopify GraphQL 429 Rate Limit] Retrying attempt ${attempt}/${maxRetries} after ${totalWaitMs}ms.`
        );

        await sleep(totalWaitMs);
        continue;
      }

      // Re-throw if retries exhausted or non-retryable error
      throw error;
    }
  }

  throw new Error(`Shopify GraphQL query failed after ${maxRetries} retries.`);
}
