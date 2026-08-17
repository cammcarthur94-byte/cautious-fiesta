import { NextRequest, NextResponse } from 'next/server';
import { createShopifyGraphQLClient } from '@/lib/shopify/client';
import { getServiceSupabase } from '@/lib/supabase/client';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { productId, shopDomain, accessToken } = body;

    const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true' || !accessToken;

    if (isDemo) {
      return NextResponse.json({
        success: true,
        message: 'Product successfully rolled back to previous revision (Demo Mode Simulation)',
        restoredAt: new Date().toISOString(),
      });
    }

    const supabase = getServiceSupabase();
    const { data: revision, error } = await supabase
      .from('product_revisions')
      .select('*')
      .eq('shop_domain', shopDomain)
      .eq('shopify_product_id', productId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !revision) {
      return NextResponse.json({
        success: false,
        error: 'No prior revision found for rollback',
      }, { status: 404 });
    }

    const client = await createShopifyGraphQLClient(shopDomain, accessToken);

    const mutation = `
      mutation productRollback($input: ProductInput!) {
        productUpdate(input: $input) {
          product {
            id
            title
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const variables = {
      input: {
        id: productId,
        descriptionHtml: revision.previous_body_html,
      },
    };

    const response: any = await client.request(mutation, { variables });

    return NextResponse.json({
      success: true,
      restoredAt: new Date().toISOString(),
      product: response.data?.productUpdate?.product,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
