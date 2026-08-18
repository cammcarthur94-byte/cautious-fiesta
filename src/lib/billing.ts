import { getServiceSupabase } from './supabase/client';
import { createShopifyGraphQLClient } from './shopify/client';

import {
  SubscriptionRecord,
  PlanTierKey,
  PlanConfig,
  PLAN_TIERS,
  UsageCheckResult,
} from './billing/plans';

export * from './billing/plans';

// In-memory fallback for local demo mode
const demoSubscriptions: Record<string, SubscriptionRecord> = {
  'demo-store.myshopify.com': {
    shop_domain: 'demo-store.myshopify.com',
    active_plan: 'FREE',
    billing_cycle_end: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString(),
    optimizations_used_this_month: 2,
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

  // Check if billing cycle has rolled over
  const cycleEnd = new Date(data.billing_cycle_end);
  if (now > cycleEnd) {
    // Reset usage for the new billing cycle
    const nextCycleEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const updated = {
      ...data,
      billing_cycle_end: nextCycleEnd,
      optimizations_used_this_month: 0,
    };
    await supabase
      .from('subscriptions')
      .update({
        billing_cycle_end: nextCycleEnd,
        optimizations_used_this_month: 0,
      })
      .eq('shop_domain', shopDomain);

    return updated;
  }

  return data;
}

/**
 * Check if the merchant has available optimization quota.
 */
export async function checkUsageLimit(shopDomain: string): Promise<UsageCheckResult> {
  const sub = await getSubscription(shopDomain);
  const planConfig = PLAN_TIERS[sub.active_plan] || PLAN_TIERS.FREE;
  const limit = planConfig.limit;
  const used = sub.optimizations_used_this_month || 0;
  const remaining = Math.max(0, limit - used);
  const percent = Math.min(100, Math.round((used / limit) * 100));
  const allowed = used < limit;

  return {
    allowed,
    activePlan: sub.active_plan,
    planName: planConfig.name,
    used,
    limit,
    remaining,
    percent,
    billingCycleEnd: sub.billing_cycle_end,
    message: allowed
      ? undefined
      : `Monthly optimization limit reached (${used}/${limit}). Please upgrade to Basic or Pro to unlock more optimizations.`,
  };
}

/**
 * Increment the optimization usage counter by a given amount (default 1).
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

  return newCount;
}

/**
 * Upsert subscription details (e.g. from Shopify webhook or demo toggle).
 */
export async function upsertSubscriptionRecord(
  shopDomain: string,
  record: Partial<SubscriptionRecord>
): Promise<SubscriptionRecord> {
  const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true' || !process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (isDemo) {
    const current = await getSubscription(shopDomain);
    const updated: SubscriptionRecord = {
      ...current,
      ...record,
      shop_domain: shopDomain,
    };
    demoSubscriptions[shopDomain] = updated;
    return updated;
  }

  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from('subscriptions')
    .upsert(
      {
        shop_domain: shopDomain,
        ...record,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'shop_domain' }
    )
    .select()
    .single();

  if (error || !data) {
    throw new Error(`Failed to update subscription in Supabase: ${error?.message}`);
  }

  return data;
}

/**
 * GraphQL Mutation to create an app recurring subscription via Shopify Billing API.
 */
export async function createAppSubscriptionGraphQL(options: {
  shopDomain: string;
  accessToken: string;
  planKey: 'BASIC' | 'PRO';
  returnUrl: string;
  isTest?: boolean;
}): Promise<{ confirmationUrl: string; appSubscriptionId: string }> {
  const { shopDomain, accessToken, planKey, returnUrl, isTest } = options;
  const plan = PLAN_TIERS[planKey];

  if (!plan) {
    throw new Error(`Invalid plan key: ${planKey}`);
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
