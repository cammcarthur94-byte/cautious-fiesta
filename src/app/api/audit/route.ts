import { NextRequest, NextResponse } from 'next/server';
import { runDeterministicAudit } from '@/lib/scoring/deterministic';
import { INITIAL_MOCK_PRODUCTS } from '@/lib/mock/sample-catalog';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { product } = body;

    if (!product) {
      return NextResponse.json({ success: false, error: 'Product data required' }, { status: 400 });
    }

    const audit = runDeterministicAudit(product);

    return NextResponse.json({
      success: true,
      audit,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const productId = searchParams.get('productId');

  const product = INITIAL_MOCK_PRODUCTS.find(p => p.id === productId);
  if (!product) {
    return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
  }

  const audit = runDeterministicAudit(product);
  return NextResponse.json({ success: true, audit, product });
}
