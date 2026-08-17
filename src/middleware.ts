import { NextRequest, NextResponse } from 'next/server';

/**
 * Validates whether a domain matches Shopify standard: [subdomain].myshopify.com
 */
function isValidShopDomain(shop: string): boolean {
  if (!shop) return false;
  return /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(shop.toLowerCase().trim());
}

/**
 * Resolves the merchant shop domain from query parameters, cookies, or referer.
 */
function resolveShopDomain(req: NextRequest): string | null {
  // 1. Direct query parameter
  const shopQuery = req.nextUrl.searchParams.get('shop');
  if (shopQuery && isValidShopDomain(shopQuery)) {
    return shopQuery.toLowerCase().trim();
  }

  // 2. Cookie lookup
  const shopCookie = req.cookies.get('shopify_shop_domain')?.value;
  if (shopCookie && isValidShopDomain(shopCookie)) {
    return shopCookie.toLowerCase().trim();
  }

  // 3. Referer header lookup (Shopify admin iframe embeds)
  const referer = req.headers.get('referer');
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      // Case A: referer is https://store-name.myshopify.com/admin/...
      if (isValidShopDomain(refererUrl.hostname)) {
        return refererUrl.hostname.toLowerCase();
      }
      // Case B: referer is https://admin.shopify.com/store/store-name
      if (refererUrl.hostname === 'admin.shopify.com') {
        const pathParts = refererUrl.pathname.split('/');
        const storeIndex = pathParts.indexOf('store');
        if (storeIndex !== -1 && pathParts[storeIndex + 1]) {
          const extractedShop = `${pathParts[storeIndex + 1]}.myshopify.com`;
          if (isValidShopDomain(extractedShop)) {
            return extractedShop;
          }
        }
      }
    } catch {
      // ignore parse errors
    }
  }

  return null;
}

/**
 * Next.js Middleware for the GEO/AEO/AIO Shopify App.
 *
 * Responsibilities:
 * 1. Inject dynamic Content-Security-Policy (CSP) with `frame-ancestors` for Shopify App Store compliance & clickjacking protection.
 * 2. Bypass webhook and cron endpoints.
 * 3. Handle embedded app routing and shop parameter cookies.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

  // 1. Webhook and cron endpoints handle their own authentication
  if (
    pathname.startsWith('/api/webhooks/') ||
    pathname.startsWith('/api/cron/') ||
    pathname.startsWith('/api/auth/')
  ) {
    return NextResponse.next();
  }

  // 2. Resolve shop domain for CSP frame-ancestors
  const shopDomain = resolveShopDomain(req);

  // Construct CSP directive
  // If valid shop: frame-ancestors https://[shop].myshopify.com https://admin.shopify.com;
  // If missing/invalid: frame-ancestors 'none';
  const cspHeader = shopDomain
    ? `frame-ancestors https://${shopDomain} https://admin.shopify.com;`
    : `frame-ancestors 'none';`;

  // 3. In demo mode or standalone mode, allow through with CSP applied
  if (isDemo) {
    const res = NextResponse.next();
    res.headers.set('Content-Security-Policy', cspHeader);
    return res;
  }

  // 4. For API routes, let individual endpoints execute
  if (pathname.startsWith('/api/')) {
    const res = NextResponse.next();
    res.headers.set('Content-Security-Policy', cspHeader);
    return res;
  }

  // 5. Embedded Page Context Check
  const shop = req.nextUrl.searchParams.get('shop');
  const host = req.nextUrl.searchParams.get('host');

  if (!shop && !host && !shopDomain && pathname !== '/') {
    // Not embedded and not on root -> redirect to root
    const redirectRes = NextResponse.redirect(new URL('/', req.url));
    redirectRes.headers.set('Content-Security-Policy', cspHeader);
    return redirectRes;
  }

  const response = NextResponse.next();

  // Inject CSP header for clickjacking protection
  response.headers.set('Content-Security-Policy', cspHeader);

  // Persist resolved shop domain in cookie if present in query param
  if (shop && isValidShopDomain(shop)) {
    response.cookies.set('shopify_shop_domain', shop.toLowerCase().trim(), {
      path: '/',
      sameSite: 'none',
      secure: true,
      httpOnly: false,
    });
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (browser favicon)
     * - public assets
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
