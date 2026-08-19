import { NextRequest, NextResponse } from 'next/server';
import { generateNonce, isValidShopDomain } from '@/lib/shopify/verify';

export const dynamic = 'force-dynamic';

/**
 * GET /api/auth?shop=store-name.myshopify.com
 *
 * Initiates the Shopify OAuth flow by redirecting the merchant
 * to the Shopify consent screen with the required scopes.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const shop = searchParams.get('shop');

    if (!shop || !isValidShopDomain(shop)) {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid `shop` parameter. Expected format: store-name.myshopify.com' },
        { status: 400 }
      );
    }

    const apiKey = process.env.SHOPIFY_API_KEY;
    const rawForwardedHost = req.headers.get('x-forwarded-host');
    const forwardedHost = rawForwardedHost ? rawForwardedHost.split(',')[0].trim().replace(/:\d+$/, '') : null;
    const rawHost = req.headers.get('host') || 'localhost:3000';
    const hostHeader = rawHost.split(',')[0].trim().replace(/:\d+$/, '');

    let appUrl = process.env.SHOPIFY_APP_URL?.trim();
    if (!appUrl || appUrl.includes('your-app-name') || (appUrl.includes('localhost') && hostHeader && !hostHeader.includes('localhost'))) {
      if (forwardedHost && !forwardedHost.includes('localhost')) {
        appUrl = `https://${forwardedHost}`;
      } else if (hostHeader && !hostHeader.includes('localhost')) {
        appUrl = `https://${hostHeader}`;
      } else {
        appUrl = 'https://magenta-piroshki-22a056.netlify.app';
      }
    }
    appUrl = appUrl.replace(/\/+$/, '');

    let rawScopes = process.env.SCOPES || 'write_metaobject_definitions,write_metaobjects,write_products';
    rawScopes = rawScopes
      .replace(/\b(read_metafields|write_metafields|read_themes|write_themes)\b/g, '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .join(',');

    const scopes = rawScopes || 'write_metaobject_definitions,write_metaobjects,write_products';

    if (!apiKey || apiKey === 'mock_shopify_api_key') {
      return NextResponse.json(
        { success: false, error: 'SHOPIFY_API_KEY is not configured. Set it in your environment variables.' },
        { status: 500 }
      );
    }

    const nonce = generateNonce();
    const redirectUri = `${appUrl}/api/auth/callback`;

    console.log('[OAuth Init] Initiating Shopify OAuth Flow:', {
      shop,
      client_id: apiKey,
      redirect_uri: redirectUri,
    });

    const authUrl = new URL(`https://${shop}/admin/oauth/authorize`);
    authUrl.searchParams.set('client_id', apiKey);
    authUrl.searchParams.set('scope', scopes);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('state', nonce);

    // Create response with redirect and store nonce in cookie
    const response = NextResponse.redirect(authUrl.toString());
    response.cookies.set('shopify_oauth_state', nonce, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 600, // 10 minutes
      path: '/',
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
