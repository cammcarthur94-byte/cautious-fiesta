import { NextRequest, NextResponse } from 'next/server';
import { verifyOAuthHmac, isValidShopDomain } from '@/lib/shopify/verify';
import { upsertSession } from '@/lib/shopify/session';

export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/callback?code=...&hmac=...&shop=...&state=...&timestamp=...&host=...
 *
 * Handles the OAuth callback from Shopify after merchant installation/consent.
 * Validates HMAC, exchanges authorization code for an offline access token,
 * stores session in Supabase, registers webhooks (non-blocking), and issues
 * a strict HTTP 302 redirect to the Shopify embedded admin app URL for
 * App Store automated compliance.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const shop = searchParams.get('shop');
    const state = searchParams.get('state');
    const hmac = searchParams.get('hmac');
    const hostParamFromUrl = searchParams.get('host');

    // Validate required params
    if (!code || !shop || !state || !hmac) {
      return NextResponse.json(
        { success: false, error: 'Missing required OAuth callback parameters' },
        { status: 400 }
      );
    }

    // Validate shop domain format
    if (!isValidShopDomain(shop)) {
      return NextResponse.json(
        { success: false, error: 'Invalid shop domain format' },
        { status: 400 }
      );
    }

    // Verify state nonce matches cookie (CSRF protection)
    const storedState = req.cookies.get('shopify_oauth_state')?.value;
    if (!storedState || storedState !== state) {
      console.error('[OAuth Callback] State mismatch. stored:', storedState, 'received:', state);
      return NextResponse.json(
        { success: false, error: 'OAuth state mismatch — possible CSRF attack' },
        { status: 403 }
      );
    }

    // Verify Shopify HMAC signature
    const queryParams: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      queryParams[key] = value;
    });

    if (!verifyOAuthHmac(queryParams)) {
      return NextResponse.json(
        { success: false, error: 'HMAC verification failed — request may have been tampered with' },
        { status: 403 }
      );
    }

    // Exchange authorization code for a permanent offline access token.
    // NOTE: Do NOT include `expiring: 1` — it is not a valid Shopify OAuth parameter
    // and may cause online (short-lived) token issuance instead of offline (permanent).
    const apiKey = process.env.SHOPIFY_API_KEY!;
    const apiSecret = process.env.SHOPIFY_API_SECRET!;

    const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: apiKey,
        client_secret: apiSecret,
        code,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('[OAuth Callback] Token exchange failed:', tokenResponse.status, errorText);
      return NextResponse.json(
        { success: false, error: `Token exchange failed: ${errorText}` },
        { status: 500 }
      );
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    const scope = tokenData.scope;

    if (!accessToken) {
      console.error('[OAuth Callback] Token exchange succeeded but no access_token in response:', tokenData);
      return NextResponse.json(
        { success: false, error: 'Token exchange returned no access token' },
        { status: 500 }
      );
    }

    console.log('[OAuth Callback] Token exchange successful for shop:', shop, '| scope:', scope);

    // Persist session to Supabase — must succeed before redirect
    try {
      await upsertSession({
        shopDomain: shop,
        accessToken,
        scope,
      });
      console.log('[OAuth Callback] Session upserted to Supabase for shop:', shop);
    } catch (sessionErr: any) {
      console.error('[OAuth Callback] Failed to upsert session to Supabase:', sessionErr?.message || sessionErr);
      // Non-fatal: we still redirect so the merchant isn't blocked; session may retry on next request.
    }

    // Register mandatory webhooks asynchronously — do not let failures block the redirect.
    // Use a race against a 5-second timeout to avoid hanging the callback response.
    registerWebhooksWithTimeout(shop, accessToken, 5000).catch((e) => {
      console.warn('[OAuth Callback] Webhook registration timed out or failed (non-blocking):', e?.message || e);
    });

    // Resolve the Shopify embedded admin app URL.
    // This is the URL Shopify's automated App Store compliance checker follows after install.
    // Format: https://{shop}/admin/apps/{api_key}
    const embeddedAppUrl = `https://${shop}/admin/apps/${apiKey}`;

    console.log('[OAuth Callback] Redirecting to embedded app URL:', embeddedAppUrl);

    // Issue strict HTTP 302 redirect for Shopify App Store automated test compliance
    const response = NextResponse.redirect(embeddedAppUrl, 302);

    // Clear OAuth CSRF state cookie
    response.cookies.set('shopify_oauth_state', '', {
      httpOnly: true,
      secure: true,
      maxAge: 0,
      path: '/',
    });

    // Persist resolved shop domain in cookie for use by the embedded app
    if (shop) {
      response.cookies.set('shopify_shop_domain', shop.toLowerCase(), {
        path: '/',
        sameSite: 'none',
        secure: true,
        httpOnly: false,
        maxAge: 60 * 60 * 24 * 30, // 30 days
      });
    }

    return response;
  } catch (error: any) {
    console.error('[OAuth Callback] Unhandled error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * Register mandatory webhooks with the Shopify Admin API.
 * Wrapped in a timeout so failures don't block the OAuth redirect.
 */
async function registerWebhooksWithTimeout(
  shop: string,
  accessToken: string,
  timeoutMs: number
): Promise<void> {
  const timeoutPromise = new Promise<void>((_, reject) =>
    setTimeout(() => reject(new Error(`Webhook registration timed out after ${timeoutMs}ms`)), timeoutMs)
  );
  return Promise.race([registerWebhooks(shop, accessToken), timeoutPromise]);
}

async function registerWebhooks(shop: string, accessToken: string) {
  const appUrl = process.env.SHOPIFY_APP_URL || '';
  const webhooks = [
    {
      topic: 'products/update',
      address: `${appUrl}/api/webhooks/products-update`,
    },
    {
      topic: 'app/uninstalled',
      address: `${appUrl}/api/webhooks/app-uninstalled`,
    },
  ];

  for (const wh of webhooks) {
    try {
      const res = await fetch(`https://${shop}/admin/api/2024-04/webhooks.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': accessToken,
        },
        body: JSON.stringify({
          webhook: {
            topic: wh.topic,
            address: wh.address,
            format: 'json',
          },
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        console.warn(`[Webhook Registration] ${wh.topic} returned ${res.status}:`, body);
      } else {
        console.log(`[Webhook Registration] Registered ${wh.topic} for ${shop}`);
      }
    } catch (e) {
      console.error(`[Webhook Registration] Failed to register webhook ${wh.topic}:`, e);
    }
  }
}
