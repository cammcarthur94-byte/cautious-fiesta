import { NextRequest, NextResponse } from 'next/server';
import { verifyOAuthHmac, isValidShopDomain } from '@/lib/shopify/verify';
import { upsertSession } from '@/lib/shopify/session';

export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/callback?code=...&hmac=...&shop=...&state=...&timestamp=...
 *
 * Handles the OAuth callback from Shopify after merchant grants consent.
 * Validates HMAC, exchanges authorization code for access token,
 * stores the session, registers webhooks, and redirects to the app dashboard.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const shop = searchParams.get('shop');
    const state = searchParams.get('state');
    const hmac = searchParams.get('hmac');
    const timestamp = searchParams.get('timestamp');

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

    // Exchange authorization code for permanent access token
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
      return NextResponse.json(
        { success: false, error: `Token exchange failed: ${errorText}` },
        { status: 500 }
      );
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    const scope = tokenData.scope;

    // Persist session to Supabase
    await upsertSession({
      shopDomain: shop,
      accessToken,
      scope,
    });

    // Register webhooks via Admin API
    await registerWebhooks(shop, accessToken);

    // Redirect to the embedded app dashboard
    const appUrl = process.env.SHOPIFY_APP_URL || `https://${req.headers.get('host')}`;
    const embedUrl = `https://${shop}/admin/apps/${apiKey}`;

    const response = NextResponse.redirect(embedUrl);
    // Clear the OAuth state cookie
    response.cookies.set('shopify_oauth_state', '', {
      httpOnly: true,
      secure: true,
      maxAge: 0,
      path: '/',
    });

    return response;
  } catch (error: any) {
    console.error('OAuth callback error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * Register mandatory webhooks with the Shopify Admin API.
 * These are also declared in shopify.app.toml for CLI-managed registration,
 * but we register programmatically as a safety net.
 */
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
      await fetch(`https://${shop}/admin/api/2024-04/webhooks.json`, {
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
    } catch (e) {
      console.error(`Failed to register webhook ${wh.topic}:`, e);
    }
  }
}
