import { getServiceSupabase } from './supabase/client';
import { createShopifyGraphQLClient } from './shopify/client';

import {
  SubscriptionRecord,
  PlanTierKey,
  PlanConfig,
  PLAN_TIERS,
  UsageCheckResult,
  resolveCanonicalPlan,
  LEGACY_PLAN_MAP,
} from './billing/plans';

export * from './billing/plans';

// In-memory fallback for local demo mode
const demoSubscriptions: Record<string, SubscriptionRecord> = {
  'demo-store.myshopify.com': {
    shop_domain: 'demo-store.myshopify.com',
    active_plan: 'FREE',
    billing_cycle_end: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString(),
    optimizations_used_this_month: 0,
    shopify_subscription_id: null,
    status: 'ACTIVE',
  },
};

/**
 * Retrieve or initialize a store's subscription record.
 * Handles automatic monthly cycle rollover if cycle end has passed.
 */
export async function getSubscription(shopDomain: string): Promise<SubscriptionRecord> {
  const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true' || !process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (isDemo) {
    if (!demoSubscriptions[shopDomain]) {
      demoSubscriptions[shopDomain] = {
        shop_domain: shopDomain || 'demo-store.myshopify.com',
        active_plan: 'FREE',
        billing_cycle_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        optimizations_used_this_month: 0,
        shopify_subscription_id: null,
        status: 'ACTIVE',
      };
    }
    return demoSubscriptions[shopDomain];
  }

  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('shop_domain', shopDomain)
    .single();

  const now = new Date();

  // If no subscription exists yet, create default FREE record
  if (error || !data) {
    const defaultSub: SubscriptionRecord = {
      shop_domain: shopDomain,
      active_plan: 'FREE',
      billing_cycle_end: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      optimizations_used_this_month: 0,
      shopify_subscription_id: null,
      status: 'ACTIVE',
    };

    await supabase.from('subscriptions').upsert(defaultSub, { onConflict: 'shop_domain' });
    return defaultSub;
  }

  // Normalize any legacy plan key that survived in the DB
  const canonicalPlan = resolveCanonicalPlan(data.active_plan);
  if (canonicalPlan !== data.active_plan) {
    await supabase
      .from('subscriptions')
      .update({ active_plan: canonicalPlan })
      .eq('shop_domain', shopDomain);
    data.active_plan = canonicalPlan;
  }

  // Check if billing cycle has rolled over → reset usage counters
  const cycleEnd = new Date(data.billing_cycle_end);
  if (now > cycleEnd) {
    const nextCycleEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const updated = {
      ...data,
      billing_cycle_end: nextCycleEnd,
      optimizations_used_this_month: 0,
    };
    await supabase
      .from('subscriptions')
      .update({ billing_cycle_end: nextCycleEnd, optimizations_used_this_month: 0 })
      .eq('shop_domain', shopDomain);

    // Also reset shops.monthly_evaluations_used
    await supabase
      .from('shops')
      .update({ monthly_evaluations_used: 0, billing_cycle_end: nextCycleEnd })
      .eq('shop_domain', shopDomain);

    return updated;
  }

  return data;
}

/**
 * Check if the merchant has available AI evaluation quota.
 * Returns enriched result including product catalog cap status.
 */
export async function checkUsageLimit(shopDomain: string): Promise<UsageCheckResult> {
  const sub = await getSubscription(shopDomain);
  const canonicalPlan = resolveCanonicalPlan(sub.active_plan);
  const planConfig = PLAN_TIERS[canonicalPlan] || PLAN_TIERS.FREE;
  const limit = planConfig.limit;
  const productLimit = planConfig.productLimit;
  const used = sub.optimizations_used_this_month || 0;
  const remaining = Math.max(0, limit - used);
  const percent = Math.min(100, Math.round((used / limit) * 100));
  const allowed = used < limit;

  // Fetch synced product count from shops table
  let syncedProducts = 0;
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const supabase = getServiceSupabase();
    const { data: shopRow } = await supabase
      .from('shops')
      .select('synced_products_count')
      .eq('shop_domain', shopDomain)
      .single();
    syncedProducts = shopRow?.synced_products_count ?? 0;
  }

  const productCapReached = syncedProducts >= productLimit;

  return {
    allowed,
    activePlan: canonicalPlan,
    planName: planConfig.name,
    used,
    limit,
    remaining,
    percent,
    billingCycleEnd: sub.billing_cycle_end,
    syncedProducts,
    productLimit,
    productCapReached,
    message: allowed
      ? undefined
      : `Monthly AI evaluation limit reached (${used}/${limit}). Upgrade to Growth Pilot ($29/mo) for 50 evaluations/month and up to 500 products.`,
  };
}

/**
 * Increment the optimization usage counter by a given amount (default 1).
 * Updates both the subscriptions table and shops.monthly_evaluations_used atomically.
 */
export async function incrementUsage(shopDomain: string, count: number = 1): Promise<number> {
  const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true' || !process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (isDemo) {
    const sub = await getSubscription(shopDomain);
    sub.optimizations_used_this_month = (sub.optimizations_used_this_month || 0) + count;
    demoSubscriptions[shopDomain] = sub;
    return sub.optimizations_used_this_month;
  }

  const supabase = getServiceSupabase();
  const sub = await getSubscription(shopDomain);
  const newCount = (sub.optimizations_used_this_month || 0) + count;

  await supabase
    .from('subscriptions')
    .update({ optimizations_used_this_month: newCount })
    .eq('shop_domain', shopDomain);

  // Mirror to shops table for cross-table quota reads
  await supabase
    .from('shops')
    .update({ monthly_evaluations_used: newCount })
    .eq('shop_domain', shopDomain);

  return newCount;
}

