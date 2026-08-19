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

    const apiKey = process.env.SHOPIFY_API_KEY || '';
    const appUrl =
      process.env.SHOPIFY_APP_URL ||
      `https://${req.headers.get('host') || 'localhost:3000'}`;
    const scopes =
      process.env.SHOPIFY_SCOPES ||
      'write_metaobject_definitions,write_metaobjects,write_products';

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
    // Note: Shopify issues offline (permanent) access tokens by default in standard OAuth.
    // Do NOT add grant_options[]=per-user, as that requests short-lived online tokens instead.

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
