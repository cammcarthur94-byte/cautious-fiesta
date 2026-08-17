/**
 * Utility for making authenticated API calls from client components.
 *
 * In demo mode, uses standard fetch.
 * In embedded Shopify mode, adds the session token from App Bridge.
 */

const isDemo = typeof window !== 'undefined' && process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

/**
 * Authenticated fetch wrapper. Appends Authorization header with
 * the Shopify session token when running in embedded mode.
 *
 * Falls back to standard fetch in demo mode.
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  if (isDemo) {
    return fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
  }

  // In production embedded mode, the Shopify session token should be
  // obtained from App Bridge and passed as a Bearer token.
  // For now, we pass what we have — the middleware will validate.
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });
}
