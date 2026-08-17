import crypto from 'crypto';

const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET || '';

/**
 * Verify the HMAC signature on an OAuth redirect from Shopify.
 * Shopify appends `hmac`, `shop`, `code`, `state`, `timestamp` as query params.
 */
export function verifyOAuthHmac(query: Record<string, string>): boolean {
  const { hmac, ...rest } = query;
  if (!hmac || !SHOPIFY_API_SECRET) return false;

  // Sort params alphabetically and build the message string
  const message = Object.keys(rest)
    .sort()
    .map((key) => `${key}=${rest[key]}`)
    .join('&');

  const generatedHash = crypto
    .createHmac('sha256', SHOPIFY_API_SECRET)
    .update(message)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(generatedHash, 'hex'),
    Buffer.from(hmac, 'hex')
  );
}

/**
 * Verify the HMAC signature on incoming Shopify webhooks.
 * The HMAC is sent as the `X-Shopify-Hmac-Sha256` header (base64-encoded).
 */
export function verifyWebhookHmac(rawBody: string, hmacHeader: string): boolean {
  if (!hmacHeader || !SHOPIFY_API_SECRET) return false;

  const generatedHash = crypto
    .createHmac('sha256', SHOPIFY_API_SECRET)
    .update(rawBody, 'utf-8')
    .digest('base64');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(generatedHash, 'base64'),
      Buffer.from(hmacHeader, 'base64')
    );
  } catch {
    return false;
  }
}

/**
 * Generate a random nonce for OAuth state parameter to prevent CSRF.
 */
export function generateNonce(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Validate that a shop domain matches the expected myshopify.com pattern.
 */
export function isValidShopDomain(shop: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(shop);
}
