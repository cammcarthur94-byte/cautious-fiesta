import crypto from 'crypto';
import { NextRequest } from 'next/server';

const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET || '';

export interface WebhookVerificationResult {
  isValid: boolean;
  rawBody: string;
  shopDomain: string;
  topic: string;
  webhookId?: string;
  error?: string;
}

/**
 * Validates whether a domain matches standard Shopify format: [subdomain].myshopify.com
 */
export function isValidShopDomain(shop: string): boolean {
  if (!shop) return false;
  return /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(shop.toLowerCase().trim());
}

/**
 * Standardizes shop domain string (e.g., lowercase and trimmed).
 */
export function sanitizeShopDomain(shop: string | null | undefined): string | null {
  if (!shop) return null;
  const trimmed = shop.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
  return isValidShopDomain(trimmed) ? trimmed : null;
}

/**
 * Reusable utility to verify incoming Shopify webhooks using HMAC SHA-256.
 *
 * Checks:
 * 1. `X-Shopify-Hmac-Sha256` header presence
 * 2. Raw request body verification using timing-safe buffer comparison
 * 3. Graceful handling of local demo / test modes
 */
export async function verifyShopifyWebhook(
  req: Request | NextRequest,
  preReadRawBody?: string
): Promise<WebhookVerificationResult> {
  const shopDomain = req.headers.get('x-shopify-shop-domain') || '';
  const topic = req.headers.get('x-shopify-topic') || '';
  const webhookId = req.headers.get('x-shopify-webhook-id') || undefined;
  const hmacHeader = req.headers.get('x-shopify-hmac-sha256') || '';

  // Read raw body if not already provided
  let rawBody = preReadRawBody ?? '';
  if (!rawBody) {
    try {
      rawBody = await req.text();
    } catch {
      rawBody = '';
    }
  }

  const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true' && !process.env.SHOPIFY_API_SECRET;

  // In demo mode without a secret configured, allow requests through for testing
  if (isDemo) {
    return {
      isValid: true,
      rawBody,
      shopDomain: shopDomain || 'demo-store.myshopify.com',
      topic: topic || 'unknown',
      webhookId,
    };
  }

  if (!SHOPIFY_API_SECRET) {
    console.warn('[Webhook Security] SHOPIFY_API_SECRET is missing. Rejecting webhook.');
    return {
      isValid: false,
      rawBody,
      shopDomain,
      topic,
      webhookId,
      error: 'Server configuration missing SHOPIFY_API_SECRET',
    };
  }

  if (!hmacHeader) {
    return {
      isValid: false,
      rawBody,
      shopDomain,
      topic,
      webhookId,
      error: 'Missing X-Shopify-Hmac-Sha256 header',
    };
  }

  try {
    const generatedHash = crypto
      .createHmac('sha256', SHOPIFY_API_SECRET)
      .update(rawBody, 'utf-8')
      .digest('base64');

    const isValid = crypto.timingSafeEqual(
      Buffer.from(generatedHash, 'base64'),
      Buffer.from(hmacHeader, 'base64')
    );

    return {
      isValid,
      rawBody,
      shopDomain,
      topic,
      webhookId,
      error: isValid ? undefined : 'HMAC signature mismatch',
    };
  } catch (err: any) {
    return {
      isValid: false,
      rawBody,
      shopDomain,
      topic,
      webhookId,
      error: `HMAC verification error: ${err?.message}`,
    };
  }
}