/**
 * Upsert subscription details (e.g. from Shopify webhook or demo toggle).
 * Automatically resolves legacy BASIC/PRO keys to GROWTH_PILOT.
 */
export async function upsertSubscriptionRecord(
  shopDomain: string,
  record: Partial<SubscriptionRecord>
): Promise<SubscriptionRecord> {
  const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true' || !process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Normalize legacy plan key
  if (record.active_plan) {
    record.active_plan = resolveCanonicalPlan(record.active_plan);
  }

  if (isDemo) {
    const current = await getSubscription(shopDomain);
    const updated: SubscriptionRecord = { ...current, ...record, shop_domain: shopDomain };
    demoSubscriptions[shopDomain] = updated;
    return updated;
  }

  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from('subscriptions')
    .upsert(
      { shop_domain: shopDomain, ...record, updated_at: new Date().toISOString() },
      { onConflict: 'shop_domain' }
    )
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to update subscription in Supabase: ${error?.message}`);
  }

  // Keep shops table in sync with plan_tier and subscription_status
  const canonicalPlan = resolveCanonicalPlan(data.active_plan);
  const planTier = canonicalPlan === 'GROWTH_PILOT' ? 'growth_pilot' : 'free';
  const subscriptionStatus =
    data.status === 'ACTIVE' && canonicalPlan !== 'FREE'
      ? 'active'
      : data.status === 'PENDING'
      ? 'trial'
      : 'inactive';

  await supabase
    .from('shops')
    .update({ plan_tier: planTier, subscription_status: subscriptionStatus, updated_at: new Date().toISOString() })
    .eq('shop_domain', shopDomain);

  return data;
}

/**
 * GraphQL Mutation: create an app recurring subscription via Shopify Billing API.
 * Only accepts GROWTH_PILOT as the paid plan key.
 */
export async function createAppSubscriptionGraphQL(options: {
  shopDomain: string;
  accessToken: string;
  planKey: 'GROWTH_PILOT';
  returnUrl: string;
  isTest?: boolean;
}): Promise<{ confirmationUrl: string; appSubscriptionId: string }> {
  const { shopDomain, accessToken, planKey, returnUrl, isTest } = options;
  const plan = PLAN_TIERS[planKey];

  if (!plan) {
    throw new Error(`Invalid plan key: ${planKey}. Only 'GROWTH_PILOT' is a valid paid plan.`);
  }

  const client = await createShopifyGraphQLClient(shopDomain, accessToken);

  const mutation = `
    mutation AppSubscriptionCreate(
      $name: String!
      $returnUrl: URL!
      $lineItems: [AppSubscriptionLineItemInput!]!
      $test: Boolean
    ) {
      appSubscriptionCreate(
        name: $name
        returnUrl: $returnUrl
        lineItems: $lineItems
        test: $test
      ) {
        userErrors {
          field
          message
        }
        confirmationUrl
        appSubscription {
          id
          status
          createdAt
        }
      }
    }
  `;

  const variables = {
    name: `GeoOptima - ${plan.name}`,
    returnUrl,
    test: isTest ?? (process.env.NODE_ENV !== 'production' || process.env.SHOPIFY_BILLING_TEST_MODE === 'true'),
    lineItems: [
      {
        plan: {
          appRecurringPricingDetails: {
            price: {
              amount: plan.price.toFixed(2),
              currencyCode: plan.currencyCode,
            },
            interval: plan.interval,
          },
        },
      },
    ],
  };

  const response: any = await client.request(mutation, { variables });
  const result = response.data?.appSubscriptionCreate;

  if (result?.userErrors?.length > 0) {
    const errorMsg = result.userErrors.map((e: any) => `${e.field}: ${e.message}`).join(', ');
    throw new Error(`Shopify Billing Error: ${errorMsg}`);
  }

  if (!result?.confirmationUrl) {
    throw new Error('Shopify did not return a subscription confirmationUrl.');
  }

  return {
    confirmationUrl: result.confirmationUrl,
    appSubscriptionId: result.appSubscription?.id,
  };
}

/**
 * GraphQL Mutation to cancel an active Shopify subscription.
 */
export async function cancelAppSubscriptionGraphQL(options: {
  shopDomain: string;
  accessToken: string;
  subscriptionId: string;
}): Promise<boolean> {
  const { shopDomain, accessToken, subscriptionId } = options;
  const client = await createShopifyGraphQLClient(shopDomain, accessToken);

  const mutation = `
    mutation AppSubscriptionCancel($id: ID!) {
      appSubscriptionCancel(id: $id) {
        userErrors {
          field
          message
        }
        appSubscription {
          id
          status
        }
      }
    }
  `;

  const response: any = await client.request(mutation, { variables: { id: subscriptionId } });
  const result = response.data?.appSubscriptionCancel;

  if (result?.userErrors?.length > 0) {
    const errorMsg = result.userErrors.map((e: any) => `${e.field}: ${e.message}`).join(', ');
    throw new Error(`Shopify Billing Cancellation Error: ${errorMsg}`);
  }

  return result?.appSubscription?.status === 'CANCELLED';
}
