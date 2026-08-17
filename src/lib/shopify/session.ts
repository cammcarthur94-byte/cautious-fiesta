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
 */
export async function getSessionByShop(shopDomain: string): Promise<ShopSession | null> {
  const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true' || !process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (isDemo) {
    return {
      shopDomain: 'demo-store.myshopify.com',
      accessToken: 'demo_access_token',
      scope: process.env.SCOPES || 'read_products,write_products',
      installedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from('stores')
    .select('*')
    .eq('shop_domain', shopDomain)
    .single();

  if (error || !data) return null;

  return {
    shopDomain: data.shop_domain,
    accessToken: data.access_token,
    scope: data.scope,
    installedAt: data.installed_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Create or update a shop session in Supabase after OAuth callback.
 */
export async function upsertSession(session: {
  shopDomain: string;
  accessToken: string;
  scope: string;
}): Promise<void> {
  const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true' || !process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (isDemo) return;

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
}

/**
 * Delete a shop session (used during app/uninstalled webhook).
 */
export async function deleteSession(shopDomain: string): Promise<void> {
  const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true' || !process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (isDemo) return;

  const supabase = getServiceSupabase();
  await supabase.from('stores').delete().eq('shop_domain', shopDomain);
}

/**
 * Retrieve all active shop domains (used by cron re-audit).
 */
export async function getAllActiveShops(): Promise<string[]> {
  const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true' || !process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (isDemo) return ['demo-store.myshopify.com'];

  const supabase = getServiceSupabase();
  const { data } = await supabase.from('stores').select('shop_domain');
  return (data || []).map((s: any) => s.shop_domain);
}
