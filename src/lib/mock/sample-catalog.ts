import { ShopifyProductItem } from '../scoring/types';
import { runDeterministicAudit } from '../scoring/deterministic';

export const INITIAL_MOCK_PRODUCTS: ShopifyProductItem[] = [
  {
    id: 'gid://shopify/Product/1001',
    title: 'AeroGlide Pro Titanium Wireless Noise-Cancelling Headphones',
    handle: 'aeroglide-pro-wireless-headphones',
    vendor: 'AeroAcoustics',
    product_type: 'Electronics',
    status: 'active',
    price: '$299.00',
    image_url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop&q=60',
    body_html: `
      <p>These headphones are really amazing and sound great. You will love listening to music with them everywhere you go. They are super comfy and have long battery life. Buy now to enjoy good tunes.</p>
    `,
    metafields: {}
  },
  {
    id: 'gid://shopify/Product/1002',
    title: 'Nordic Peak 45L Ultralight Alpine Backpack',
    handle: 'nordic-peak-45l-backpack',
    vendor: 'Nordic Trail',
    product_type: 'Outdoor & Gear',
    status: 'active',
    price: '$189.00',
    image_url: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&auto=format&fit=crop&q=60',
    body_html: `
      <h1>Nordic Peak Alpine Backpack</h1>
      <p>A backpack made for people who love the mountains and hiking on the weekends.</p>
      <h4>Specifications</h4>
      <p>Big capacity, lots of pockets, weather resistant materials.</p>
    `,
    metafields: {}
  },
  {
    id: 'gid://shopify/Product/1003',
    title: 'PureBotanica Cold-Pressed Organic Rosehip Facial Serum',
    handle: 'purebotanica-rosehip-facial-serum',
    vendor: 'PureBotanica Labs',
    product_type: 'Skincare',
    status: 'active',
    price: '$48.00',
    image_url: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=800&auto=format&fit=crop&q=60',
    body_html: `
      <p>Our serum is nice for your face. Helps with glow and moisture. Apply two drops daily.</p>
    `,
    metafields: {}
  },
  {
    id: 'gid://shopify/Product/1004',
    title: 'Veloce 850W Smart Induction Espresso Machine',
    handle: 'veloce-850w-espresso-machine',
    vendor: 'Veloce Kitchen',
    product_type: 'Home Appliances',
    status: 'active',
    price: '$649.00',
    image_url: 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=800&auto=format&fit=crop&q=60',
    body_html: `
      <h2>Commercial-Grade Precision Brewing at Home</h2>
      <p>The <strong>Veloce 850W Smart Induction Espresso Machine</strong> is designed to provide barista-level 19-bar extraction with PID dual-temperature stability and 3-second instant thermoblock heating.</p>
      
      <h3>Key Engineering Specifications</h3>
      <ul>
        <li><strong>Power Output:</strong> 850W high-efficiency induction boiler with +/- 0.5°C PID thermal control.</li>
        <li><strong>Pressure System:</strong> 19-bar Italian ULKA vibration pump with pre-infusion pressure profiling.</li>
        <li><strong>Certifications:</strong> ETL Safety Certified, CE Marked, and FDA food-contact compliant 304 Stainless Steel.</li>
        <li><strong>Capacity:</strong> 2.2L removable BPA-free water reservoir with integrated filtration.</li>
      </ul>
    `,
    metafields: {
      jsonld_schema: {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: 'Veloce 850W Smart Induction Espresso Machine',
        brand: { '@type': 'Brand', name: 'Veloce Kitchen' },
        offers: { '@type': 'Offer', price: '649.00', priceCurrency: 'USD' }
      },
      faq_data: [
        {
          question: 'What type of pump is inside the Veloce 850W?',
          answer: 'It utilizes a commercial-grade 19-bar Italian ULKA pump paired with dynamic pre-infusion.'
        },
        {
          question: 'What is the warm-up time from cold start?',
          answer: 'The patented ThermoSpeed induction coil reaches brewing temperature in under 3 seconds.'
        }
      ]
    }
  },
  {
    id: 'gid://shopify/Product/1005',
    title: 'ErgoForm Pro 3D Mesh Lumbar Office Chair',
    handle: 'ergoform-pro-lumbar-office-chair',
    vendor: 'ErgoForm Designs',
    product_type: 'Furniture',
    status: 'active',
    price: '$420.00',
    image_url: 'https://images.unsplash.com/photo-1580481077197-2a5433299712?w=800&auto=format&fit=crop&q=60',
    body_html: `
      <p>Super comfortable office chair for long working days. Helps reduce back strain with modern styling and adjustable armrests.</p>
      <ul>
        <li>Adjustable height</li>
        <li>Mesh back</li>
        <li>Rolling wheels</li>
      </ul>
    `,
    metafields: {}
  },
  {
    id: 'gid://shopify/Product/1006',
    title: 'VoltPulse 100W GaN IV Fast Charger (4-Port)',
    handle: 'voltpulse-100w-gan-charger',
    vendor: 'VoltPulse Tech',
    product_type: 'Electronics',
    status: 'active',
    price: '$79.99',
    image_url: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=800&auto=format&fit=crop&q=60',
    body_html: `
      <p>Fast wall charger for your laptop and phone. Works with all USB-C devices.</p>
    `,
    metafields: {}
  }
];

// Initialize audits for mock products
export function getMockProductsWithAudits(): ShopifyProductItem[] {
  return INITIAL_MOCK_PRODUCTS.map(product => {
    // If audit was already generated/published, retain it; otherwise compute deterministic audit
    const audit = product.audit || runDeterministicAudit(product);
    return {
      ...product,
      audit
    };
  });
}

/**
 * Apply published AI fix to in-memory mock catalog
 */
export function applyPublishedOptimization(
  productId: string,
  newDescription: string,
  faqs: any[],
  jsonLdSchema: any
) {
  const product = INITIAL_MOCK_PRODUCTS.find(
    (p) => p.id === productId || p.id.endsWith(productId) || productId.endsWith(p.id)
  );

  if (product) {
    product.body_html = newDescription;
    product.metafields = {
      ...product.metafields,
      jsonld_schema: jsonLdSchema,
      faq_data: faqs,
    };
    product.audit = {
      productId: product.id,
      overallScore: 96,
      geoBreakdown: { score: 95, weight: 0.4, subScores: {} },
      aeoBreakdown: { score: 94, weight: 0.35, subScores: {} },
      aioBreakdown: { score: 98, weight: 0.25, subScores: {} },
      issues: [],
      recommendations: { quickWins: [], deepFixes: [], geminiSummary: 'Product fully optimized and published live.' },
      auditedAt: new Date().toISOString(),
      isPublished: true,
    };
  }
}
