import { getServiceSupabase } from '../supabase/client';

export interface ShopSession {
  shopDomain: string;
  accessToken: string;
  scope: string;
  installedAt: string;
  updatedAt: string;
}

/**
 * Retrieve a stored session for a given shop domain from Supabase.
 * Checks both `shops` and `stores` tables for maximum compatibility.
 */
export async function getSessionByShop(shopDomain: string): Promise<ShopSession | null> {
  const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true' || !process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (isDemo && shopDomain === 'demo-store.myshopify.com') {
    return {
      shopDomain: 'demo-store.myshopify.com',
      accessToken: 'demo_access_token',
      scope: process.env.SCOPES || 'read_products,write_products',
      installedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;

  const supabase = getServiceSupabase();

  // 1. Try fetching from `shops` table
  const { data: shopData } = await supabase
    .from('shops')
    .select('*')
    .eq('shop_domain', shopDomain)
    .single();

  if (shopData && shopData.access_token) {
    return {
      shopDomain: shopData.shop_domain,
      accessToken: shopData.access_token,
      scope: shopData.scope || 'read_products,write_products',
      installedAt: shopData.created_at || new Date().toISOString(),
      updatedAt: shopData.updated_at || new Date().toISOString(),
    };
  }

  // 2. Try fetching from `stores` table
  const { data: storeData } = await supabase
    .from('stores')
    .select('*')
    .eq('shop_domain', shopDomain)
    .single();

  if (storeData && storeData.access_token) {
    return {
      shopDomain: storeData.shop_domain,
      accessToken: storeData.access_token,
      scope: storeData.scope || 'read_products,write_products',
      installedAt: storeData.installed_at || new Date().toISOString(),
      updatedAt: storeData.updated_at || new Date().toISOString(),
    };
  }

  return null;
}

/**
 * Create or update a shop session in Supabase after OAuth callback.
 * Saves to both `shops` and `stores` tables to ensure session consistency.
 */
export async function upsertSession(session: {
  shopDomain: string;
  accessToken: string;
  scope: string;
}): Promise<void> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return;

  const supabase = getServiceSupabase();

  await supabase.from('stores').upsert(
    {
      shop_domain: session.shopDomain,
      access_token: session.accessToken,
      scope: session.scope,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'shop_domain' }
  );

  await supabase.from('shops').upsert(
    {
      shop_domain: session.shopDomain,
      access_token: session.accessToken,
      is_installed: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'shop_domain' }
  );
}

/**
 * Delete a shop session (used during app/uninstalled webhook).
 */
export async function deleteSession(shopDomain: string): Promise<void> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return;

  const supabase = getServiceSupabase();
  await supabase.from('stores').delete().eq('shop_domain', shopDomain);
  await supabase.from('shops').update({ is_installed: false }).eq('shop_domain', shopDomain);
}

/**
 * Retrieve all active shop domains (used by cron re-audit).
 */
export async function getAllActiveShops(): Promise<string[]> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return ['demo-store.myshopify.com'];

  const supabase = getServiceSupabase();
  const { data } = await supabase.from('shops').select('shop_domain').eq('is_installed', true);
  return (data || []).map((s: any) => s.shop_domain);
}
