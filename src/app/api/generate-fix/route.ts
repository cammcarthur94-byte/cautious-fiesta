import { NextRequest, NextResponse } from 'next/server';
import { generateGeminiOptimization } from '@/lib/scoring/gemini';
import { runDeterministicAudit } from '@/lib/scoring/deterministic';
import { checkUsageLimit, incrementUsage } from '@/lib/billing';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { product, shopDomain = 'demo-store.myshopify.com' } = body;

    if (!product) {
      return NextResponse.json({ success: false, error: 'Product data required' }, { status: 400 });
    }

    // 1. Gatekeep optimization against active plan usage limit
    const usageCheck = await checkUsageLimit(shopDomain);
    if (!usageCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          code: 'USAGE_LIMIT_EXCEEDED',
          error: usageCheck.message || 'Monthly optimization quota exceeded.',
          usage: usageCheck,
        },
        { status: 403 }
      );
    }

    // 2. Generate Gemini AI Optimization
    const currentAudit = product.audit || runDeterministicAudit(product);
    const optimization = await generateGeminiOptimization(product, currentAudit);

    // 3. Increment monthly usage on successful optimization
    const updatedCount = await incrementUsage(shopDomain);

    return NextResponse.json({
      success: true,
      optimization,
      usage: {
        used: updatedCount,
        limit: usageCheck.limit,
        remaining: Math.max(0, usageCheck.limit - updatedCount),
        plan: usageCheck.activePlan,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

