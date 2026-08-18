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
    const forwardedHost = req.headers.get('x-forwarded-host');
    const hostHeader = forwardedHost || req.headers.get('host') || 'localhost:3000';
    const protocol = req.headers.get('x-forwarded-proto') || (hostHeader.includes('localhost') ? 'http' : 'https');

    let appUrl = process.env.SHOPIFY_APP_URL;
    if (!appUrl) {
      appUrl = forwardedHost ? `https://${forwardedHost}` : `${protocol}://${hostHeader}`;
    }
    appUrl = appUrl.replace(/\/$/, '');

    const scopes = process.env.SCOPES || 'read_products,write_products,read_metafields,write_metafields,read_themes,write_themes';

    if (!apiKey || apiKey === 'mock_shopify_api_key') {
      return NextResponse.json(
        { success: false, error: 'SHOPIFY_API_KEY is not configured. Set it in your environment variables.' },
        { status: 500 }
      );
    }

    const nonce = generateNonce();
    const redirectUri = `${appUrl}/api/auth/callback`;

    console.log('[OAuth Init] Constructing OAuth Auth URL:', {
      shop,
      client_id: apiKey,
      redirect_uri: redirectUri,
      forwardedHost,
      hostHeader,
    });

    const authUrl = new URL(`https://${shop}/admin/oauth/authorize`);
    authUrl.searchParams.set('client_id', apiKey);
    authUrl.searchParams.set('scope', scopes);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('state', nonce);

    // Create response with redirect and store nonce in a secure httpOnly cookie
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
