import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    app: 'shopify-geo-aeo-aio-optimizer',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
}
