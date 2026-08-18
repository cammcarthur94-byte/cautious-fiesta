import { NextRequest, NextResponse } from 'next/server';
import { POST as publishPOST } from '@/app/api/publish/route';

export const dynamic = 'force-dynamic';

/**
 * POST /api/products/update
 * Shopify Admin Sync Route for publishing approved AI product optimizations,
 * meta descriptions, image alt tags, and Schema.org JSON-LD microdata.
 */
export async function POST(req: NextRequest) {
  return publishPOST(req);
}
